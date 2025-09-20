const fs = require('fs');
const axios = require('axios');

async function transcribeAudioWithGemini(audioPath) {
  try {
    if (!fs.existsSync(audioPath)) {
      console.log(`Audio file does not exist: ${audioPath}`);
      return "No audio file available for transcription";
    }

    const audioBuffer = fs.readFileSync(audioPath);
    const base64Audio = audioBuffer.toString('base64');

    console.log('Sending audio to Gemini for transcription...');

    const payload = {
      contents: [{
        parts: [
          { 
            text: "Transcribe this audio file. Focus on emergency-related content, locations, and any urgent information. Return the full transcript as plain text." 
          },
          { 
            inline_data: {
              mime_type: "audio/wav",
              data: base64Audio
            }
          }
        ]
      }]
    };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      payload,
      { 
        headers: { "Content-Type": "application/json" }, 
        timeout: 90000, // Increased timeout to 90 seconds
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Invalid response format from Gemini API');
    }

    const transcript = response.data.candidates[0].content.parts[0].text.trim();
    console.log('Audio transcription successful');
    return transcript || "No speech detected in audio";

  } catch (error) {
    console.error('Audio transcription error:', error.message);
    if (error.code === 'ECONNABORTED') {
      return "Audio transcription timed out";
    }
    return `Audio transcription failed: ${error.message}`;
  }
}

async function analyzeEmergencyWithGemini(frames, transcript, timestamp) {
  try {
    // Process first frame for visual analysis
    const firstFrame = frames[0];
    if (!fs.existsSync(firstFrame)) {
      throw new Error(`Image file does not exist: ${firstFrame}`);
    }

    const imageBuffer = fs.readFileSync(firstFrame);
    const base64Image = imageBuffer.toString('base64');

    console.log('Analyzing emergency with Gemini...');

    const promptText = `
Analyze this emergency situation using the image and transcript provided.

Transcript: "${transcript || 'No audio transcript available'}"
Timestamp: ${timestamp}

Please analyze and provide a JSON response with the following structure:
{
  "emergency_type": "string (fire/medical/accident/natural_disaster/crime/other)",
  "department": "string (fire_department/police/ambulance/rescue/forest_department/other)",
  "confidence": number (0-1),
  "location": "string (extract any location mentioned in transcript or 'unknown')",
  "audio_transcript": "string (the full transcript)",
  "severity": "string (low/medium/high/critical)",
  "description": "string (brief description of the emergency)",
  "timestamp": "${timestamp}"
}

Respond ONLY with valid JSON.
`;

    const payload = {
      contents: [{
        parts: [
          { text: promptText },
          { 
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }]
    };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      payload,
      { 
        headers: { "Content-Type": "application/json" }, 
        timeout: 45000, // Increased timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Invalid response format from Gemini API');
    }

    const responseText = response.data.candidates[0].content.parts[0].text;
    console.log('Raw Gemini response:', responseText);
    
    // Extract JSON from response
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('No valid JSON found in Gemini response');
    }
    
    const jsonText = responseText.substring(jsonStart, jsonEnd);
    console.log('Extracted JSON:', jsonText);
    
    const result = JSON.parse(jsonText);

    // Validate required fields and add defaults
    const validatedResult = {
      emergency_type: result.emergency_type || "unknown",
      department: result.department || "unknown",
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
      location: result.location || "unknown",
      audio_transcript: result.audio_transcript || transcript || "No transcript available",
      severity: result.severity || "medium",
      description: result.description || "Emergency analysis completed",
      timestamp: result.timestamp || timestamp
    };

    console.log('Emergency analysis successful');
    return validatedResult;

  } catch (error) {
    console.error('Emergency analysis error:', error.message);
    
    return {
      emergency_type: "unknown",
      department: "unknown", 
      confidence: 0,
      location: "unknown",
      audio_transcript: transcript || "No transcript available",
      severity: "unknown",
      description: `Analysis failed: ${error.message}`,
      timestamp: timestamp,
      error: error.message
    };
  }
}

async function analyzeVideoWithGemini(frames, audioPath, timestamp, existingTranscript = null) {
  try {
    console.log('Starting Gemini analysis...');
    
    // Step 1: Transcribe audio if not provided and audio file exists
    let transcript = existingTranscript;
    if (!transcript && audioPath && fs.existsSync(audioPath)) {
      console.log('Transcribing audio...');
      transcript = await transcribeAudioWithGemini(audioPath);
      console.log('Audio transcription complete');
    }

    // Step 2: Analyze emergency with visual and audio data
    console.log('Analyzing emergency situation...');
    const analysis = await analyzeEmergencyWithGemini(frames, transcript, timestamp);
    
    // Ensure transcript is included in final result
    if (transcript && !analysis.audio_transcript) {
      analysis.audio_transcript = transcript;
    }

    console.log('Analysis complete');
    return analysis;

  } catch (error) {
    console.error('Complete analysis error:', error.message);
    return {
      emergency_type: "error",
      department: "unknown",
      confidence: 0,
      location: "unknown",
      audio_transcript: "Error in processing",
      severity: "unknown",
      description: "Complete analysis failed: " + error.message,
      timestamp: timestamp,
      error: error.message
    };
  }
}

// Legacy function for backward compatibility
async function analyzeFrameWithGemini(imagePath, transcript) {
  const timestamp = new Date().toISOString();
  return await analyzeVideoWithGemini([imagePath], null, timestamp, transcript);
}

module.exports = { 
  analyzeVideoWithGemini, 
  analyzeFrameWithGemini,
  transcribeAudioWithGemini,
  analyzeEmergencyWithGemini
};
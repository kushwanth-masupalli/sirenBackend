const fs = require('fs');
const axios = require('axios');

async function analyzeFrameWithGemini(imagePath, transcript) {
  try {
    if (!fs.existsSync(imagePath)) throw new Error(`Image file does not exist: ${imagePath}`);
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const promptText = `Analyze this image for emergencies along with the following transcript: "${transcript}". Respond ONLY with valid JSON: {"emergency_type": "string","confidence": number}`;

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
      { headers: { "Content-Type": "application/json" }, timeout: 30000 }
    );

    const responseText = response.data.candidates[0].content.parts[0].text;
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}') + 1;
    const result = JSON.parse(responseText.substring(jsonStart, jsonEnd));

    if (!result.emergency_type || typeof result.confidence !== 'number') throw new Error('Invalid response format');
    return result;

  } catch (error) {
    console.error('Gemini error:', error.message);
    return { emergency_type: "error", confidence: 0, error: error.message };
  }
}

module.exports = { analyzeFrameWithGemini };

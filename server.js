require('dotenv').config(); // Load GEMINI_API_KEY from .env

const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Extract key frames using ffmpeg (corrected version)
async function extractKeyFrames(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Use cross-platform path separator and ensure proper escaping
    const outputPattern = path.join(outputDir, 'keyframe_%03d.jpg');
    
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vf', 'select=gt(scene\\,0.4)',  // Scene change detection
      '-vsync', 'vfr',                  // Variable frame rate
      '-pix_fmt', 'rgb24',             // Changed from yuvj420p to rgb24 for better JPEG compatibility
      '-q:v', '2',                     // High quality
      '-frames:v', '10',               // Limit to max 10 frames
      '-y',                            // Overwrite output files
      outputPattern,
      '-loglevel', 'error'
    ], {
      // Ensure proper stdio handling
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const errors = [];
    let stdout = '';

    ffmpeg.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffmpeg.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      errors.push(errorMsg);
      console.error('FFmpeg stderr:', errorMsg);
    });

    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg process exited with code: ${code}`);
      
      if (code !== 0) {
        console.error('FFmpeg failed with errors:', errors.join('\n'));
        return reject(new Error(`FFmpeg process failed with code ${code}: ${errors.join('')}`));
      }

      // Check if output directory exists and list files
      if (!fs.existsSync(outputDir)) {
        return reject(new Error('Output directory does not exist'));
      }

      const allFiles = fs.readdirSync(outputDir);
      console.log('All files in output directory:', allFiles);

      const frames = allFiles
        .filter(file => file.startsWith('keyframe_') && file.endsWith('.jpg'))
        .sort()
        .slice(0, 3); // Take first 3 frames

      console.log('Filtered keyframe files:', frames);

      if (frames.length === 0) {
        // Fallback: try to extract frames at specific intervals
        console.log('No scene-based frames found, trying interval extraction...');
        return extractFramesAtIntervals(videoPath, outputDir)
          .then(resolve)
          .catch(reject);
      }

      const framePaths = frames.map(frame => path.join(outputDir, frame));
      
      // Verify that files actually exist and are readable
      const validFrames = framePaths.filter(framePath => {
        try {
          const stats = fs.statSync(framePath);
          return stats.isFile() && stats.size > 0;
        } catch (error) {
          console.error(`Frame file not accessible: ${framePath}`, error.message);
          return false;
        }
      });

      resolve(validFrames);
    });

    ffmpeg.on('error', (err) => {
      console.error('FFmpeg spawn error:', err);
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });

    // Set a timeout to prevent hanging
    setTimeout(() => {
      if (!ffmpeg.killed) {
        ffmpeg.kill('SIGKILL');
        reject(new Error('FFmpeg process timeout'));
      }
    }, 30000); // 30 second timeout
  });
}

// Fallback method: extract frames at fixed intervals
async function extractFramesAtIntervals(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    const outputPattern = path.join(outputDir, 'interval_%03d.jpg');
    
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vf', 'fps=1/10',  // Extract 1 frame every 10 seconds
      '-pix_fmt', 'rgb24',
      '-q:v', '2',
      '-frames:v', '3',   // Maximum 3 frames
      '-y',
      outputPattern,
      '-loglevel', 'error'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const errors = [];

    ffmpeg.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      errors.push(errorMsg);
      console.error('FFmpeg interval extraction stderr:', errorMsg);
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Interval extraction failed with code ${code}: ${errors.join('')}`));
      }

      const frames = fs.readdirSync(outputDir)
        .filter(file => file.startsWith('interval_') && file.endsWith('.jpg'))
        .sort()
        .slice(0, 3);

      const framePaths = frames.map(frame => path.join(outputDir, frame));
      
      const validFrames = framePaths.filter(framePath => {
        try {
          const stats = fs.statSync(framePath);
          return stats.isFile() && stats.size > 0;
        } catch (error) {
          return false;
        }
      });

      resolve(validFrames);
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to start interval extraction: ${err.message}`));
    });

    setTimeout(() => {
      if (!ffmpeg.killed) {
        ffmpeg.kill('SIGKILL');
        reject(new Error('Interval extraction timeout'));
      }
    }, 30000);
  });
}

// Analyze frame with Gemini API (Base64 method)
async function analyzeFrameWithGemini(imagePath) {
  try {
    // Verify file exists and is readable
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file does not exist: ${imagePath}`);
    }

    const stats = fs.statSync(imagePath);
    if (!stats.isFile() || stats.size === 0) {
      throw new Error(`Invalid image file: ${imagePath}`);
    }

    console.log(`Reading image: ${imagePath} (${stats.size} bytes)`);

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const payload = {
      contents: [{
        parts: [
          { 
            text: 'Analyze this image for emergencies. Classify if it shows: fire, accident, wild animal, or none. ' +
                  'Respond ONLY with valid JSON in this exact format: {"emergency_type": "string", "confidence": number} ' +
                  'where emergency_type is one of: "fire", "accident", "wild_animal", or "none". ' +
                  'Set confidence as a decimal between 0 and 1.'
          },
          { 
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }]
    };

    console.log('Sending request to Gemini API...');

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      payload,
      { 
        headers: { "Content-Type": "application/json" },
        timeout: 30000 // 30 second timeout
      }
    );

    if (!response.data || !response.data.candidates || response.data.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }

    const responseText = response.data.candidates[0].content.parts[0].text;
    console.log('Gemini response:', responseText);

    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}') + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('No JSON found in response');
    }

    const jsonString = responseText.substring(jsonStart, jsonEnd);
    const result = JSON.parse(jsonString);

    // Validate the response format
    if (!result.emergency_type || typeof result.confidence !== 'number') {
      throw new Error('Invalid response format from Gemini');
    }

    return result;

  } catch (error) {
    console.error('Error analyzing frame with Gemini:', error.response?.data || error.message);
    return { emergency_type: "error", confidence: 0, error: error.message };
  }
}

// Main endpoint
app.post('/api/analyze-emergency', upload.single('video'), async (req, res) => {
  let videoPath = null;
  let outputDir = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    videoPath = req.file.path;
    outputDir = path.join('uploads', `frames_${Date.now()}`);

    console.log('Processing video:', videoPath);
    console.log('Video file size:', fs.statSync(videoPath).size, 'bytes');
    console.log('Output directory:', outputDir);

    console.log('Extracting key frames from:', videoPath);
    const framePaths = await extractKeyFrames(videoPath, outputDir);

    if (framePaths.length === 0) {
      return res.status(400).json({ 
        error: 'No key frames could be extracted from the video',
        details: 'The video might be corrupted, too short, or in an unsupported format'
      });
    }

    console.log(`Successfully extracted ${framePaths.length} key frames`);

    const results = [];
    for (let i = 0; i < framePaths.length; i++) {
      const framePath = framePaths[i];
      console.log(`Analyzing frame ${i + 1}/${framePaths.length}:`, framePath);
      
      const analysis = await analyzeFrameWithGemini(framePath);
      results.push({
        frame: path.basename(framePath),
        frame_path: framePath,
        analysis
      });

      // Add small delay between API calls to avoid rate limiting
      if (i < framePaths.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const emergencies = results.filter(r => 
      r.analysis.emergency_type && 
      r.analysis.emergency_type !== 'none' &&
      r.analysis.emergency_type !== 'error' &&
      r.analysis.confidence > 0.6  // Lowered threshold slightly
    );

    const response = {
      success: true,
      video_processed: path.basename(videoPath),
      frames_analyzed: results.length,
      emergencies_detected: emergencies.length > 0,
      emergency_count: emergencies.length,
      results,
      alert: emergencies.length > 0 ? 'EMERGENCY_DETECTED' : 'NO_EMERGENCY'
    };

    if (emergencies.length > 0) {
      response.emergency_summary = emergencies.map(e => ({
        frame: e.frame,
        type: e.analysis.emergency_type,
        confidence: e.analysis.confidence
      }));
    }

    res.json(response);

  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).json({ 
      error: 'Failed to process video',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    // Cleanup with better error handling - DISABLED for debugging
    console.log('Cleanup disabled for debugging purposes');
    console.log('Video file location:', videoPath);
    console.log('Frames directory:', outputDir);
    
    // Only cleanup video file, keep frames for debugging
    try {
      if (videoPath && fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log('Cleaned up video file:', videoPath);
      }
      // Commented out frame cleanup for debugging
      // if (outputDir && fs.existsSync(outputDir)) {
      //   fs.rmSync(outputDir, { recursive: true, force: true });
      //   console.log('Cleaned up frames directory:', outputDir);
      // }
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    ffmpeg_available: checkFFmpegAvailable()
  });
});

// Check if FFmpeg is available
function checkFFmpegAvailable() {
  try {
    const ffmpeg = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 100MB)' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

app.listen(port, () => {
  console.log(`Emergency detection server running on port ${port}`);
  console.log('FFmpeg available:', checkFFmpegAvailable());
});
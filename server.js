require('dotenv').config();
const express = require('express');
const path = require('path');
const { upload } = require('./services/uploadService');
const { extractKeyFrames, extractAudio } = require('./services/videoService');
const { analyzeVideoWithGemini } = require('./services/geminiService');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname))); // serve index.html

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    geminiApiKey: process.env.GEMINI_API_KEY ? 'configured' : 'missing'
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is working!',
    timestamp: new Date().toISOString()
  });
});

// Single endpoint for complete video processing
app.post('/process-video', upload.single('video'), async (req, res) => {
  // Set proper headers
  res.setHeader('Content-Type', 'application/json');
  
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file uploaded',
        timestamp: new Date().toISOString()
      });
    }

    const videoPath = req.file.path;
    const outputDir = path.join('uploads', path.parse(req.file.filename).name);
    const timestamp = new Date().toISOString();

    console.log(`Processing video: ${videoPath}`);

    // Extract keyframes and audio
    console.log('Extracting keyframes and audio...');
    const [frames, audioPath] = await Promise.all([
      extractKeyFrames(videoPath, outputDir),
      extractAudio(videoPath, outputDir)
    ]);

    console.log(`Extracted ${frames.length} frames and audio`);

    // Analyze with Gemini
    console.log('Starting Gemini analysis...');
    const analysis = await analyzeVideoWithGemini(frames, audioPath, timestamp);
    console.log('Analysis complete');

    const response = {
      success: true,
      timestamp,
      videoPath,
      analysis
    };

    res.status(200).json(response);

  } catch (err) {
    console.error('Video processing error:', err);
    
    const errorResponse = {
      success: false,
      error: err.message || 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      details: err.stack ? err.stack.split('\n')[0] : 'No additional details'
    };
    
    res.status(500).json(errorResponse);
  }
});

// Keep the old analyze endpoint for backward compatibility
app.post('/analyze', async (req, res) => {
  try {
    const { imagePath, transcript } = req.body;
    const result = await analyzeVideoWithGemini([imagePath], null, new Date().toISOString(), transcript);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
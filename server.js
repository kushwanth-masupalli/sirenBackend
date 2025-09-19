require('dotenv').config();
const express = require('express');
const { upload } = require('./services/uploadService');
const { extractKeyFrames } = require('./services/videoService.js');
const { analyzeFrameWithGemini } = require('./services/geminiService');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Main endpoint
app.post('/api/analyze-emergency', upload.single('video'), async (req, res) => {
  let videoPath = null;
  let outputDir = null;

  try {
    if (!req.file) return res.status(400).json({ error: 'No video file provided' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    videoPath = req.file.path;
    outputDir = path.join('uploads', `frames_${Date.now()}`);

    const framePaths = await extractKeyFrames(videoPath, outputDir);

    if (framePaths.length === 0) return res.status(400).json({ error: 'No key frames could be extracted from the video' });

    const results = [];
    for (let i = 0; i < framePaths.length; i++) {
      const framePath = framePaths[i];
      const analysis = await analyzeFrameWithGemini(framePath);
      results.push({
        frame: path.basename(framePath),
        frame_path: framePath,
        analysis
      });
      if (i < framePaths.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const emergencies = results.filter(r => r.analysis.emergency_type && r.analysis.emergency_type !== 'none' && r.analysis.emergency_type !== 'error' && r.analysis.confidence > 0.6);

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
    res.status(500).json({ error: 'Failed to process video', message: error.message });
  } finally {
    try { if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath); } catch {}
  }
});

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error', message: error.message });
});

app.listen(port, () => {
  console.log(`Emergency detection server running on port ${port}`);
});

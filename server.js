require('dotenv').config();
const express = require('express');
const path = require('path');
const { upload } = require('./services/uploadService');
const { extractKeyFrames, extractAudio } = require('./services/videoService');
const { analyzeFrameWithGemini } = require('./services/geminiService');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname))); // serve index.html

app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    const videoPath = req.file.path;
    const outputDir = path.join('uploads', path.parse(req.file.filename).name);

    const frames = await extractKeyFrames(videoPath, outputDir);
    const audioPath = await extractAudio(videoPath, outputDir);

    res.json({ videoPath, frames, audioPath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/analyze', async (req, res) => {
  try {
    const { imagePath, transcript } = req.body;
    const result = await analyzeFrameWithGemini(imagePath, transcript);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function extractKeyFrames(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPattern = path.join(outputDir, 'keyframe_%03d.jpg');

    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vf', 'select=gt(scene\\,0.4)',
      '-vsync', 'vfr',
      '-pix_fmt', 'rgb24',
      '-q:v', '2',
      '-frames:v', '10',
      '-y',
      '-loglevel', 'error',
      outputPattern
    ]);

    const errors = [];
    const timeout = setTimeout(() => { if (!ffmpeg.killed) ffmpeg.kill('SIGKILL'); }, 30000);

    ffmpeg.stderr.on('data', data => errors.push(data.toString()));
    ffmpeg.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(`FFmpeg failed with code ${code}: ${errors.join('')}`));

      const frames = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('keyframe_') && f.endsWith('.jpg'))
        .sort()
        .slice(0, 3);

      if (frames.length === 0) {
        return extractFramesAtIntervals(videoPath, outputDir).then(resolve).catch(reject);
      }

      resolve(frames.map(f => path.join(outputDir, f)));
    });

    ffmpeg.on('error', reject);
  });
}

async function extractFramesAtIntervals(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPattern = path.join(outputDir, 'interval_%03d.jpg');

    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vf', 'fps=1/10',
      '-pix_fmt', 'rgb24',
      '-q:v', '2',
      '-frames:v', '3',
      '-y',
      '-loglevel', 'error',
      outputPattern
    ]);

    const errors = [];
    const timeout = setTimeout(() => { if (!ffmpeg.killed) ffmpeg.kill('SIGKILL'); }, 30000);

    ffmpeg.stderr.on('data', data => errors.push(data.toString()));
    ffmpeg.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(`Interval extraction failed: ${errors.join('')}`));

      const frames = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('interval_') && f.endsWith('.jpg'))
        .sort()
        .slice(0, 3);

      resolve(frames.map(f => path.join(outputDir, f)));
    });

    ffmpeg.on('error', reject);
  });
}

async function extractAudio(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const audioPath = path.join(outputDir, 'audio.wav');

    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-y',
      '-loglevel', 'error',
      audioPath
    ]);

    const errors = [];
    ffmpeg.stderr.on('data', data => errors.push(data.toString()));
    ffmpeg.on('close', code => {
      if (code !== 0) return reject(new Error(`Audio extraction failed: ${errors.join('')}`));
      resolve(audioPath);
    });

    ffmpeg.on('error', reject);
  });
}

module.exports = { extractKeyFrames, extractFramesAtIntervals, extractAudio };

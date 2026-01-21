import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HF_BASE = 'https://huggingface.co/Supertone/supertonic-2/resolve/main';

const files = [
  'onnx/duration_predictor.onnx',
  'onnx/text_encoder.onnx',
  'onnx/vector_estimator.onnx',
  'onnx/vocoder.onnx',
  'onnx/tts.json',
  'onnx/unicode_indexer.json',
  'voice_styles/M1.json',
  'voice_styles/M2.json',
  'voice_styles/M3.json',
  'voice_styles/M4.json',
  'voice_styles/M5.json',
  'voice_styles/F1.json',
  'voice_styles/F2.json',
  'voice_styles/F3.json',
  'voice_styles/F4.json',
  'voice_styles/F5.json',
];

const publicDir = path.join(__dirname, '..', 'public', 'assets');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Skip if file exists and is larger than 1KB (not a LFS pointer)
    if (fs.existsSync(dest)) {
      const stats = fs.statSync(dest);
      if (stats.size > 1024) {
        console.log(`  Skip (exists): ${path.basename(dest)}`);
        resolve();
        return;
      }
    }

    console.log(`  Downloading: ${path.basename(dest)}...`);

    const follow = (url, redirectCount = 0) => {
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'));
        return;
      }

      const protocol = url.startsWith('https') ? https : require('http');

      protocol.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
          follow(response.headers.location, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          return;
        }

        const file = fs.createWriteStream(dest);
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          const size = fs.statSync(dest).size;
          console.log(`  Done: ${path.basename(dest)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
          resolve();
        });

        file.on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    };

    follow(url);
  });
}

async function main() {
  console.log('\\n📦 Downloading TTS models from HuggingFace...\\n');

  for (const file of files) {
    const url = `${HF_BASE}/${file}`;
    const dest = path.join(publicDir, file);

    try {
      await downloadFile(url, dest);
    } catch (err) {
      console.error(`❌ Error downloading ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log('\\n✅ All models downloaded successfully!\\n');
}

main();

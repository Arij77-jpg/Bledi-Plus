import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = 'C:\\Users\\Moi\\.gemini\\antigravity\\brain\\80e153a7-85a3-457a-9d4a-0cc09ec79fd8\\.user_uploaded';
const dstDir = path.join(__dirname, '..', 'assets', 'seed-images');

if (!fs.existsSync(dstDir)) {
  fs.mkdirSync(dstDir, { recursive: true });
}

const fileMap = {
  'media_1795304830306_87788688.jpg': 'lamp_before.jpg',
  'media_1795304830603_ced6f012.jpg': 'lamp_after.jpg',
  'media_1795304830289_54b875a4.jpg': 'pothole_before.jpg',
  'media_1795304830542_2485b417.jpg': 'pothole_after.jpg',
  'media_1795304830414_ab3f7f25.jpg': 'alley_before.jpg',
  'media_1795304830580_44fcd841.jpg': 'alley_after.jpg',
  'media_1795304830455_21f93084.jpg': 'grass_trash_before.jpg',
  'media_1795304830671_f719435b.jpg': 'grass_trash_after.jpg',
  'media_1795304830315_83f6d2e4.jpg': 'pending_1.jpg',
  'media_1795304830324_ed4b25c6.jpg': 'pending_2.jpg',
  'media_1795304830456_900a35ae.jpg': 'pending_3.jpg',
  'media_1795304830470_1d41de4b.jpg': 'pending_4.jpg',
};

console.log('Copying images...');
for (const [srcFile, dstFile] of Object.entries(fileMap)) {
  const srcPath = path.join(srcDir, srcFile);
  const dstPath = path.join(dstDir, dstFile);
  if (!fs.existsSync(srcPath)) {
    console.error(`Missing source file: ${srcPath}`);
    process.exit(1);
  }
  fs.copyFileSync(srcPath, dstPath);
  const stats = fs.statSync(dstPath);
  console.log(`Copied: ${dstFile} (${Math.round(stats.size / 1024)} KB)`);
}

console.log('All 12 seed images successfully copied to assets/seed-images!');

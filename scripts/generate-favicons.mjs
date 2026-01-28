/**
 * Generate favicon PNG files from SVG
 *
 * Run with: node scripts/generate-favicons.mjs
 *
 * This script uses sharp to convert SVG to various PNG sizes.
 * Install sharp if needed: npm install --save-dev sharp
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// SVG for favicon - simplified shield that works at small sizes
const faviconSvg = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1a2744"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
  </defs>
  <!-- Shield shape -->
  <path d="M16 2 L28 6 L28 14 C28 22 16 30 16 30 C16 30 4 22 4 14 L4 6 Z"
        fill="url(#shieldGrad)" stroke="#d4af37" stroke-width="1.5"/>
  <!-- Simple R letter -->
  <text x="16" y="20" text-anchor="middle" fill="#d4af37" font-family="serif" font-size="14" font-weight="bold">R</text>
</svg>`;

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function generateFavicons() {
  console.log('Generating favicons...');

  const svgBuffer = Buffer.from(faviconSvg);

  for (const { name, size } of sizes) {
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(join(publicDir, name));
      console.log(`Created ${name} (${size}x${size})`);
    } catch (err) {
      console.error(`Error creating ${name}:`, err.message);
    }
  }

  // For favicon.ico, we'll just use the 32x32 PNG renamed
  // Modern browsers handle PNG favicons fine
  try {
    const png32 = await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toBuffer();
    writeFileSync(join(publicDir, 'favicon.ico'), png32);
    console.log('Created favicon.ico (32x32 PNG)');
  } catch (err) {
    console.error('Error creating favicon.ico:', err.message);
  }

  console.log('Done!');
}

generateFavicons().catch(console.error);

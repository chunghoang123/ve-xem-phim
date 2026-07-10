const sharp = require('sharp');
const path = require('path');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="96">
  <defs>
    <linearGradient id="boxGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="textGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#f472b6"/>
    </linearGradient>
  </defs>

  <rect x="8" y="8" width="80" height="80" rx="20" fill="url(#boxGrad)"/>
  <filter id="shadow">
    <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#a855f7" flood-opacity="0.2"/>
  </filter>
  <rect x="8" y="8" width="80" height="80" rx="20" fill="url(#boxGrad)" filter="url(#shadow)"/>

  <g transform="translate(28, 28)" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="40" height="40" x="0" y="0" rx="4"/>
    <line x1="0" x2="40" y1="12" y2="12"/>
    <line x1="0" x2="40" y1="28" y2="28"/>
    <line x1="12" x2="12" y1="0" y2="40"/>
    <line x1="28" x2="28" y1="0" y2="40"/>
  </g>

  <text x="112" y="66" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="700" fill="url(#textGrad)">CineX</text>
</svg>
`;

const outputDir = path.join(__dirname, '..', 'public');

async function generate() {
  await sharp(Buffer.from(svg))
    .resize(180, 48)
    .png()
    .toFile(path.join(outputDir, 'logo.png'));

  await sharp(Buffer.from(svg))
    .resize(360, 96)
    .png()
    .toFile(path.join(outputDir, 'logo@2x.png'));

  await sharp(Buffer.from(svg))
    .resize(540, 144)
    .png()
    .toFile(path.join(outputDir, 'logo@3x.png'));

  await sharp(Buffer.from(svg))
    .resize(180, 48)
    .webp()
    .toFile(path.join(outputDir, 'logo.webp'));

  console.log('Logo images generated in public/');
}

generate().catch(console.error);

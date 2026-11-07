import { access } from 'node:fs/promises';

// This SSR theme has no compile step: server.js + static assets are the production
// output, and the image is built by publish-image.yml. This step guards that every
// required production file is present before an image is built.
const required = [
  'server.js', 'app.js', 'index.html', 'style.css', 'cms.css', 'eshobe.theme.json',
  'src', 'vendor', 'public',
];

let missing = [];
for (const name of required) {
  try {
    await access(name);
  } catch {
    missing.push(name);
  }
}

if (missing.length) {
  console.error(`Build failed: missing production files: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Build OK: production files present (no compile step for this SSR theme; the image is built by publish-image.yml).');

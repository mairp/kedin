#!/usr/bin/env node
'use strict';
// Generate a single image for a LinkedIn post via Google's gemini-2.5-flash-image (AI Studio).
// kedin's chat model (gemini-2.5-flash-lite) can't produce images, so this is a separate call.
//   node gen-image.js "<prompt>"            -> writes ./outbox-image.png, prints the path
//   node gen-image.js --out <file> "<prompt>"
// The image is a CANDIDATE only: kedin must show it to the user for approval; nothing posts here.
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY_FILE = process.env.GEMINI_KEY_FILE || path.join(__dirname, 'credentials', 'gemini', 'key');
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

// Consistent house style so every candidate image is a polished, colorful UML / architecture-style
// technical diagram (override with env GEMINI_IMAGE_STYLE). Diffusion models garble long text, so we
// explicitly ask for SHORT legible labels only — shapes/arrows/color carry the meaning, not paragraphs.
const STYLE = process.env.GEMINI_IMAGE_STYLE ||
  'Create a polished, modern UML / software-architecture style technical diagram that illustrates the ' +
  'concept below. Flat clean vector look; tasteful professional color palette (blues, teals, indigo, ' +
  'with one warm accent); clearly defined components drawn as rounded color-coded boxes / nodes / ' +
  'lifelines connected by labeled directional arrows; clear visual hierarchy, aligned grid layout, ' +
  'generous whitespace, soft shadows, subtle depth. Wide 16:9 composition that works as a LinkedIn ' +
  'header. IMPORTANT: use only SHORT crisp labels (1-3 words each), large and perfectly legible — no ' +
  'paragraphs, no fake or gibberish text, no watermark. Crisp, high-resolution, professional. ' +
  'Concept to diagram: ';

function loadKey() {
  if (!fs.existsSync(KEY_FILE)) throw new Error('gemini key file missing: ' + KEY_FILE);
  const k = fs.readFileSync(KEY_FILE, 'utf8').trim();
  if (!k) throw new Error('gemini key file is empty: ' + KEY_FILE);
  return k;
}

function request(method, urlStr, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      { method, hostname: u.hostname, path: u.pathname + u.search, headers },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const args = process.argv.slice(2);
  let out = path.join(__dirname, 'outbox-image.png');
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') { out = args[++i]; continue; }
    rest.push(args[i]);
  }
  const prompt = rest.join(' ').trim();
  if (!prompt) throw new Error('usage: node gen-image.js [--out <file>] "<prompt>"');
  const styledPrompt = STYLE + prompt;

  const key = loadKey();
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: styledPrompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  });
  const res = await request(
    'POST',
    'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent',
    { headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: payload }
  );
  if (res.status !== 200) throw new Error('image gen failed (' + res.status + '): ' + res.body.slice(0, 500));

  const data = JSON.parse(res.body);
  const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  const img = parts.find((p) => p.inlineData && p.inlineData.data);
  if (!img) throw new Error('no image in response: ' + res.body.slice(0, 500));

  fs.writeFileSync(out, Buffer.from(img.inlineData.data, 'base64'));
  console.log('IMAGE');
  console.log('file:', out);
  console.log('mime:', img.inlineData.mimeType || 'image/png');
  console.log('bytes:', fs.statSync(out).size);
})().catch((e) => { console.error('gen-image error: ' + e.message); process.exit(1); });

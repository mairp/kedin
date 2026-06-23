'use strict';
// Shared helpers for the Kedin LinkedIn toolkit. Node stdlib only.
const fs = require('fs');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const CREDS = process.env.KEDIN_CREDS || path.join(__dirname, 'credentials', 'linkedin', 'kedin.json');
const REDIRECT_URI = process.env.KEDIN_REDIRECT || 'http://localhost:8765/callback';
// w_member_social = post on behalf of the member; openid+profile = fetch member URN via /v2/userinfo
const SCOPES = 'w_member_social openid profile';
// LinkedIn retires versions after ~12 months; bump yearly (probe /rest/me: 403=active, 426=retired).
const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION || '202605';

function loadCreds() {
  if (!fs.existsSync(CREDS)) throw new Error('credentials file missing: ' + CREDS + ' (run oauth.js first / seed client_id+client_secret)');
  return JSON.parse(fs.readFileSync(CREDS, 'utf8'));
}
function saveCreds(c) {
  fs.writeFileSync(CREDS, JSON.stringify(c, null, 2) + '\n', { mode: 0o600 });
  try { fs.chmodSync(CREDS, 0o600); } catch (_) {}
}

// Minimal HTTPS request. body: string (already encoded) or null.
function request(method, urlStr, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      { method, hostname: u.hostname, path: u.pathname + u.search, headers },
      (res) => {
        let data = '';
        res.on('data', (d) => (data += d));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const form = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');

// Exchange a refresh_token for a fresh access token (and rotated refresh token, if returned).
async function refreshAccessToken(c) {
  if (!c.refresh_token) throw new Error('no refresh_token stored; re-run the oauth flow');
  const res = await request('POST', 'https://www.linkedin.com/oauth/v2/accessToken', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({
      grant_type: 'refresh_token',
      refresh_token: c.refresh_token,
      client_id: c.client_id,
      client_secret: c.client_secret,
    }),
  });
  if (res.status !== 200) throw new Error('token refresh failed (' + res.status + '): ' + res.body);
  const t = JSON.parse(res.body);
  c.access_token = t.access_token;
  c.expires_at = Date.now() + (t.expires_in || 0) * 1000;
  if (t.refresh_token) c.refresh_token = t.refresh_token;
  saveCreds(c);
  return c;
}

// Return creds with a valid access token, refreshing if it expires within 5 minutes.
async function ensureToken(c) {
  if (!c.access_token) throw new Error('no access_token; run the oauth flow');
  if (!c.expires_at || c.expires_at - Date.now() < 5 * 60 * 1000) {
    process.stderr.write('[kedin] access token expired/near-expiry -> refreshing\n');
    return refreshAccessToken(c);
  }
  return c;
}

// Normalize "smart"/exotic Unicode punctuation to plain ASCII. LinkedIn's commentary parser
// truncates posts at certain non-ASCII punctuation (e.g. U+2011 non-breaking hyphen the LLM loves
// to insert in "Spec-Driven"). Keep the em dash — it renders fine and reads well.
function sanitizeText(text) {
  return text
    .replace(/ /g, ' ')               // non-breaking space
    .replace(/[‐‑‒–]/g, '-') // hyphen, non-breaking hyphen, figure/en dash
    .replace(/[‘’‚‛]/g, "'") // curly single quotes
    .replace(/[“”„‟]/g, '"') // curly double quotes
    .replace(/…/g, '...')             // ellipsis
    .replace(/[​-‍﻿]/g, ''); // zero-width chars
}

// Strip emojis / pictographs / variation selectors / ZWJ / regional indicators (LinkedIn posts must be emoji-free).
function stripEmoji(text) {
  return text
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '') // regional indicators (flags)
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu, '') // variation selectors, ZWJ, keycap
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Upload a local image to LinkedIn via the Images API and return its image URN (urn:li:image:...).
// Three steps: initializeUpload (reserve an asset + get a one-shot uploadUrl) -> PUT the bytes -> use URN.
// Requires a valid access token on c (caller should ensureToken first).
async function uploadImage(c, filePath) {
  const buf = fs.readFileSync(filePath);
  const init = await request('POST', 'https://api.linkedin.com/rest/images?action=initializeUpload', {
    headers: {
      Authorization: 'Bearer ' + c.access_token,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: c.member_urn } }),
  });
  if (init.status !== 200) throw new Error('image initializeUpload failed (' + init.status + '): ' + init.body);
  const v = (JSON.parse(init.body) || {}).value || {};
  if (!v.uploadUrl || !v.image) throw new Error('initializeUpload missing uploadUrl/image: ' + init.body);

  const put = await request('PUT', v.uploadUrl, {
    headers: {
      Authorization: 'Bearer ' + c.access_token,
      'Content-Type': 'application/octet-stream',
      'Content-Length': buf.length,
    },
    body: buf,
  });
  if (put.status !== 200 && put.status !== 201) throw new Error('image upload PUT failed (' + put.status + '): ' + put.body);
  return v.image;
}

// Record the most recently published post so /delete and /editpost can target "previous"/-1.
const LAST_POST = process.env.KEDIN_LAST_POST || path.join(__dirname, 'workspace', 'last-post.json');
function saveLastPost(obj) {
  try { fs.writeFileSync(LAST_POST, JSON.stringify(obj, null, 2) + '\n'); } catch (_) {}
}
function loadLastPost() {
  try { return JSON.parse(fs.readFileSync(LAST_POST, 'utf8')); } catch (_) { return null; }
}

module.exports = { CREDS, REDIRECT_URI, SCOPES, LINKEDIN_VERSION, LAST_POST, loadCreds, saveCreds, request, form, refreshAccessToken, ensureToken, stripEmoji, sanitizeText, uploadImage, saveLastPost, loadLastPost };

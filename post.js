#!/usr/bin/env node
'use strict';
// Publish a post (optionally with one image) to the user's personal LinkedIn feed.
//   node post.js <textfile>                          -> publish the file's contents (text-only)
//   node post.js --image <png> [--alt <text>] <txt>  -> publish with an attached image
//   node post.js --document <pdf> [--title <text>] <txt> -> publish with an attached PDF
//   node post.js --dry-run [...] <textfile>          -> build + print the request, publish nothing
// Emojis are stripped as a safety net (Kedin should never produce them anyway).
const fs = require('fs');
const { loadCreds, ensureToken, request, stripEmoji, sanitizeText, uploadImage, uploadDocument, saveLastPost, LINKEDIN_VERSION } = require('./lib');

// LinkedIn /rest/posts "commentary" uses the Little Text Format: these characters are reserved and
// MUST be backslash-escaped or LinkedIn truncates the text at the first one. We escape all reserved
// chars EXCEPT '#' so trailing hashtags stay clickable.
function escapeCommentary(t) {
  return t.replace(/[\\(){}\[\]<>@~_*|]/g, (m) => '\\' + m);
}

// Tiny flag parser: --dry-run (bool), --image <file>, --alt <text>; first positional = text file.
const argv = process.argv.slice(2);
let dryRun = false, imageFile = null, alt = '', file = null, docFile = null, title = '';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--dry-run') dryRun = true;
  else if (argv[i] === '--image') imageFile = argv[++i];
  else if (argv[i] === '--document') docFile = argv[++i];
  else if (argv[i] === '--title') title = argv[++i];
  else if (argv[i] === '--alt') alt = argv[++i] || '';
  else if (!file) file = argv[i];
}

(async () => {
  if (!file) throw new Error('usage: node post.js [--dry-run] [--image <png> [--alt <text>]] [--document <pdf> [--title <text>]] <textfile>');
  if (imageFile && docFile) throw new Error('a post carries either one image or one document, not both');
  let text = sanitizeText(stripEmoji(fs.readFileSync(file, 'utf8').trim()));
  if (!text) throw new Error('post text is empty');
  if (text.length > 3000) throw new Error('post exceeds 3000 chars (' + text.length + ')');
  if (imageFile && !fs.existsSync(imageFile)) throw new Error('image file not found: ' + imageFile);
  if (docFile && !fs.existsSync(docFile)) throw new Error('document file not found: ' + docFile);
  // LinkedIn shows the title as the document's caption in the feed; it is required.
  if (docFile && !title) throw new Error('--document requires --title (shown as the document caption)');

  let c = loadCreds();
  if (!c.member_urn) throw new Error('no member_urn in creds; run oauth.js first');

  const payload = {
    author: c.member_urn,
    commentary: escapeCommentary(text),
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  if (dryRun) {
    console.log('DRY RUN — would POST https://api.linkedin.com/rest/posts');
    console.log('author:', c.member_urn);
    console.log('chars:', text.length);
    if (imageFile) console.log('image:', imageFile, '(' + fs.statSync(imageFile).size + ' bytes) altText:', JSON.stringify(alt));
    if (docFile) console.log('document:', docFile, '(' + fs.statSync(docFile).size + ' bytes) title:', JSON.stringify(title));
    console.log('--- body (media id assigned at publish time) ---');
    const preview = imageFile ? { ...payload, content: { media: { id: '<urn:li:image assigned on upload>', altText: alt } } }
      : docFile ? { ...payload, content: { media: { id: '<urn:li:document assigned on upload>', title } } }
      : payload;
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  c = await ensureToken(c);
  if (imageFile) {
    const imageUrn = await uploadImage(c, imageFile);
    payload.content = { media: { id: imageUrn, altText: alt } };
    console.log('image uploaded:', imageUrn);
  }
  if (docFile) {
    const docUrn = await uploadDocument(c, docFile);
    payload.content = { media: { id: docUrn, title } };
    console.log('document uploaded:', docUrn);
  }
  const res = await request('POST', 'https://api.linkedin.com/rest/posts', {
    headers: {
      Authorization: 'Bearer ' + c.access_token,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(payload),
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error('post failed (' + res.status + '): ' + res.body);
  }
  const urn = res.headers['x-restli-id'] || res.headers['x-linkedin-id'] || '';
  // The /rest/posts API returns the SHARE urn, but LinkedIn's permalink redirect (share -> activity)
  // is flaky and 404s in a browser. `?skipRedirect=true` bypasses it; the recent-activity page is the
  // always-works fallback (newest post on top).
  const activity = c.activity_url || (c.profile_url ? c.profile_url.replace(/\/?$/, '/') + 'recent-activity/all/' : '');
  const directLink = urn ? 'https://www.linkedin.com/feed/update/' + urn + '/?skipRedirect=true' : '';
  if (urn) saveLastPost({ urn, direct_url: directLink, activity_url: activity, ts: Date.now() });
  console.log('POSTED');
  console.log('urn:', urn || '(none in headers)');
  if (urn) console.log('direct link:', directLink);
  console.log('your posts (always works):', activity);
})().catch((e) => { console.error('post error: ' + e.message); process.exit(1); });

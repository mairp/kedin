#!/usr/bin/env node
'use strict';
// Edit the commentary (text) of an already-published LinkedIn post via Posts API PARTIAL_UPDATE.
//   node editpost.js <urn> <textfile>             -> replace the post's text with the file contents
//   node editpost.js --dry-run <urn> <textfile>   -> build + print the patch, change nothing
// Only the text/commentary can be changed; an attached image cannot be swapped after publish.
const fs = require('fs');
const { loadCreds, ensureToken, request, stripEmoji, sanitizeText, LINKEDIN_VERSION } = require('./lib');

// Same Little Text Format escaping as post.js (escape reserved chars except '#').
function escapeCommentary(t) {
  return t.replace(/[\\(){}\[\]<>@~_*|]/g, (m) => '\\' + m);
}

const argv = process.argv.slice(2);
let dryRun = false;
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--dry-run') dryRun = true;
  else pos.push(argv[i]);
}
const urn = pos[0];
const file = pos[1];

(async () => {
  if (!urn || !urn.startsWith('urn:li:') || !file) {
    throw new Error('usage: node editpost.js [--dry-run] <urn:li:...> <textfile>');
  }
  let text = sanitizeText(stripEmoji(fs.readFileSync(file, 'utf8').trim()));
  if (!text) throw new Error('new post text is empty');
  if (text.length > 3000) throw new Error('post exceeds 3000 chars (' + text.length + ')');

  const patch = { patch: { $set: { commentary: escapeCommentary(text) } } };

  if (dryRun) {
    console.log('DRY RUN — would PARTIAL_UPDATE https://api.linkedin.com/rest/posts/' + urn);
    console.log('chars:', text.length);
    console.log('--- patch ---');
    console.log(JSON.stringify(patch, null, 2));
    return;
  }

  const c = await ensureToken(loadCreds());
  const res = await request('POST', 'https://api.linkedin.com/rest/posts/' + encodeURIComponent(urn), {
    headers: {
      Authorization: 'Bearer ' + c.access_token,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'X-RestLi-Method': 'PARTIAL_UPDATE',
    },
    body: JSON.stringify(patch),
  });
  if (res.status !== 200 && res.status !== 204) {
    throw new Error('edit failed (' + res.status + '): ' + res.body);
  }
  console.log('EDITED ' + urn);
  const activity = c.activity_url || (c.profile_url ? c.profile_url.replace(/\/?$/, '/') + 'recent-activity/all/' : '');
  console.log('direct link:', 'https://www.linkedin.com/feed/update/' + urn + '/?skipRedirect=true');
  console.log('your posts (always works):', activity);
})().catch((e) => { console.error('edit error: ' + e.message); process.exit(1); });

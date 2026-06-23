#!/usr/bin/env node
'use strict';
// Reshare an existing LinkedIn post to the user's feed WITH his own commentary ("my thoughts").
//   node repost.js <url> <textfile>             -> reshare the post at <url> with the file's commentary
//   node repost.js --dry-run <url> <textfile>   -> parse the URL + build the request, publish nothing
// The reserved-char escaping / emoji-strip / unicode-sanitize pipeline matches post.js.
//
// If LinkedIn rejects the reshare (e.g. the w_member_social scope or the reshareContext shape is not
// accepted for this URN), we AUTO-FALL BACK to a normal post whose commentary embeds the source URL,
// so /repost always produces a working post.
const fs = require('fs');
const { loadCreds, ensureToken, request, stripEmoji, sanitizeText, saveLastPost, LINKEDIN_VERSION } = require('./lib');

// Same Little Text Format escaping as post.js (escape reserved chars except '#').
function escapeCommentary(t) {
  return t.replace(/[\\(){}\[\]<>@~_*|]/g, (m) => '\\' + m);
}

// Extract the URN of the post being reshared from a LinkedIn URL.
// Handles: .../urn:li:activity:123 (or share/ugcPost), and slug form .../posts/<slug>-activity-123-abc.
function parseUrn(url) {
  const u = decodeURIComponent(String(url || '').trim());
  let m = u.match(/urn:li:(activity|share|ugcPost):(\d+)/i);
  if (m) return `urn:li:${m[1]}:${m[2]}`;
  m = u.match(/-(?:activity|ugcPost|share)[-:](\d{6,})/i);
  if (m) return `urn:li:activity:${m[1]}`;
  m = u.match(/(?:activity|feed\/update)\D*?(\d{12,})/i);
  if (m) return `urn:li:activity:${m[1]}`;
  return null;
}

const argv = process.argv.slice(2);
let dryRun = false;
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--dry-run') dryRun = true;
  else pos.push(argv[i]);
}
const url = pos[0];
const file = pos[1];

function postBody(c, commentary, parentUrn) {
  const body = {
    author: c.member_urn,
    commentary: escapeCommentary(commentary),
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (parentUrn) body.reshareContext = { parent: parentUrn };
  return body;
}

async function publish(c, body) {
  return request('POST', 'https://api.linkedin.com/rest/posts', {
    headers: {
      Authorization: 'Bearer ' + c.access_token,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });
}

function report(urn, c) {
  const activity = c.activity_url || (c.profile_url ? c.profile_url.replace(/\/?$/, '/') + 'recent-activity/all/' : '');
  const directLink = urn ? 'https://www.linkedin.com/feed/update/' + urn + '/?skipRedirect=true' : '';
  if (urn) saveLastPost({ urn, direct_url: directLink, activity_url: activity, ts: Date.now() });
  console.log('urn:', urn || '(none in headers)');
  if (urn) console.log('direct link:', directLink);
  console.log('your posts (always works):', activity);
}

(async () => {
  if (!url || !file) throw new Error('usage: node repost.js [--dry-run] <url> <textfile>');
  const parent = parseUrn(url);
  if (!parent) throw new Error('could not parse a LinkedIn post URN from URL: ' + url);

  let text = sanitizeText(stripEmoji(fs.readFileSync(file, 'utf8').trim()));
  if (!text) throw new Error('commentary text is empty');
  if (text.length > 3000) throw new Error('commentary exceeds 3000 chars (' + text.length + ')');

  let c = loadCreds();
  if (!c.member_urn) throw new Error('no member_urn in creds; run oauth.js first');

  if (dryRun) {
    console.log('DRY RUN — would POST https://api.linkedin.com/rest/posts (reshare)');
    console.log('author:', c.member_urn);
    console.log('parent (reshared post):', parent);
    console.log('commentary chars:', text.length);
    console.log('--- reshare body ---');
    console.log(JSON.stringify(postBody(c, text, parent), null, 2));
    console.log('--- fallback body (plain post w/ source link, if reshare is rejected) ---');
    console.log(JSON.stringify(postBody(c, text + '\n\n' + url, null), null, 2));
    return;
  }

  c = await ensureToken(c);
  let res = await publish(c, postBody(c, text, parent));
  if (res.status !== 201 && res.status !== 200) {
    // Reshare rejected — fall back to a normal post that links the source.
    console.error('reshare rejected (' + res.status + '): ' + res.body);
    console.error('falling back to a plain post with the source URL embedded...');
    res = await publish(c, postBody(c, text + '\n\n' + url, null));
    if (res.status !== 201 && res.status !== 200) {
      throw new Error('repost failed (' + res.status + '): ' + res.body);
    }
    console.log('POSTED (fallback: plain post with source link)');
  } else {
    console.log('RESHARED');
  }
  report(res.headers['x-restli-id'] || res.headers['x-linkedin-id'] || '', c);
})().catch((e) => { console.error('repost error: ' + e.message); process.exit(1); });

#!/usr/bin/env node
'use strict';
// One-time LinkedIn OAuth for Kedin.
//   node oauth.js url               -> print the authorize URL (open it in YOUR browser, approve)
//   node oauth.js exchange <code>   -> swap the ?code=... for tokens + member URN, store creds
//
// Prereqs: the creds file must already contain client_id + client_secret (seeded from the
// LinkedIn developer app). Redirect URI registered in the app must equal KEDIN_REDIRECT
// (default http://localhost:8765/callback).
const { loadCreds, saveCreds, request, form, REDIRECT_URI, SCOPES } = require('./lib');

const cmd = process.argv[2];

function authorizeUrl(c) {
  const state = 'kedin-' + (c.client_id || '').slice(0, 6);
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: c.client_id,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
  });
  return 'https://www.linkedin.com/oauth/v2/authorization?' + p.toString();
}

(async () => {
  const c = loadCreds();
  if (!c.client_id || !c.client_secret) throw new Error('seed client_id + client_secret into the creds file first');

  if (cmd === 'url') {
    console.log(authorizeUrl(c));
    console.log('\nOpen the URL above, approve, then copy the `code` value from the redirected');
    console.log('localhost URL and run:  node oauth.js exchange <code>');
    return;
  }

  if (cmd === 'exchange') {
    const code = process.argv[3];
    if (!code) throw new Error('usage: node oauth.js exchange <code>');
    // 1) code -> tokens
    const tok = await request('POST', 'https://www.linkedin.com/oauth/v2/accessToken', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({
        grant_type: 'authorization_code',
        code,
        client_id: c.client_id,
        client_secret: c.client_secret,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (tok.status !== 200) throw new Error('token exchange failed (' + tok.status + '): ' + tok.body);
    const t = JSON.parse(tok.body);
    c.access_token = t.access_token;
    c.expires_at = Date.now() + (t.expires_in || 0) * 1000;
    if (t.refresh_token) c.refresh_token = t.refresh_token;
    c.scope = t.scope || SCOPES;

    // 2) member URN: prefer decoding the OIDC id_token's `sub` (dev-portal tokens lack
    //    a real id_token and userinfo 403s, so the auth-code id_token is the reliable source).
    let sub = '', name = '';
    if (t.id_token) {
      const payload = JSON.parse(Buffer.from(t.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      sub = payload.sub; name = payload.name || '';
    } else {
      const ui = await request('GET', 'https://api.linkedin.com/v2/userinfo', { headers: { Authorization: 'Bearer ' + c.access_token } });
      if (ui.status !== 200) throw new Error('no id_token and userinfo failed (' + ui.status + '): ' + ui.body);
      const info = JSON.parse(ui.body); sub = info.sub; name = info.name || '';
    }
    if (!sub) throw new Error('could not determine member id (sub)');
    c.member_urn = 'urn:li:person:' + sub;
    c.member_name = name;

    saveCreds(c);
    console.log('OK. Stored token + member URN.');
    console.log('  member:', c.member_name, '(' + c.member_urn + ')');
    console.log('  access token expires:', new Date(c.expires_at).toISOString());
    console.log('  refresh token:', c.refresh_token ? 'yes' : 'NO (will need periodic re-auth)');
    return;
  }

  throw new Error('usage: node oauth.js url | exchange <code>');
})().catch((e) => { console.error('oauth error: ' + e.message); process.exit(1); });

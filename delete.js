#!/usr/bin/env node
'use strict';
// Delete a LinkedIn post by URN:  node delete.js <urn:li:share:...|urn:li:ugcPost:...>
const { loadCreds, ensureToken, request } = require('./lib');

const urn = process.argv[2];
(async () => {
  if (!urn || !urn.startsWith('urn:li:')) throw new Error('usage: node delete.js <urn:li:share:...>');
  let c = await ensureToken(loadCreds());
  const res = await request('DELETE', 'https://api.linkedin.com/rest/posts/' + encodeURIComponent(urn), {
    headers: {
      Authorization: 'Bearer ' + c.access_token,
      'LinkedIn-Version': '202605',
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });
  if (res.status === 204 || res.status === 200) {
    console.log('DELETED ' + urn);
  } else {
    throw new Error('delete failed (' + res.status + '): ' + res.body);
  }
})().catch((e) => { console.error('delete error: ' + e.message); process.exit(1); });

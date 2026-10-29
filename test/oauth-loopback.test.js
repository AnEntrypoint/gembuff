'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gembuff-oauth-'));
process.env.GEMBUFF_SECRETS_DIR = dir;
process.env.GEMBUFF_OAUTH_CLIENT_ID = 'test-client-id';
process.env.GEMBUFF_OAUTH_CLIENT_SECRET = 'test-client-secret';

const config = require('../lib/config');
const loopback = require('../lib/auth/oauth-loopback');

let tokenServer;
const hits = [];

before(async () => {
  tokenServer = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      hits.push(Object.fromEntries(new URLSearchParams(raw)));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ access_token: 'test-access-token', expires_in: 3600, token_type: 'Bearer' }));
    });
  });
  await new Promise(r => tokenServer.listen(0, '127.0.0.1', r));
  process.env.GEMBUFF_OAUTH_TOKEN_URL = `http://127.0.0.1:${tokenServer.address().port}/token`;
});

after(() => {
  tokenServer.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject);
  });
}

test('PKCE S256 challenge matches the RFC 7636 appendix B vector', () => {
  assert.equal(
    loopback.challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
});

test('callback with a mismatched state is rejected', async () => {
  const flow = await loopback.beginLoopback({ clientId: 'test-client-id', clientSecret: 'test-client-secret' });
  const outcome = flow.done.then(() => null, err => err);
  assert.equal(await get(`${flow.redirectUri}?code=test-code&state=wrong`), 400);
  assert.match((await outcome).message, /state mismatch/);
});

test('status reports unconfigured when no token file exists', async () => {
  const s = await loopback.status();
  assert.equal(s.configured, false);
});

test('refresh token is exchanged once and the access token is cached', async () => {
  config.writeSecretJson('oauth-loopback.json', { client_id: 'test-client-id', refresh_token: 'test-refresh-token', scope: 'test-scope', expires_at: 0 });
  const first = await loopback.resolve();
  const second = await loopback.resolve();
  assert.deepEqual(first, { method: 'oauth-loopback', kind: 'bearer', value: 'test-access-token' });
  assert.deepEqual(second, first);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].grant_type, 'refresh_token');
  assert.equal(hits[0].refresh_token, 'test-refresh-token');
  const stored = config.readSecretJson('oauth-loopback.json');
  assert.equal(stored.access_token, 'test-access-token');
  assert.ok(stored.expires_at > Date.now());
});

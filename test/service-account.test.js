'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const sa = require('../lib/auth/service-account');

const TOKEN = 'fake-access-token-123';
const CLIENT_EMAIL = 'fake-sa@fake-project.iam.gserviceaccount.com';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const KEY_LINE = privateKey.split('\n')[1];

let server, base, dir;
const seen = {};

function send(res, body) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      if (req.url === '/token') {
        seen.form = new URLSearchParams(raw);
        return send(res, { access_token: TOKEN, expires_in: 3600, token_type: 'Bearer' });
      }
      if (req.url.startsWith('/v1beta/models')) {
        seen.auth = req.headers.authorization;
        seen.project = req.headers['x-goog-user-project'];
        return send(res, { models: [] });
      }
      res.writeHead(404).end();
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.GEMBUFF_OAUTH_TOKEN_URL = `${base}/token`;
  process.env.GEMBUFF_GEMINI_BASE = `${base}/v1beta`;

  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-sa-'));
  const keyFile = path.join(dir, 'sa.json');
  fs.writeFileSync(keyFile, JSON.stringify({
    type: 'service_account',
    project_id: 'fake-project',
    client_email: CLIENT_EMAIL,
    private_key: privateKey,
  }));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFile;
});

after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('resolve posts a valid RS256 JWT and returns the access token as bearer', async () => {
  const cred = await sa.resolve();
  assert.equal(cred.kind, 'bearer');
  assert.equal(cred.value, TOKEN);
  assert.equal(cred.method, 'service-account');
  assert.equal(cred.projectId, 'fake-project');

  assert.equal(seen.form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  const [h, c, s] = seen.form.get('assertion').split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  assert.equal(claims.iss, CLIENT_EMAIL);
  assert.equal(claims.scope, 'https://www.googleapis.com/auth/cloud-platform');
  assert.equal(claims.aud, `${base}/token`);
  assert.equal(claims.exp - claims.iat, 3600);
  assert.ok(Math.abs(claims.iat - Math.floor(Date.now() / 1000)) < 60);
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, 'base64url')));
});

test('bearer token is sent to the Gemini API', async () => {
  const gemini = require('../lib/gemini');
  const models = await gemini.listModels(await sa.resolve(), { projectId: 'fake-project' });
  assert.deepEqual(models, []);
  assert.equal(seen.auth, `Bearer ${TOKEN}`);
  assert.equal(seen.project, 'fake-project');
});

test('status is configured via temp path and leaks no key or token', async () => {
  const st = await sa.status();
  assert.equal(st.configured, true);
  assert.match(st.detail, /fake-sa@fake-project/);
  assert.ok(!st.detail.includes(KEY_LINE));
  assert.ok(!st.detail.includes(TOKEN));
});

test('login prints guidance without key material', async () => {
  const lines = [];
  const orig = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  try { await sa.login(); } finally { console.log = orig; }
  const out = lines.join('\n');
  assert.match(out, /IAM & Admin/);
  assert.ok(!out.includes(KEY_LINE));
});

test('status is unconfigured when the env var is empty or the file is not a key', async () => {
  const saved = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  try {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
    assert.equal((await sa.status()).configured, false);
    assert.equal(await sa.resolve(), null);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(dir, 'missing.json');
    assert.equal((await sa.status()).configured, false);
  } finally {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = saved;
  }
});

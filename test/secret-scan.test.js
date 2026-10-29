'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { scanText, pathHits } = require('../scripts/secret-scan');

// Fixtures are built at runtime so this file itself never contains a token-shaped literal.
const fake = (prefix, body) => prefix + body;

test('flags a Google API key shape', () => {
  const out = [];
  scanText('a.js', `const k = "${fake('AIza', 'x'.repeat(35))}";`, out);
  assert.ok(out.some(h => h.includes('google-api-key')));
});

test('flags OAuth access and refresh token shapes', () => {
  const out = [];
  scanText('a.js', fake('ya29.', 'a'.repeat(30)), out);
  scanText('b.js', fake('1//', 'b'.repeat(40)), out);
  assert.ok(out.some(h => h.includes('google-oauth-access-token')));
  assert.ok(out.some(h => h.includes('google-refresh-token')));
});

test('flags a private key block and a service account JSON', () => {
  const out = [];
  scanText('k.txt', fake('-----BEGIN ', 'RSA PRIVATE KEY-----'), out);
  scanText('s.json', '{ "type": "' + 'service_' + 'account", "project_id": "p" }', out);
  assert.ok(out.some(h => h.includes('private-key-block')));
  assert.ok(out.some(h => h.includes('service-account-json')));
});

test('flags an assigned secret with a long value', () => {
  const out = [];
  scanText('c.js', `const refresh_token = "${'z'.repeat(29)}9";`, out);
  assert.ok(out.some(h => h.includes('assigned-secret')));
});

test('ignores ordinary code and short values', () => {
  const out = [];
  scanText('ok.js', 'const api_key = process.env.GEMINI_API_KEY;\nconst n = "short";', out);
  assert.deepStrictEqual(out, []);
});

test('respects the explicit allow marker for fake fixtures', () => {
  const out = [];
  scanText('f.js', `const x = "${fake('AIza', 'x'.repeat(35))}"; // secret-scan:allow`, out);
  assert.deepStrictEqual(out, []);
});

test('blocks credential file paths but allows .env.example', () => {
  assert.ok(pathHits('.env'));
  assert.ok(pathHits('.gembuff/secrets/oauth.json'));
  assert.ok(pathHits('keys/service-account-prod.json'));
  assert.ok(pathHits('deploy/id.pem'));
  assert.ok(!pathHits('.env.example'));
  assert.ok(!pathHits('lib/auth/oauth-loopback.js'));
});

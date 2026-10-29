'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LOOP = path.join(__dirname, '..', 'scripts', 'login-loop.js');

function fakeCli(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gembuff-loop-'));
  const file = path.join(dir, 'fake-cli.js');
  fs.writeFileSync(file, body);
  return file;
}

function loop(cli, args, env = {}) {
  return spawnSync(process.execPath, [LOOP, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GEMBUFF_CLI: cli, ...env },
    timeout: 20000,
  });
}

test('a login that never calls back times out and names the blocked-app cause', () => {
  const cli = fakeCli('setTimeout(() => {}, 60000);');
  const r = loop(cli, ['gcloud-adc', '--attempts', '3'], { GEMBUFF_LOGIN_TIMEOUT_MS: '500' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /timed out/);
  assert.match(r.stderr, /This app is blocked/);
  assert.strictEqual((r.stdout.match(/attempt /g) || []).length, 1, 'a timeout must not retry');
});

test('a successful login followed by a passing test reports verified', () => {
  const cli = fakeCli(`
    const args = process.argv.slice(2);
    if (args[0] === 'login') process.exit(0);
    if (args[0] === 'test') { console.log('generate -> pong'); process.exit(0); }
  `);
  const r = loop(cli, ['oauth-loopback']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /verified: oauth-loopback/);
});

test('a scope 403 on test stops with the scope guidance and does not retry', () => {
  const cli = fakeCli(`
    const args = process.argv.slice(2);
    if (args[0] === 'login') process.exit(0);
    if (args[0] === 'test') { console.error('models.list 403: Request had insufficient authentication scopes.'); process.exit(1); }
  `);
  const r = loop(cli, ['gcloud-adc']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /will not help/);
});

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SECRETS_DIR = process.env.GEMBUFF_SECRETS_DIR || path.join(REPO_ROOT, '.gembuff', 'secrets');

function loadDotEnv(file = path.join(REPO_ROOT, '.env')) {
  if (!fs.existsSync(file)) return {};
  const loaded = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[key] === undefined) process.env[key] = value;
    loaded[key] = value;
  }
  return loaded;
}

function secretPath(name) {
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
  return path.join(SECRETS_DIR, name);
}

function readSecretJson(name) {
  const file = path.join(SECRETS_DIR, name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeSecretJson(name, value) {
  fs.writeFileSync(secretPath(name), JSON.stringify(value, null, 2), { mode: 0o600 });
}

module.exports = { REPO_ROOT, SECRETS_DIR, loadDotEnv, secretPath, readSecretJson, writeSecretJson };

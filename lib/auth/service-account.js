'use strict';

// Service-account JSON key -> RS256 JWT -> OAuth access token (jwt-bearer grant). The key is a long-lived secret.
const crypto = require('crypto');
const fs = require('fs');
const { loadDotEnv } = require('../config');

const id = 'service-account';
const title = 'Service account JSON key via GOOGLE_APPLICATION_CREDENTIALS (long-lived secret)';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

function loadKey() {
  loadDotEnv();
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!file) return { reason: 'GOOGLE_APPLICATION_CREDENTIALS not set' };
  let json;
  try { json = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return { reason: 'GOOGLE_APPLICATION_CREDENTIALS is not a readable JSON file' }; }
  if (!json || json.type !== 'service_account' || !json.client_email || !json.private_key) return { reason: 'file is not a service_account key' };
  return { key: json };
}

function signJwt(key, tokenUri) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: key.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 })}`;
  return `${input}.${crypto.sign('RSA-SHA256', Buffer.from(input), key.private_key).toString('base64url')}`;
}

async function resolve() {
  const { key } = loadKey();
  if (!key) return null;
  const tokenUri = key.token_uri || process.env.GEMBUFF_OAUTH_TOKEN_URL || DEFAULT_TOKEN_URI;
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signJwt(key, tokenUri) });
  const res = await fetch(tokenUri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`service-account token exchange ${res.status}: ${json.error_description || json.error || res.statusText}`);
  return { method: id, kind: 'bearer', value: json.access_token, projectId: key.project_id };
}

async function login() {
  console.log('Service account keys are long-lived secrets: anyone holding the file can act as the account.');
  console.log('1. In IAM & Admin > Service Accounts, create an account with only the roles it needs.');
  console.log('2. Create a JSON key in the console, or run:');
  console.log('   gcloud iam service-accounts keys create <file> --iam-account=<name>@<project>.iam.gserviceaccount.com');
  console.log('3. Store the file OUTSIDE the repo, or inside .gembuff/secrets (git-ignored).');
  console.log('4. Set GOOGLE_APPLICATION_CREDENTIALS=<absolute path> in the repo-root .env (git-ignored).');
  console.log('5. Verify: node bin/gembuff.js test --prefer service-account');
}

async function status() {
  const { key, reason } = loadKey();
  return key
    ? { configured: true, detail: `service account ${key.client_email}` }
    : { configured: false, detail: reason };
}

module.exports = { id, title, resolve, login, status, signJwt };

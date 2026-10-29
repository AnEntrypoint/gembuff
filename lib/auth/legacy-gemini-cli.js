'use strict';

// Gemini CLI Google login was retired for free individual users on 2026-06-18. Its credential file is never read or used.
const fs = require('fs');
const os = require('os');
const path = require('path');

const id = 'legacy-gemini-cli';
const title = 'Gemini CLI Google login (retired 2026-06-18 for free individual users; never used)';
const CREDS_FILE = path.join(os.homedir(), '.gemini', 'oauth_creds.json');

async function resolve() {
  return null;
}

async function login() {
  console.log('Gemini CLI Google login was retired for free individual users on 2026-06-18. This method is not used.');
  console.log('Use instead: api-key (AI Studio key), gcloud-adc, gcloud-headless, or service-account.');
}

async function status() {
  const present = fs.existsSync(CREDS_FILE);
  return { configured: false, detail: present ? 'present but retired 2026-06-18: not used' : 'not present; retired 2026-06-18, not used' };
}

module.exports = { id, title, resolve, login, status };

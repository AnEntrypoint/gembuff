'use strict';

const { loadDotEnv } = require('../config');

const id = 'api-key';
const title = 'Gemini API key from Google AI Studio (free tier, no billing needed)';

async function resolve() {
  loadDotEnv();
  const value = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!value) return null;
  return { method: id, kind: 'apikey', value };
}

async function login() {
  console.log('1. Open https://aistudio.google.com/app/apikey and create a key.');
  console.log('2. Put it in the repo-root .env file as GEMINI_API_KEY=...  (.env is git-ignored).');
  console.log('3. Run: node bin/gembuff.js test --prefer api-key');
}

async function status() {
  const cred = await resolve();
  return { configured: Boolean(cred), detail: cred ? 'GEMINI_API_KEY is set' : 'GEMINI_API_KEY not set in .env or environment' };
}

module.exports = { id, title, resolve, login, status };

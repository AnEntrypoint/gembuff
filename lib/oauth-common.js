'use strict';

const { loadDotEnv, readSecretJson, writeSecretJson } = require('./config');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const fileFor = method => `${method}.json`;
const SKEW_MS = 60 * 1000;

function clientCreds() {
  loadDotEnv();
  return { clientId: process.env.GEMBUFF_OAUTH_CLIENT_ID, clientSecret: process.env.GEMBUFF_OAUTH_CLIENT_SECRET };
}

async function postForm(url, params) {
  const body = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const postToken = params => postForm(process.env.GEMBUFF_OAUTH_TOKEN_URL || TOKEN_URL, params);

async function expectTokens(params) {
  const { status, body } = await postToken(params);
  if (status !== 200 || !body.access_token) throw new Error(`token endpoint ${status}: ${body.error || 'no access_token'}`);
  return body;
}

const exchangeCode = ({ code, verifier, redirectUri, clientId, clientSecret }) => expectTokens({
  grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret,
});

const refreshAccessToken = ({ refreshToken, clientId, clientSecret }) => expectTokens({
  grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret,
});

function storeTokens(method, tokens, base = {}) {
  const next = {
    ...(readSecretJson(fileFor(method)) || {}),
    ...base,
    access_token: tokens.access_token,
    expires_at: Date.now() + Number(tokens.expires_in || 3600) * 1000,
  };
  if (tokens.refresh_token) next.refresh_token = tokens.refresh_token;
  writeSecretJson(fileFor(method), next);
  return next;
}

async function resolveBearer(method) {
  const { clientId, clientSecret } = clientCreds();
  let stored = readSecretJson(fileFor(method));
  if (!clientId || !stored?.refresh_token) return null;
  if (!stored.access_token || !(stored.expires_at > Date.now() + SKEW_MS)) {
    stored = storeTokens(method, await refreshAccessToken({ refreshToken: stored.refresh_token, clientId, clientSecret }));
  }
  return { method, kind: 'bearer', value: stored.access_token };
}

function bearerStatus(method) {
  const { clientId } = clientCreds();
  const stored = readSecretJson(fileFor(method));
  if (!clientId) return { configured: false, detail: 'GEMBUFF_OAUTH_CLIENT_ID not set in .env' };
  if (!stored?.refresh_token) return { configured: false, detail: 'no refresh token in .gembuff/secrets/${fileFor(method)}; run login' };
  return { configured: true, detail: `refresh token stored (scope: ${stored.scope || 'unknown'})` };
}

module.exports = { clientCreds, postForm, postToken, exchangeCode, refreshAccessToken, storeTokens, resolveBearer, bearerStatus };

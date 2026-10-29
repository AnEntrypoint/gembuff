'use strict';

// Minimal Gemini Developer API client that accepts either an API key or an OAuth bearer token.
// Only uses fetch; no SDK, so every auth method is exercised by the same request shape.

const BASE = process.env.GEMBUFF_GEMINI_BASE || 'https://generativelanguage.googleapis.com/v1beta';

function headersFor(cred, projectId) {
  const headers = { 'content-type': 'application/json' };
  if (cred.kind === 'bearer') headers.authorization = `Bearer ${cred.value}`;
  if (projectId) headers['x-goog-user-project'] = projectId;
  return headers;
}

async function listModels(cred, { projectId } = {}) {
  const url = cred.kind === 'apikey'
    ? `${BASE}/models?pageSize=200&key=${encodeURIComponent(cred.value)}`
    : `${BASE}/models?pageSize=200`;
  const res = await fetch(url, { headers: headersFor(cred, projectId) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`models.list ${res.status}: ${body.error?.message || res.statusText}`);
  return body.models || [];
}

async function generate(cred, { model = 'gemini-2.5-flash', prompt, projectId } = {}) {
  const url = cred.kind === 'apikey'
    ? `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(cred.value)}`
    : `${BASE}/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headersFor(cred, projectId),
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`generateContent ${res.status}: ${body.error?.message || res.statusText}`);
  return body.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '';
}

module.exports = { BASE, listModels, generate };

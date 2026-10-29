'use strict';

const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
const common = require('../oauth-common');

const id = 'oauth-loopback';
const title = 'Your own Google account via browser OAuth (PKCE, loopback redirect)';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPE = ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/generative-language.retriever'].join(' ');
const TIMEOUT_MS = 5 * 60 * 1000;

const b64url = buf => buf.toString('base64url');
const challengeFor = verifier => b64url(crypto.createHash('sha256').update(verifier).digest());

async function beginLoopback({ clientId, clientSecret }) {
  const verifier = b64url(crypto.randomBytes(32));
  const state = b64url(crypto.randomBytes(16));
  let resolveDone, rejectDone, timer, redirectUri;
  const done = new Promise((res, rej) => { resolveDone = res; rejectDone = rej; });
  const settle = err => {
    clearTimeout(timer);
    server.close();
    if (err) rejectDone(err); else resolveDone();
  };
  const server = http.createServer((req, res) => {
    if (!server.listening) return res.writeHead(410).end();
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname !== '/callback') return res.writeHead(404).end();
    const reply = (status, text) => res.writeHead(status, { 'content-type': 'text/plain' }).end(text);
    const fail = (status, err) => { reply(status, 'login failed; see terminal'); settle(err); };
    if (u.searchParams.get('state') !== state) return fail(400, new Error('state mismatch'));
    if (u.searchParams.get('error')) return fail(400, new Error(`authorization error: ${u.searchParams.get('error')}`));
    const code = u.searchParams.get('code');
    if (!code) return fail(400, new Error('callback had no code'));
    common.exchangeCode({ code, verifier, redirectUri, clientId, clientSecret })
      .then(tokens => {
        if (!tokens.refresh_token) throw new Error('no refresh_token returned; remove the app at myaccount.google.com/permissions and retry');
        common.storeTokens(id, tokens, { client_id: clientId, scope: SCOPE });
        reply(200, 'Login complete. You can close this tab.');
        settle(null);
      })
      .catch(err => fail(500, err));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
  timer = setTimeout(() => settle(new Error('timed out after 5 minutes waiting for browser sign-in')), TIMEOUT_MS);
  const url = `${AUTH_URL}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: challengeFor(verifier),
    code_challenge_method: 'S256',
  })}`;
  return { url, done, redirectUri };
}

function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

async function login() {
  const { clientId, clientSecret } = common.clientCreds();
  if (!clientId || !clientSecret) throw new Error('set GEMBUFF_OAUTH_CLIENT_ID and GEMBUFF_OAUTH_CLIENT_SECRET in .env first (see examples/04-oauth-loopback)');
  const flow = await beginLoopback({ clientId, clientSecret });
  console.log(`Open this URL and sign in with your Google account:\n${flow.url}`);
  if (process.env.GEMBUFF_OPEN_BROWSER === '1') openBrowser(flow.url);
  await flow.done;
  console.log('Signed in. Refresh token saved to .gembuff/secrets/oauth-loopback.json. Next: node bin/gembuff.js test --prefer oauth-loopback');
}

module.exports = {
  id,
  title,
  resolve: () => common.resolveBearer(id),
  login,
  status: async () => common.bearerStatus(id),
  beginLoopback,
  challengeFor,
};

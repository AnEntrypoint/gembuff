'use strict';

const common = require('../oauth-common');

const id = 'oauth-device';
const title = 'Your Google account via device code (sign in on another device, no browser here)';
const SCOPE = 'openid email profile';
const DEVICE_URL = 'https://oauth2.googleapis.com/device/code';
const GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function login() {
  const { clientId, clientSecret } = common.clientCreds();
  if (!clientId) throw new Error('set GEMBUFF_OAUTH_CLIENT_ID in .env first (see examples/05-oauth-device)');
  const dev = await common.postForm(process.env.GEMBUFF_OAUTH_DEVICE_URL || DEVICE_URL, { client_id: clientId, scope: SCOPE });
  if (dev.status !== 200) throw new Error(`device code request failed: ${dev.body.error || dev.status}`);
  const d = dev.body;
  console.log(`Open ${d.verification_url || d.verification_uri} on any device and enter code: ${d.user_code}`);
  let wait = (d.interval || 5) * 1000;
  const deadline = Date.now() + (d.expires_in || 1800) * 1000;
  while (Date.now() < deadline) {
    await sleep(wait);
    const { status, body } = await common.postToken({ grant_type: GRANT, device_code: d.device_code, client_id: clientId, client_secret: clientSecret });
    if (status === 200 && body.access_token) {
      if (!body.refresh_token) throw new Error('no refresh_token returned');
      common.storeTokens(id, body, { client_id: clientId, scope: body.scope || SCOPE });
      console.log('Signed in. Refresh token saved to .gembuff/secrets/oauth-device.json. Next: node bin/gembuff.js test --prefer oauth-device');
      return;
    }
    if (body.error === 'authorization_pending') continue;
    if (body.error === 'slow_down') { wait += 5000; continue; }
    throw new Error(`device login failed: ${body.error || status}`);
  }
  throw new Error('device code expired before sign-in completed');
}

module.exports = {
  id,
  title,
  resolve: () => common.resolveBearer(id),
  login,
  status: async () => common.bearerStatus(id),
};

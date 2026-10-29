'use strict';

// Every auth method is a module in this folder exporting:
//   id          string, the CLI name (e.g. 'api-key')
//   title       string, one-line human description
//   resolve()   async -> { method, kind: 'apikey'|'bearer', value, projectId? } or null when not configured
//   login(args) async -> interactive or one-time setup; prints what it did, never prints secret values
//   status()    async -> { configured: boolean, detail: string } without network calls where possible
// Order here is the order `resolve()` tries methods when no preference is given.

const METHODS = [
  'api-key',
  'gcloud-adc',
  'gcloud-headless',
  'oauth-loopback',
  'oauth-device',
  'service-account',
  'wif-external',
  'legacy-gemini-cli',
];

function load(id) {
  return require(`./${id}`);
}

async function resolveCredential({ prefer } = {}) {
  const order = prefer ? [prefer] : METHODS;
  for (const id of order) {
    let mod;
    try {
      mod = load(id);
    } catch (err) {
      if (prefer) throw err;
      continue;
    }
    const cred = await mod.resolve().catch(err => {
      if (prefer) throw err;
      return null;
    });
    if (cred) return cred;
  }
  return null;
}

module.exports = { METHODS, load, resolveCredential };

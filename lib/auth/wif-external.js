'use strict';

// Workload Identity Federation for workloads outside Google Cloud: external OIDC subject token -> STS -> access token.
// Not run live yet.
const fs = require('fs');
const { loadDotEnv } = require('../config');

const id = 'wif-external';
const title = 'Workload Identity Federation (external OIDC subject token via STS)';
const STS_URL = 'https://sts.googleapis.com/v1/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

function readConfig() {
  loadDotEnv();
  const file = process.env.GOOGLE_EXTERNAL_ACCOUNT_CONFIG;
  if (!file) return { reason: 'GOOGLE_EXTERNAL_ACCOUNT_CONFIG not set' };
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return { reason: 'GOOGLE_EXTERNAL_ACCOUNT_CONFIG is not a readable JSON file' }; }
  if (!cfg || cfg.type !== 'external_account' || !cfg.audience) return { reason: 'file is not an external_account config with audience' };
  return { cfg };
}

function readSubjectToken(cs) {
  if (!cs?.file || !fs.existsSync(cs.file)) return { reason: 'credential_source.file missing or not found' };
  try {
    const raw = fs.readFileSync(cs.file, 'utf8').trim();
    const token = cs.format?.type === 'json' ? JSON.parse(raw)[cs.format.subject_token_field_name] : raw;
    return token ? { token } : { reason: 'subject token not found in credential_source.file' };
  } catch {
    return { reason: 'credential_source.file is not readable in the configured format' };
  }
}

async function resolve() {
  const { cfg } = readConfig();
  if (!cfg) return null;
  const { token: subject } = readSubjectToken(cfg.credential_source);
  if (!subject) return null;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    scope: SCOPE,
    audience: cfg.audience,
    subject_token_type: cfg.subject_token_type || 'urn:ietf:params:oauth:token-type:jwt',
    subject_token: subject,
  });
  const res = await fetch(STS_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`STS token exchange ${res.status}: ${json.error_description || json.error || res.statusText}`);
  return { method: id, kind: 'bearer', value: json.access_token, projectId: cfg.quota_project_id };
}

async function login() {
  console.log('Needs an external OIDC issuer you control or trust, e.g. GitHub Actions: https://token.actions.githubusercontent.com');
  console.log('1. gcloud iam workload-identity-pools create POOL_ID --location=global --display-name=gemlogin');
  console.log('2. gcloud iam workload-identity-pools providers create-oidc PROVIDER_ID --location=global --workload-identity-pool=POOL_ID --issuer-uri=ISSUER_URL --attribute-mapping=google.subject=assertion.sub');
  console.log('3. gcloud iam workload-identity-pools create-cred-config projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID --credential-source-file=SUBJECT_TOKEN_FILE --output-file=CONFIG_PATH [--service-account=SA_EMAIL]');
  console.log('   Check flags with: gcloud iam workload-identity-pools create-cred-config --help');
  console.log('4. Set GOOGLE_EXTERNAL_ACCOUNT_CONFIG=CONFIG_PATH in the repo-root .env (git-ignored).');
}

async function status() {
  const { cfg, reason } = readConfig();
  if (!cfg) return { configured: false, detail: reason };
  const { reason: subjectReason } = readSubjectToken(cfg.credential_source);
  if (subjectReason) return { configured: false, detail: subjectReason };
  return { configured: true, detail: 'external_account config and subject token present; STS exchange not run live (untested)' };
}

module.exports = { id, title, resolve, login, status };

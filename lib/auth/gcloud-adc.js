'use strict';

// gcloud application-default credentials. Default gcloud ADC scopes exclude generative-language,
// so Gemini calls return 403 "insufficient authentication scopes" unless login requests it (see explainScopeError).
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readSecretJson, writeSecretJson } = require('../config');

const id = 'gcloud-adc';
const title = 'gcloud application-default login (browser on this machine)';
const IS_WIN = process.platform === 'win32';
const GCLOUD = IS_WIN ? 'gcloud.cmd' : 'gcloud';
const SCOPES = 'https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/generative-language.retriever';
const MARKER = 'gcloud-adc-scopes.json';
const SCOPE_FIX = `gcloud auth application-default login --scopes=${SCOPES}`;

// Output is returned to callers only; never logged here (tokens flow through this).
function gcloud(args) {
  return new Promise(resolve => {
    execFile(GCLOUD, args, { shell: IS_WIN, windowsHide: true, timeout: 30000 }, (err, stdout, stderr) => {
      const missing = Boolean(err) && (err.code === 'ENOENT' || /not (recognized|found)/i.test(String(stderr)));
      resolve({ ok: !err, out: String(stdout || '').trim(), missing });
    });
  });
}

async function resolve() {
  const [tok, proj] = await Promise.all([
    gcloud(['auth', 'application-default', 'print-access-token']),
    gcloud(['config', 'get-value', 'project']),
  ]);
  if (!tok.ok || !tok.out) return null;
  const projectId = proj.ok && proj.out && proj.out !== '(unset)' ? proj.out : undefined;
  return { method: id, kind: 'bearer', value: tok.out, projectId };
}

// Validated because on Windows the args reach cmd.exe through shell:true.
function quotaProject(args) {
  const i = args.indexOf('--quota-project');
  const eq = args.find(a => String(a).startsWith('--quota-project='));
  const value = i >= 0 ? args[i + 1] : eq && eq.slice('--quota-project='.length);
  if (value === undefined) return undefined;
  if (!/^[a-z0-9-]{4,63}$/i.test(value)) throw new Error('--quota-project must be a plain project id');
  return value;
}

function adcFile() {
  const dir = process.env.CLOUDSDK_CONFIG || (IS_WIN ? path.join(process.env.APPDATA || '', 'gcloud') : path.join(os.homedir(), '.config', 'gcloud'));
  return path.join(dir, 'application_default_credentials.json');
}

function loginWith(extra, args = []) {
  const quota = quotaProject(args);
  const cmd = ['auth', 'application-default', 'login', `--scopes=${SCOPES}`, ...extra];
  if (quota) cmd.push(`--project=${quota}`);
  return new Promise((done, fail) => {
    const child = spawn(GCLOUD, cmd, { stdio: 'inherit', shell: IS_WIN });
    child.on('error', fail);
    child.on('exit', code => {
      if (code !== 0) return fail(new Error(`gcloud login exited ${code}`));
      writeSecretJson(MARKER, { generativeLanguage: true, scopes: SCOPES.split(','), quotaProject: quota || null, at: new Date().toISOString() });
      console.log('Login complete. Verify: node bin/gembuff.js test --prefer gcloud-adc');
      done();
    });
  });
}

async function login(args = []) {
  return loginWith([], args);
}

function scopeDetail() {
  let marker = null;
  try { marker = readSecretJson(MARKER); } catch { /* corrupt marker: treat as absent */ }
  return marker?.generativeLanguage
    ? 'generative-language scope requested at login'
    : 'no generative-language scope recorded: Gemini will 403 until login is re-run';
}

async function status() {
  const ver = await gcloud(['--version']);
  if (!ver.ok) return { configured: false, detail: ver.missing ? 'gcloud not found on PATH' : 'gcloud --version failed' };
  // print-account does not exist in SDK 489, and ADC contents are never read: existence of the file is the offline check.
  if (!fs.existsSync(adcFile())) return { configured: false, detail: 'gcloud present; no application-default credentials (run login)' };
  const acct = await gcloud(['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)']);
  const who = acct.ok && acct.out ? acct.out.split('\n')[0] : 'account unknown';
  return { configured: true, detail: `ADC present (gcloud account ${who}); ${scopeDetail()}` };
}

function explainScopeError(err) {
  if (!/insufficient authentication scopes/i.test(String(err?.message))) return err;
  const e = new Error(`${err.message}\ngcloud ADC token lacks the generative-language scope. Fix: ${SCOPE_FIX} (not verified live whether Google grants this scope to the gcloud client).`);
  e.cause = err;
  return e;
}

module.exports = { id, title, resolve, login, status, loginWith, explainScopeError, SCOPES };

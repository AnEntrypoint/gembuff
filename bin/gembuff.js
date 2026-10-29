#!/usr/bin/env node
'use strict';

const { METHODS, load, resolveCredential } = require('../lib/auth');
const { loadDotEnv } = require('../lib/config');
const gemini = require('../lib/gemini');

const [, , cmd = 'help', ...rest] = process.argv;

function flag(name) {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}

async function doctor() {
  loadDotEnv();
  for (const id of METHODS) {
    let s;
    try {
      s = await load(id).status();
    } catch (err) {
      s = { configured: false, detail: `error: ${err.message}` };
    }
    console.log(`${s.configured ? 'OK  ' : '--  '} ${id.padEnd(18)} ${s.detail}`);
  }
}

async function test() {
  loadDotEnv();
  const prefer = flag('--prefer');
  const cred = await resolveCredential({ prefer });
  if (!cred) {
    console.error(prefer ? `method "${prefer}" is not configured` : 'no method is configured; run: node bin/gembuff.js doctor');
    process.exit(1);
  }
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GEMBUFF_PROJECT || undefined;
  const explain = cred.method.startsWith('gcloud') ? require('../lib/auth/gcloud-adc').explainScopeError : e => e;
  try {
    const models = await gemini.listModels(cred, { projectId });
    console.log(`method=${cred.method} kind=${cred.kind} models=${models.length}`);
    const reply = await gemini.generate(cred, { prompt: 'Reply with exactly: pong', projectId });
    console.log(`generate -> ${reply.trim()}`);
  } catch (err) {
    throw explain(err);
  }
}

async function login() {
  loadDotEnv();
  const id = rest[0];
  if (!id || !METHODS.includes(id)) {
    console.error(`usage: gembuff login <${METHODS.join('|')}>`);
    process.exit(2);
  }
  await load(id).login(rest.slice(1));
}

async function serve() {
  loadDotEnv();
  const cred = await resolveCredential({ prefer: flag('--prefer') });
  if (!cred || cred.kind !== 'apikey') {
    console.error('serve needs an API-key credential (acptoapi reads GEMINI_API_KEY); run: node bin/gembuff.js login api-key');
    process.exit(1);
  }
  const bin = require.resolve('acptoapi/package.json').replace(/package\.json$/, 'bin/acptoapi.js');
  const child = require('child_process').spawn(process.execPath, [bin], {
    stdio: 'inherit',
    env: { ...process.env, GEMINI_API_KEY: cred.value },
  });
  child.on('exit', code => process.exit(code ?? 0));
}

function help() {
  console.log(`gembuff: free ways to sign into Google and call Google APIs

  node bin/gembuff.js doctor                 show which methods are configured (no network)
  node bin/gembuff.js login <method>         one-time setup for a method (see examples/)
  node bin/gembuff.js test [--prefer <m>]    resolve a credential and make a real Gemini call
  node bin/gembuff.js serve [--prefer <m>]   run acptoapi with the resolved API key

methods: ${METHODS.join(', ')}`);
}

const commands = { doctor, test, login, serve, help };
(commands[cmd] || help)().catch(err => {
  console.error(`gembuff: ${err.message}`);
  process.exit(1);
});

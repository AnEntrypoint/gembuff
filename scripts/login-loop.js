#!/usr/bin/env node
'use strict';

// Drives one browser sign-in end to end, then verifies it with a real Gemini call.
// You sign in and approve consent yourself in your own browser; this script never
// touches passwords, 2FA codes, or tokens. It only starts the flow, retries a failed
// attempt, and runs `gembuff test` when the flow reports success.
//
// Usage: node scripts/login-loop.js <oauth-loopback|gcloud-adc|gcloud-headless> [--attempts 3] [--dry-run]

const { spawnSync } = require('child_process');
const path = require('path');

const METHODS = ['oauth-loopback', 'gcloud-adc', 'gcloud-headless'];
const CLI = path.join(__dirname, '..', 'bin', 'gembuff.js');
const SCOPE_403 = /insufficient authentication scopes/i;

function run(args, env = {}, capture = false) {
  return spawnSync(process.execPath, [CLI, ...args], {
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function main() {
  const method = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  const attemptsArg = process.argv.indexOf('--attempts');
  const attempts = attemptsArg > 0 ? Number(process.argv[attemptsArg + 1]) : 3;

  if (!METHODS.includes(method)) {
    console.error(`usage: login-loop.js <${METHODS.join('|')}> [--attempts N] [--dry-run]`);
    process.exit(2);
  }

  const loginEnv = method === 'oauth-loopback' ? { GEMBUFF_OPEN_BROWSER: '1' } : {};
  if (dryRun) {
    console.log(`would run: gembuff login ${method} (env ${JSON.stringify(loginEnv)}), up to ${attempts} attempts`);
    console.log(`then: gembuff test --prefer ${method}`);
    return;
  }

  for (let i = 1; i <= attempts; i++) {
    console.log(`\n[login-loop] attempt ${i}/${attempts}: ${method}`);
    const login = run(['login', method], loginEnv);
    if (login.status === 0) break;
    if (i === attempts) {
      console.error(`[login-loop] login failed after ${attempts} attempts; fix the cause above and re-run`);
      process.exit(1);
    }
    console.log('[login-loop] login did not complete; retrying');
  }

  const test = run(['test', '--prefer', method], {}, true);
  const output = `${test.stdout || ''}${test.stderr || ''}`;
  process.stdout.write(output);
  if (test.status === 0) {
    console.log(`[login-loop] verified: ${method} can call Gemini`);
    return;
  }
  if (SCOPE_403.test(output)) {
    console.error('[login-loop] login worked but the token lacks the generative-language scope; retrying will not help. Re-run with the scopes shown above.');
  } else {
    console.error('[login-loop] verification failed; see the error above');
  }
  process.exit(1);
}

main();

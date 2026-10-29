#!/usr/bin/env node
'use strict';

// Usage:
//   node scripts/secret-scan.js --staged     scan what the next commit would add
//   node scripts/secret-scan.js --tracked    scan every tracked file
//   node scripts/secret-scan.js --history    scan every added line in git history
// Exits 1 on any hit. A line containing "secret-scan:allow" is skipped (use only for fake fixtures).

const { execFileSync } = require('child_process');

const BLOCKED_PATHS = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)/,
  /(^|\/)\.gembuff\//,
  /(^|\/)secrets\//,
  /\.(pem|key|p12)$/,
  /service[-_]account.*\.json$/i,
  /application_default_credentials\.json$/,
  /oauth_creds\.json$/,
  /(^|\/)oauth(-[a-z]+)?\.json$/,
  /(^|\/)tokens\//,
  /\.token$/,
  /credentials\.db$/,
  /access_tokens\.db$/,
];

const CONTENT_RULES = [
  ['google-api-key', /AIza[0-9A-Za-z_-]{35}/],
  ['google-oauth-access-token', /ya29\.[0-9A-Za-z_-]{20,}/],
  ['google-refresh-token', /(?<![\w/])1\/\/[0-9A-Za-z_-]{30,}/],
  ['google-client-secret', /GOCSPX-[0-9A-Za-z_-]{20,}/],
  ['private-key-block', /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['service-account-json', /"type"\s*:\s*"service_account"/],
  ['service-account-key-id', /"private_key_id"\s*:\s*"[0-9a-f]{20,}"/],
  ['assigned-secret', /\b(client_secret|refresh_token|access_token|api[_-]?key|password)\b["']?\s*[:=]\s*["']?(?=[A-Za-z0-9_./+-]*\d)[A-Za-z0-9_./+-]{24,}/i],
];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

function pathHits(file) {
  return BLOCKED_PATHS.some(re => re.test(file));
}

function scanText(label, text, out) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes('secret-scan:allow')) return;
    for (const [rule, re] of CONTENT_RULES) {
      if (re.test(line)) out.push(`${label}:${i + 1} [${rule}]`);
    }
  });
}

function scanStaged() {
  const out = [];
  const files = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);
  for (const f of files) {
    if (pathHits(f)) out.push(`${f} [blocked-path]`);
    else scanText(f, git(['show', `:${f}`]), out);
  }
  return out;
}

function scanTracked() {
  const out = [];
  for (const f of git(['ls-files', '-z']).split('\0').filter(Boolean)) {
    if (pathHits(f)) out.push(`${f} [blocked-path]`);
    else {
      try {
        scanText(f, require('fs').readFileSync(f, 'utf8'), out);
      } catch {
        out.push(`${f} [unreadable]`);
      }
    }
  }
  return out;
}

function scanHistory() {
  const out = [];
  const log = git(['log', '--all', '-p', '--no-color', '--diff-filter=ACMR', '--format=commit %H']);
  let commit = '';
  for (const line of log.split(/\r?\n/)) {
    if (line.startsWith('commit ')) {
      commit = line.slice(7, 15);
      continue;
    }
    if (line.startsWith('+++ b/') && pathHits(line.slice(6))) out.push(`${commit} ${line.slice(6)} [blocked-path]`);
    if (line.startsWith('+') && !line.startsWith('+++')) scanText(`${commit}`, line.slice(1), out);
  }
  return out;
}

function main() {
  const mode = process.argv[2];
  const runners = { '--staged': scanStaged, '--tracked': scanTracked, '--history': scanHistory };
  if (!runners[mode]) {
    console.error('usage: secret-scan.js --staged | --tracked | --history');
    process.exit(2);
  }
  const hits = runners[mode]();
  if (hits.length) {
    console.error(`secret-scan ${mode}: ${hits.length} hit(s), commit blocked`);
    for (const h of hits) console.error('  ' + h);
    process.exit(1);
  }
  console.log(`secret-scan ${mode}: clean`);
}

module.exports = { CONTENT_RULES, BLOCKED_PATHS, scanText, pathHits };

if (require.main === module) main();

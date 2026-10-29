# gembuff

Every free way to sign a person into Google and call Google APIs without paying extra, each as a runnable example, plus one CLI that finds a working credential and makes a real call.

Nothing here stores your login in git. Credentials live in `.env` or `.gembuff/secrets/`, both git-ignored, and a pre-commit hook blocks anything that looks like a token.

## Methods

| # | Method | Free? | Needs | Live status |
|---|---|---|---|---|
| 01 | [AI Studio API key](examples/01-ai-studio-api-key/README.md) | Yes, free tier | Key from aistudio.google.com | Not run yet |
| 02 | [gcloud ADC browser login](examples/02-gcloud-adc/README.md) | Yes | gcloud SDK | Token obtained; Gemini call returned 403 insufficient scopes, needs the generative-language scope |
| 03 | [gcloud headless login](examples/03-gcloud-headless/README.md) | Yes | gcloud SDK, any second device | Same scope issue as 02 |
| 04 | [OAuth desktop client (loopback)](examples/04-oauth-loopback/README.md) | Yes | Your own Desktop OAuth client | Not run yet |
| 05 | [OAuth device code](examples/05-oauth-device/README.md) | Yes | Your own OAuth client | Scope limits apply |
| 06 | [Service account key](examples/06-service-account/README.md) | Yes | Key file outside the repo | Not run yet |
| 07 | [Workload Identity Federation](examples/07-workload-identity-federation/README.md) | Yes | An external OIDC issuer | Not run yet |
| 08 | [Legacy Gemini CLI login](examples/08-legacy-gemini-cli/README.md) | No: retired 2026-06-18 | Nothing | Detected, never used |

Not included on purpose: reusing a browser's Google session cookies, or scripting Google's login page. Google blocks automated sign-in, and copying session tokens out of a profile is credential theft in practice.

## Quick start

```bash
npm install            # pulls acptoapi from github:AnEntrypoint/acptoapi
npm run hooks         # enable the pre-commit secret guard
cp .env.example .env   # fill in only the methods you use
node bin/gembuff.js doctor
node bin/gembuff.js test
```

`test` tries methods in the order listed in `lib/auth/index.js` and makes one real `generateContent` call with the first that works. Use `--prefer <method>` to force one.

## Office setup (Google Workspace accounts)

Each person signs in with their own Workspace account on their own machine. Nobody shares a login or a quota.

1. **Once, by a Workspace admin:** in Google Cloud Console, create an OAuth client of type *Desktop app* under an *Internal* consent screen for the organization. Internal limits sign-in to the domain and avoids the 7-day refresh-token expiry of Testing mode. Put the client ID and secret in each person’s `.env` as `GEMBUFF_OAUTH_CLIENT_ID` and `GEMBUFF_OAUTH_CLIENT_SECRET`.
2. **Each person, once:** `npm run login:loop -- oauth-loopback`. The browser opens, they sign in with their Workspace account and approve consent. The loop then makes a real Gemini call to confirm.
3. **Fallback without a browser sign-in:** `npm run login:loop -- api-key` after pasting a personal AI Studio key into `.env`.

Tokens stay in `.gembuff/secrets/oauth-loopback.json` on that person’s machine and are never committed.

## Serving through acptoapi

```bash
node bin/gembuff.js serve --prefer api-key
```

acptoapi exposes OpenAI, Anthropic and Gemini compatible endpoints on port 4800. It reads `GEMINI_API_KEY`, so only the API-key method feeds it directly. The bearer-token methods are for direct calls through `lib/gemini.js`.

## Keeping secrets out of git

- `.gitignore` excludes `.env`, `.gembuff/`, key files, token stores and gcloud and Gemini CLI credential files.
- `scripts/secret-scan.js` runs as a pre-commit hook (`--staged`), over tracked files (`--tracked`), and over every commit in history (`--history`). Run all three before any push: `npm run check-secrets`.
- Never paste a key into a chat, issue or commit message. If one leaks, revoke it at its source (AI Studio, Cloud Console, or `gcloud auth application-default revoke`).

## Tests

```bash
npm test
```

## License

MIT

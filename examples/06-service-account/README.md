# 06 Service account JSON key

**What:** A Google Cloud service account key file. `resolve()` signs an RS256 JWT (iss = client_email, scope = cloud-platform, aud = token_uri, 1 hour), exchanges it at the token endpoint with the jwt-bearer grant, and uses the access token as a Bearer credential.

**Cost:** Free within Gemini API quota. Creating the key and the service account has no charge.

## Commands

```
gcloud iam service-accounts create gemlogin --project=YOUR_PROJECT_ID
gcloud iam service-accounts keys create /absolute/path/outside/repo/sa.json --iam-account=gemlogin@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

In the repo-root `.env` (git-ignored):

```
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/outside/repo/sa.json
```

Verify: `node bin/gembuff.js test --prefer service-account`

## Risk

A downloaded key is a **long-lived secret**. Anyone holding the file can act as the service account until the key is deleted. Keep it outside the repo or in `.gembuff/secrets` (git-ignored), grant only the roles needed, rotate keys, and delete unused ones (`gcloud iam service-accounts keys delete`). Never paste the key into chat, logs, or commits.

Whether the Gemini API accepts a service-account-derived token with only the cloud-platform scope is **not verified**. Grant the generative-language API and test before relying on it.

## Status

status: not verified. The JWT construction and token exchange are covered by offline tests against a fake token server (`node --test test/service-account.test.js`). No real Google endpoint has been called.

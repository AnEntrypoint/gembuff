# 02 gcloud application-default credentials

**What:** Uses your Google account through gcloud's application-default credentials (ADC). `resolve()` runs `gcloud auth application-default print-access-token` and sends the token as a Bearer credential to the Gemini API.

**Cost:** Free within Gemini API quota for the project.

## Commands

```
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/generative-language.retriever
gcloud config set project YOUR_PROJECT_ID
gcloud services enable generativelanguage.googleapis.com
node bin/gembuff.js test --prefer gcloud-adc
```

## Known issue: 403 insufficient scopes

Observed live: with the default gcloud ADC token (no `generative-language` scope), the Gemini API returned `403 PERMISSION_DENIED: Request had insufficient authentication scopes.`

Fix: re-run the login with the scopes above. `status()` reports whether login recorded the scope. Google's acceptance of the `generative-language.retriever` scope for the gcloud OAuth client is **not verified**.

## Status

status: partially verified. The default-scope token was observed returning 403 live. The scoped login and the Gemini call after it are not verified.

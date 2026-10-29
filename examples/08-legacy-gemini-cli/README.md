# 08 Legacy Gemini CLI login (retired)

**What:** The Google login used by the Gemini CLI, which stored credentials in `~/.gemini/oauth_creds.json`.

**Status of the service:** Retired for free individual users on 2026-06-18.

**Cost:** Not applicable. This method is not used.

## Behavior in this repo

- `resolve()` always returns null. The stored credential is never read or sent.
- `status()` checks only whether the file exists and reports `present but retired 2026-06-18: not used`.
- `login()` prints the retirement notice and points to api-key, gcloud-adc, gcloud-headless, or service-account.

Use example 01 (AI Studio API key), 02, 03, or 06 instead.

## Status

status: verified by code reading only. The file is detected by existence, and its contents are never read. The retirement date is taken from the project brief, not re-checked against Google.

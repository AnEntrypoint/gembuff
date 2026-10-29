# 01: AI Studio API key (free tier)

**What it is:** a Gemini API key created in Google AI Studio. No Google Cloud project, no billing account, and no OAuth consent screen.

**Cost:** free tier, no payment method. Free-tier models and per-minute and per-day limits change; check the current table at https://ai.google.dev/gemini-api/docs/rate-limits before depending on a number.

**Caveat:** free-tier prompts may be used by Google to improve products outside the EEA, Switzerland and the UK. Do not send private data through the free tier.

## Steps

1. Open https://aistudio.google.com/app/apikey and create a key.
2. Copy `.env.example` to `.env` in the repo root and set `GEMINI_API_KEY=<your key>`.
3. Check it resolves:

   ```bash
   node bin/gembuff.js doctor
   ```

4. Make a real call:

   ```bash
   node bin/gembuff.js test --prefer api-key
   ```

   Expected output: `method=api-key kind=apikey models=<n>` then `generate -> pong`.

5. Optional: serve the key as an OpenAI, Anthropic and Gemini compatible endpoint through acptoapi:

   ```bash
   node bin/gembuff.js serve --prefer api-key
   ```

## Status

Not run live from this repo yet. The request shape follows the documented `generateContent` endpoint with `?key=`.

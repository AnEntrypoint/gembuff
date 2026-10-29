# 03 gcloud headless login

**What:** The same gcloud ADC token as example 02, for machines without a browser (SSH, containers, CI sessions). `login` runs `gcloud auth application-default login --no-launch-browser`: gcloud prints a URL, you open it on any device, sign in, and paste the code back.

**Cost:** Free within Gemini API quota for the project.

## Commands

```
gcloud auth application-default login --no-launch-browser --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/generative-language.retriever
gcloud config set project YOUR_PROJECT_ID
node bin/gembuff.js test --prefer gcloud-headless
```

## Known issue: 403 insufficient scopes

Same as example 02. The default gcloud ADC scopes exclude `generative-language`, which produced `403 Request had insufficient authentication scopes` live. Re-run login with the scopes above. Whether Google grants that scope to the gcloud client is **not verified**.

## Status

status: not verified. The headless flow itself has not been run. It shares the token path of example 02, which is only partially verified.

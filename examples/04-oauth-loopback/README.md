# 04: OAuth loopback (your own Google account, browser sign-in)

Signs in as your Google account from a browser on this machine. The refresh token is stored in `.gembuff/secrets/oauth-loopback.json` (git-ignored, mode 0600). No API key is needed.

Status: this flow has not been run live. The steps below come from the code and Google's console layout, not from a completed login.

## Steps

1. Create a Google Cloud project at https://console.cloud.google.com/projectcreate.
2. Enable the Generative Language API: APIs & Services > Library > "Generative Language API" > Enable.
3. Configure the consent screen: APIs & Services > OAuth consent screen. Choose User type **External**, fill in the app name and support email, and add your own Google account under **Test users**. Leave publishing status as **Testing**.
4. Create the client: APIs & Services > Credentials > Create credentials > OAuth client ID > Application type **Desktop app**. Copy the client ID and client secret.
5. In the repo-root `.env` file add:
   ```
   GEMBUFF_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GEMBUFF_OAUTH_CLIENT_SECRET=your-client-secret
   ```
6. Run the login:
   ```
   node bin/gembuff.js login oauth-loopback
   ```
   It prints a URL. Open it, sign in with a test user, and approve. Set `GEMBUFF_OPEN_BROWSER=1` to have the URL opened for you. The login waits up to 5 minutes for the redirect.
7. Test the credential:
   ```
   node bin/gembuff.js test --prefer oauth-loopback
   ```

## Notes

- Scopes requested: `https://www.googleapis.com/auth/cloud-platform` and `https://www.googleapis.com/auth/generative-language.retriever`.
- The redirect uses a random free port on 127.0.0.1. Desktop clients need no redirect URI registration.
- Apps in Testing status issue refresh tokens that expire after 7 days. When `test` fails with `invalid_grant`, run step 6 again.
- If `test` reports a quota or project error, set `GOOGLE_CLOUD_PROJECT` in `.env` to your project ID. This is untested.

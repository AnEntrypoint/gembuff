# 05: OAuth device code (sign in on another device)

Uses Google's device-code flow: the CLI prints a URL and a code, and you enter the code on any device with a browser. No browser is needed on this machine. The refresh token is stored in `.gembuff/secrets/oauth-device.json`, separate from `oauth-loopback.json`.

Status: this flow has not been run live. Google's device-flow guidance (https://developers.google.com/youtube/v3/guides/auth/devices) says that apps on Windows, Linux or macOS with a browser should use the desktop flow instead, so on this machine prefer `oauth-loopback`. Use this example only for devices without a browser. Google publishes a restricted "allowed scopes for installed apps or devices" list; generative-language is not confirmed on it.

## Steps

1. Create a Google Cloud project and configure the consent screen as in `examples/04-oauth-loopback/README.md`, steps 1 to 3.
2. Create the client: APIs & Services > Credentials > Create credentials > OAuth client ID. Choose the application type for TVs and limited-input devices (the device-code client type). Copy the client ID and client secret. Check the exact type name on Google's page https://developers.google.com/identity/protocols/oauth2/limited-input-device before you rely on it.
3. In the repo-root `.env` file add:
   ```
   GEMBUFF_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GEMBUFF_OAUTH_CLIENT_SECRET=your-client-secret
   ```
4. Run the login:
   ```
   node bin/gembuff.js login oauth-device
   ```
   It prints a verification URL and a user code. Open the URL on any device, enter the code, and sign in with a test user.
5. Test the credential:
   ```
   node bin/gembuff.js test --prefer oauth-device
   ```

## Notes

- The scope requested is `openid email profile`. Generative-language scopes are not supported on this flow as far as this example knows. A token from this flow identifies the user but is not expected to call the Gemini API, so step 5 will probably fail. Verify the supported scope list on the Google page above before relying on this method.
- Each OAuth method keeps its own token file, so a device login does not overwrite a loopback login.
- Apps in Testing status issue refresh tokens that expire after 7 days. Run step 4 again when a refresh fails with `invalid_grant`.

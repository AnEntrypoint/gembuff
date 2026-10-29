# 07 Workload Identity Federation (external workloads)

**What:** For workloads outside Google Cloud (for example GitHub Actions). The workload presents an OIDC token, `resolve()` exchanges it at `https://sts.googleapis.com/v1/token` (token-exchange grant, scope cloud-platform, audience from the config), and uses the result as a Bearer credential. No long-lived key is stored.

**Cost:** Free within Gemini API quota. Workload Identity Federation itself has no charge.

## Commands

Requires an OIDC issuer you control or trust (e.g. `https://token.actions.githubusercontent.com`).

```
gcloud iam workload-identity-pools create POOL_ID --location=global --display-name=gemlogin
gcloud iam workload-identity-pools providers create-oidc PROVIDER_ID --location=global --workload-identity-pool=POOL_ID --issuer-uri=ISSUER_URL --attribute-mapping=google.subject=assertion.sub
gcloud iam workload-identity-pools create-cred-config projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID --credential-source-file=SUBJECT_TOKEN_FILE --output-file=/absolute/path/config.json [--service-account=SA_EMAIL]
```

Check the exact flags with `gcloud iam workload-identity-pools create-cred-config --help`.

In `.env`:

```
GOOGLE_EXTERNAL_ACCOUNT_CONFIG=/absolute/path/config.json
```

The subject token file must exist and contain a fresh token; the workload is responsible for writing it. If `credential_source.file` is missing, `status()` reports it and `resolve()` returns null.

Verify: `node bin/gembuff.js test --prefer wif-external`

## Caveats

- If the config includes `service_account_impersonation_url`, this module does not perform the second impersonation call. The federated token is used as-is.
- Whether the Gemini API accepts federated tokens is **not verified**.

## Status

status: not verified. The code has not been run against STS or a real pool. Only the config and subject-file checks in `status()` are offline-testable.

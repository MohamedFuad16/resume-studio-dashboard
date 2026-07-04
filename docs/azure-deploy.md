# Compile/research backend on Azure (always-on)

Render's free tier **sleeps after ~15 min idle**, so the first search/compile after a
break cold-starts (~30–60 s) and can fail ("company research failed"). Azure Container
Apps with **min replicas = 1** stays warm — no cold starts. Same Docker image as Render.

Prereqs: an Azure account (you have credits), the `az` CLI (`brew install azure-cli`),
`az login`.

## One-time deploy (from the repo root)

> **Do NOT use `az containerapp up --source .`** — it ignores our root `Dockerfile`,
> falls back to Oryx buildpacks, and fails with *"Could not detect the language from
> repo"* (this is a monorepo with no root `package.json`). Build the image explicitly
> from the `Dockerfile` with `az acr build`, then create the app from that image.

```bash
# 1. Resource group + Container Apps environment + registry (one-time).
az group create -n internship-portal -l japaneast
az acr create -n <uniqueacrname> -g internship-portal --sku Basic --admin-enabled true
az containerapp env create -n portal-compile-env -g internship-portal -l japaneast

# 2. Build the Dockerfile in the cloud (ACR Task — no local Docker needed).
#    --file Dockerfile forces our Dockerfile instead of language auto-detection.
#    ACR build agents are amd64, so no --platform flag is needed (and an inline
#    `FROM --platform=…` breaks ACR's dependency scanner — keep the FROM plain).
az acr build --registry <uniqueacrname> --image portal-compile:latest --file Dockerfile .

# 3. Create the Container App from the pushed image.
#    --min-replicas 1 = always-on (no cold starts); 1 vCPU / 2 GiB for Tectonic.
az containerapp create \
  -n portal-compile \
  -g internship-portal \
  --environment portal-compile-env \
  --image <uniqueacrname>.azurecr.io/portal-compile:latest \
  --registry-server <uniqueacrname>.azurecr.io \
  --ingress external \
  --target-port 8080 \
  --min-replicas 1 --max-replicas 2 --cpu 1.0 --memory 2.0Gi \
  --env-vars RESUME_FONT_PROFILE=linux RESUME_STUDIO_APP_ORIGIN=https://editor-omega-two.vercel.app

# 4. Get the public URL:
az containerapp show -n portal-compile -g internship-portal \
  --query properties.configuration.ingress.fqdn -o tsv
#   → e.g. portal-compile.<hash>.japaneast.azurecontainerapps.io
```

## Point the frontend at it

In the **Vercel** project (`editor`) → Settings → Environment Variables, set
`VITE_API_BASE_URL = https://<the fqdn from step 4>` (Production), then redeploy:
`cd editor && vercel --prod`.

## Notes
- **Request timeout**: Container Apps ingress allows long requests; research runs async
  (the start call returns immediately, the client polls), and the LLM call is an outbound
  request, so gpt-5-mini's ~60–140 s search is fine.
- **CORS**: the server trusts `editor-omega-two.vercel.app` + `RESUME_STUDIO_APP_ORIGIN`.
- **Optional env**: `OPENROUTER_API_KEY` (server-side research fallback — the client also
  sends the user's own key), `BLOB_READ_WRITE_TOKEN` (share the Vercel Blob for catalog
  persistence).
- Always-on min-replicas=1 has a small ongoing cost (covered by your credits). To pause,
  set `--min-replicas 0` (reintroduces cold starts).
- Redeploy after code changes: re-run `az containerapp up --source . -n portal-compile -g internship-portal`.

# Compile/research backend on Azure (always-on)

> ⚠️ **Which app is live:** there are TWO container apps in resource group
> `internship-portal` — `portal-compile` (westus2) and **`portal-compile-jp`
> (japaneast)**. **`-jp` is the live one**: it holds the Gmail OAuth token + action
> queue on an Azure Files mount (`internshipportaljpdata/resume-studio-data`), so it
> is the only one that must stay running. Its public FQDN is
> `portal-compile-jp.redgrass-10389803.japaneast.azurecontainerapps.io`, and that is
> what `VITE_API_BASE_URL` (Vercel) and iOS's `PortalAPIBaseURL` must point at.
> **All deploys target `-jp`** — the generic `portal-compile` name in the one-time
> recipe below is a placeholder; substitute `portal-compile-jp` when updating prod.

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
#    --max-replicas 1 is REQUIRED, not a cost knob: the live-research job state is an
#    in-memory Map on the server, so the POST that starts a job and the GET polls that
#    read it MUST hit the same replica. With >1 replica, ingress round-robins and a poll
#    can land on a replica that never saw the job → 404 "Research job not found" → the UI
#    reads it as "search failed". Keep min = max = 1.
az containerapp create \
  -n portal-compile \
  -g internship-portal \
  --environment portal-compile-env \
  --image <uniqueacrname>.azurecr.io/portal-compile:latest \
  --registry-server <uniqueacrname>.azurecr.io \
  --ingress external \
  --target-port 8080 \
  --min-replicas 1 --max-replicas 1 --cpu 1.0 --memory 2.0Gi \
  --env-vars RESUME_FONT_PROFILE=linux RESUME_STUDIO_APP_ORIGIN=https://editor-omega-two.vercel.app INTERNSHIP_RESEARCH_TIMEOUT_MS=280000

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
- **Single replica is mandatory** (see step 3): research jobs are held in memory, so all
  requests for a job must hit the same replica. `--max-replicas 1`. Verify/repair with:
  `az containerapp update -n portal-compile -g internship-portal --min-replicas 1 --max-replicas 1`.
- **Research timeout**: gpt-5-mini with `:online` web search realistically runs 120–245 s.
  The LLM call is capped by `INTERNSHIP_RESEARCH_TIMEOUT_MS` (default 280000 ms); if slow
  searches error out, raise it. Research is async (POST returns 202, the client polls
  indefinitely), so no ingress request-timeout applies to the wait.
- **CORS**: the server trusts `editor-omega-two.vercel.app` + `RESUME_STUDIO_APP_ORIGIN`.
- **Optional env**: `OPENROUTER_API_KEY` (server-side research fallback — the client also
  sends the user's own key), `BLOB_READ_WRITE_TOKEN` (share the Vercel Blob for catalog
  persistence).
- Always-on min-replicas=1 has a small ongoing cost (covered by your credits). To pause,
  set `--min-replicas 0 --max-replicas 0` (reintroduces cold starts).
- Redeploy after code changes (target the LIVE `-jp` app): `az acr build --registry
  <acr> --image portal-compile:latest --file Dockerfile .` then `az containerapp update
  -n portal-compile-jp -g internship-portal --image <acr>.azurecr.io/portal-compile:latest`.

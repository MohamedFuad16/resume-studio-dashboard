# Compile/research backend on Azure (always-on)

Render's free tier **sleeps after ~15 min idle**, so the first search/compile after a
break cold-starts (~30–60 s) and can fail ("company research failed"). Azure Container
Apps with **min replicas = 1** stays warm — no cold starts. Same Docker image as Render.

Prereqs: an Azure account (you have credits), the `az` CLI (`brew install azure-cli`),
`az login`.

## One-time deploy (from the repo root)

```bash
# 1. Resource group (pick a region near you, e.g. japaneast)
az group create -n internship-portal -l japaneast

# 2. Build the Dockerfile in the cloud and deploy as a Container App.
#    --ingress external + --target-port 8080 exposes it; --min-replicas 1 = always-on.
az containerapp up \
  -n portal-compile \
  -g internship-portal \
  --source . \
  --ingress external \
  --target-port 8080 \
  --env-vars RESUME_FONT_PROFILE=linux RESUME_STUDIO_APP_ORIGIN=https://editor-omega-two.vercel.app

# 3. Ensure it never scales to zero (always warm) and give it enough CPU/RAM for LaTeX.
az containerapp update -n portal-compile -g internship-portal \
  --min-replicas 1 --max-replicas 2 --cpu 1.0 --memory 2.0Gi

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

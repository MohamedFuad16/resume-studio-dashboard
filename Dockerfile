# API server for the Internship Portal: internship catalog, company research, Gmail
# ingest, and the no-auth tracker/profile fallback. The Vite client is hosted
# separately and calls this service via VITE_API_BASE_URL.
#
# There is no LaTeX here any more: the résumé editor and its server-side PDF compile
# were removed (users upload a PDF, parsed in the browser), so Tectonic and the CJK
# fonts left the image.
#
# Build for amd64 (the EC2 host); on an arm64 Mac pass `--platform linux/amd64`.
FROM node:22-trixie-slim

# python3/make/g++ are for better-sqlite3: it ships prebuilt binaries for
# linux-x64 and normally uses them, but if a prebuild is ever unavailable for the
# runtime's ABI, node-gyp compiles from source — and without a toolchain present
# that turns into a FAILED image build rather than a slow one.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app
COPY editor/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY editor/ ./

EXPOSE 8080
CMD ["node", "server/index.js"]

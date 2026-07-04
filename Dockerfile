# Compile backend for the Internship Portal.
#
# Runs the existing Node/Express server WITH Tectonic (LaTeX) + Japanese fonts, so the
# résumé PDF preview reflects LIVE edits in production (Vercel's serverless runtime
# cannot run Tectonic). Deploy to a container host (Render / Railway / Fly); the Vercel
# frontend calls this service via VITE_API_BASE_URL. See docs/compile-backend.md.
# amd64: Tectonic publishes prebuilt x86_64-linux binaries (no aarch64-gnu build), and
# container hosts (Render/Railway/Fly) run x86_64. Build with --platform linux/amd64.
# Debian trixie (glibc 2.41): the Tectonic 0.16.9 prebuilt needs glibc ≥ 2.38 (bookworm
# ships 2.36, too old).
ENV DEBIAN_FRONTEND=noninteractive
FROM node:22-trixie-slim

# LaTeX runtime libs, fontconfig, and Japanese fonts (Noto Serif/Sans CJK JP) that the
# JA templates use on Linux (RESUME_FONT_PROFILE=linux swaps Hiragino → Noto).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl fontconfig \
      fonts-noto-cjk fonts-noto-core \
      libssl3 libfontconfig1 libgraphite2-3 libharfbuzz0b libicu76 \
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*

# Tectonic — the official install script fetches the right prebuilt binary.
RUN curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh \
  && mv tectonic /usr/local/bin/tectonic \
  && chmod +x /usr/local/bin/tectonic \
  && tectonic --version

ENV NODE_ENV=production \
    RESUME_FONT_PROFILE=linux \
    TECTONIC_PATH=/usr/local/bin/tectonic \
    TECTONIC_CACHE_DIR=/app/.cache/tectonic \
    PORT=8080

WORKDIR /app
COPY editor/package*.json ./
RUN npm ci --omit=dev
COPY editor/ ./

# Warm the Tectonic bundle cache at build time so the first production compile is fast
# (downloads the LaTeX packages the templates need). Non-fatal if it can't reach the net.
RUN mkdir -p /app/.cache/tectonic \
  && printf '%s' '\documentclass[a4paper,11pt]{article}\usepackage{fontspec}\usepackage{xeCJK}\usepackage{geometry}\usepackage{titlesec}\usepackage{enumitem}\setCJKmainfont{Noto Serif CJK JP}\setmainfont{Noto Sans}\begin{document}\section{ウォームアップ}Warm-up 日本語.\end{document}' > /tmp/warm.tex \
  && (tectonic /tmp/warm.tex -r 0 --outdir /tmp && echo "warm-up OK") || echo "warm-up compile skipped (non-fatal)"

EXPOSE 8080
CMD ["node", "server/index.js"]

# Internship Portal

Internship Portal (インターンポータル) is a bilingual internship tracker and résumé editor.

## Data storage

The app uses a small SQLite-compatible key-value database through `sql.js`.

- Local development: `editor/server/.data/resume-studio.sqlite`
- Vercel production: the same SQLite database file stored in Vercel Blob
- Seed data: existing JSON files in `editor/server/profiles` and `editor/server/custom-internships.json`

For durable production persistence on Vercel, create/connect a Vercel Blob store and set:

```bash
BLOB_READ_WRITE_TOKEN=...
```

Without that token, Vercel functions can run but writes are not durable across deployments/cold starts.

## Local development

```bash
cd editor
npm install
npm run dev
```

Open <http://127.0.0.1:5173/?profile=mohamed_fuad>.

## Vercel

Deploy from the `editor` directory:

```bash
cd editor
vercel
```

The frontend is built with Vite and the Express API is exposed through `editor/api/[...path].js`.

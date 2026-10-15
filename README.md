# MWANGAZABIz website

This repository contains the React/Vite website only. The FastAPI backend is in the separate backend repository and must be deployed first.

## Deploy on Vercel

1. Import this repository into Vercel. Keep the project root at `./`.
2. Add the environment variable `VITE_API_URL` with the backend's full HTTPS API address, ending in `/api/v1` (for example, `https://api.example.com/api/v1`).
3. Deploy. `vercel.json` already configures the Vite build and page refresh routing.

The website's `VITE_API_URL` is public browser configuration. Never put passwords, database URLs, or secret keys in a `VITE_` variable.

## Local development

Install Node.js 22+ and pnpm, then run:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

By default the local website connects to `http://127.0.0.1:8000/api/v1`. Set `VITE_API_URL` in a local `.env` file only if your API runs somewhere else.

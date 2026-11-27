# Preview deployment

## Local

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm run dev`.
4. Run `npm run build` before pushing changes.

## Cloudflare Pages (frontend preview)

- Connect this GitHub repository to Cloudflare Pages.
- Framework preset: Vite.
- Build command: `npm run build`.
- Build output directory: `dist`.
- Production branch: `main`.

The current dashboard is a frontend prototype using sample values and browser-only state. It does not yet persist data or post accounting entries. Do not use it for live mandi books until authentication, D1 APIs, transaction-safe accounting, backups and testing are implemented.

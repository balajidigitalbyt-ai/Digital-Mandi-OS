# API foundation

The Pages Functions API lives in `functions/api/`. Cloudflare Pages exposes these handlers under `/api/*`.

## D1 binding

The root `wrangler.toml` declares the existing D1 database through the `DB` binding. The separate `wrangler.d1.toml` remains reserved for D1 migration commands.

## Health check

- Route: `GET /api/health`
- Read-only: executes `SELECT 1`
- Success: returns `ok: true` and `database: "connected"`
- Failure: returns HTTP 503 without exposing database internals

This endpoint does not create, update, or delete any business data. It is a connectivity check only.

## Next implementation rule

Before adding business queries, verify the exact live D1 column definitions and map each API query to those columns. Never run the initial migration against the already-created production database.


## Deployment reconnect

A documentation-only commit can be used to trigger a fresh Pages production deployment after reconnecting the Git provider. It does not modify the existing D1 database.

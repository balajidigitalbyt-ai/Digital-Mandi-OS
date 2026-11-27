# Digital Mandi OS — First Run

## What is already connected

- Cloudflare Pages app: `https://digital-mandi-os.pages.dev`
- Cloudflare D1 binding: `DB` → `digital-mandi-os-db`
- Existing live D1 schema: 20 tables (see [LIVE_D1_SCHEMA.md](./LIVE_D1_SCHEMA.md))
- First-run Owner setup and secure login endpoints
- Tenant-scoped Farmer/Miller party API
- Audit log entry when a party is created

## First action required from the shop owner

The production database currently has no shop or user, so the first Owner must be created in the web app. Open the app and complete the first-run form:

1. Shop / firm name
2. Owner name
3. Phone (optional)
4. Email address
5. Password of at least 12 characters

The setup operation is one-time. It creates the shop, Owner account, and the three configured crops (धान, गेहूँ, चना). The password is stored as a PBKDF2-SHA256 hash; the app never stores the plain password. A secure, HttpOnly, SameSite=Strict cookie is issued for an eight-hour session. The session signature is tied to the stored password hash, so changing the password invalidates prior sessions.

If setup has already completed, the app shows Login instead of allowing another Owner setup.

## Available modules

- Farmers: list and create farmer parties, including village, mobile and address.
- Millers: list and create miller parties, including village, mobile and address.

Both modules require a valid session and always filter by the signed-in user's `shop_id`. Party creation and its audit log are written together in a D1 batch.

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/setup-status` | Non-sensitive first-run state |
| POST | `/api/auth/setup` | One-time shop and Owner creation |
| POST | `/api/auth/login` | Owner/staff login |
| GET | `/api/auth/me` | Current signed-in user |
| POST | `/api/auth/logout` | Clear session cookie |
| GET | `/api/parties?type=farmer` | Tenant-scoped farmers |
| GET | `/api/parties?type=miller` | Tenant-scoped millers |
| POST | `/api/parties` | Create a farmer or miller |

## Not yet production-enabled

Purchase, stock, sales/dispatch, commission calculation, payments, double-entry accounting, and printable slips are not yet connected to live D1. The dashboard therefore shows zero values instead of demo figures. Do not record real business transactions in a preview-only control until the matching database API and accounting tests are complete.

## Safety rules

- Do not run the old initial migration against the existing production D1 database.
- Do not expose party, ledger, or slip data through unauthenticated endpoints.
- Keep rate finalization and legal/contract terms under the owner's manual approval.
- Use additive, reviewed migrations only, with a backup and explicit approval.

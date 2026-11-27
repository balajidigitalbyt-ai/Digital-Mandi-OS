# Digital Mandi OS — First Run

## What is already connected

- Cloudflare Pages app: `https://digital-mandi-os.pages.dev`
- Cloudflare D1 binding: `DB` → `digital-mandi-os-db`
- Existing live D1 schema: 20 tables (see [LIVE_D1_SCHEMA.md](./LIVE_D1_SCHEMA.md))
- First-run Owner setup and secure login endpoints
- Tenant-scoped Farmer/Miller party API
- Audit log entry when a party is created
- Purchase entry: creates a deal, farmer purchase, net weighment, stock lot and audit record in D1
- Stock: reads live stock lots and available quantities from D1
- Sales & Dispatch: records miller sale, dispatch/accepted weights and vehicle details; dispatched quantity is deducted from stock
- Commission: miller-specific fixed + percentage rules, configurable weight/percentage bases, immutable per-deal calculation snapshots, and balanced journal posting (Miller Commission Receivable Dr / Commission Income Cr)

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

- Farmers and Millers: list and create tenant-scoped party records.
- Purchase: creates commission-model or own-trade purchase records and initial stock.
- Stock: live available stock by lot, owner type and crop.
- Sales & Dispatch: sells available stock to a miller and records dispatch/accepted weights.
- Commission: saves a current rule per miller and calculates commission on commission-model sales. Fixed ₹/quintal and percentage commission can be combined. Weight basis supports dispatch, accepted or custom (with reason); percentage basis supports sale amount, purchase amount or custom amount. Each calculation stores a rule/amount/weight snapshot and posts a balanced double-entry journal: debit Miller Commission Receivable (party-wise) and credit Commission Income.

All connected APIs require a valid session and scope records to the signed-in user's `shop_id`.

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
| GET | `/api/purchases` | Purchase form data and recent purchases |
| POST | `/api/purchases` | Create purchase, deal, weighment and stock lot |
| GET | `/api/stock` | Live stock inventory |
| GET | `/api/sales-dispatch` | Millers, available lots and recent sales |
| POST | `/api/sales-dispatch` | Create sale and dispatch; reduce available stock |
| GET | `/api/commission` | Commission rules, pending deals and calculated commissions |
| POST | `/api/commission` | Save miller rule or calculate a commission snapshot |

## Still in progress / not yet connected

Payments, receipt allocation, farmer/miller settlement balances, dashboard rollups and persistent printable slips are not yet connected end-to-end. Commission calculation now posts to the accounting journal as a miller receivable and commission income; it is not a payment or collection, and must not be treated as cash received. The dashboard summary cards are still placeholders.

## Safety rules

- Do not run the old initial migration against the existing production D1 database.
- Do not expose party, ledger, or slip data through unauthenticated endpoints.
- Keep rate finalization and legal/contract terms under the owner's manual approval.
- Use additive, reviewed migrations only, with a backup and explicit approval.

# Digital Mandi OS — Accounting Rules (MVP)

## Business modes
- **Commission**: farmer-owned goods are sold to a miller through the arhtiya. The farmer's commodity value is payable to the farmer; commission is receivable from the miller. Do not deduct this commission from the farmer.
- **Own trade**: goods are purchased from the farmer into the arhtiya's own stock, then sold to the miller. Trading gross margin is sales less purchase cost; direct expenses reduce net trading profit.

## Commission calculation
Each deal snapshots the applicable rule:
- fixed fee per quintal × selected commission weight in quintals;
- percentage fee × explicitly configured percentage base;
- total commission = fixed fee + percentage fee.

The weight basis is selected per deal: dispatch weight, miller-accepted weight, or custom weight. Custom weight requires a reason and authorized approval. Later changes to default rules must not rewrite old deal calculations.

## Slips
Farmer slips and miller slips are separate document types, each with a unique serial number and deal/party linkage. Store an immutable snapshot of the values printed at issue time. Corrections create a new version or a reversal/correction record; never silently overwrite an issued slip.

## Accounting controls
- Posted journal entries are immutable; correct them using reversal entries.
- Payment posting must be idempotent to prevent duplicate ledger credits/debits.
- A journal entry must balance: total debit = total credit.
- Stock ownership must distinguish commission stock, own stock and in-transit goods.
- Dispatch and miller receipt weights are separate facts; shortages are reconciled explicitly.

## Example
100 Q × ₹10 fixed = ₹1,000. ₹2,50,000 sale base × 0.5% = ₹1,250. Total miller-paid commission = ₹2,250.

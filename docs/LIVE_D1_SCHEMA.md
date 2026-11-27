# Live D1 Schema Reference

**Database:** `digital-mandi-os-db`  
**Binding:** `DB`  
**Verified:** 2026-11-27 through the deployed Pages Function  
**Scope:** Read-only observation of the existing database. No DDL or business data was changed during verification.

> IMPORTANT: This is the live database reference. Do not run `database/migrations/0001_initial_schema.sql` or the older `database/schema.sql` against the already-created production database. Those files do not fully match the live columns. Any future schema change must be a separately reviewed, additive migration with a backup and explicit approval.

## Tables and live columns

| Table | Columns |
|---|---|
| `shops` | `id`, `name`, `owner_name`, `phone`, `address`, `created_at` |
| `users` | `id`, `shop_id`, `name`, `email`, `password_hash`, `role`, `active`, `created_at` |
| `parties` | `id`, `shop_id`, `party_type`, `name`, `village`, `mobile`, `address`, `opening_balance`, `balance_side`, `notes`, `active`, `created_at` |
| `crops` | `id`, `shop_id`, `name`, `active` |
| `deals` | `id`, `shop_id`, `deal_no`, `deal_type`, `crop_id`, `farmer_id`, `miller_id`, `variety`, `deal_date`, `status`, `notes`, `created_by`, `created_at` |
| `weighments` | `id`, `shop_id`, `deal_id`, `party_id`, `crop_id`, `weighment_type`, `weight_quintals`, `vehicle_number`, `measured_at`, `notes`, `created_at` |
| `purchases` | `id`, `shop_id`, `deal_id`, `farmer_id`, `crop_id`, `purchase_date`, `bags`, `gross_weight`, `tare_weight`, `net_weight`, `purchase_rate`, `total_amount`, `deduction_amount`, `payable_amount`, `paid_amount`, `balance_amount`, `purchase_mode`, `notes`, `created_at` |
| `sales` | `id`, `deal_id`, `miller_id`, `crop_id`, `quantity_kg`, `rate_per_quintal`, `gross_amount`, `created_at` |
| `commission_rules` | `id`, `shop_id`, `miller_id`, `rule_name`, `fixed_rate_per_quintal`, `percentage_rate`, `weight_basis`, `percentage_basis`, `active`, `effective_from`, `effective_to`, `created_at` |
| `commission_calculations` | `id`, `shop_id`, `deal_id`, `commission_rule_id`, `weight_quintals`, `fixed_rate_per_quintal`, `fixed_commission`, `percentage_rate`, `percentage_base_amount`, `percentage_commission`, `total_commission`, `calculation_snapshot`, `calculated_at`, `created_at` |
| `stock_lots` | `id`, `shop_id`, `deal_id`, `crop_id`, `owner_type`, `owner_party_id`, `quantity_kg`, `available_kg`, `location`, `status`, `created_at` |
| `dispatches` | `id`, `shop_id`, `deal_id`, `sale_id`, `miller_id`, `crop_id`, `dispatch_date`, `vehicle_number`, `driver_name`, `driver_mobile`, `bags`, `dispatch_weight`, `accepted_weight`, `weight_difference`, `status`, `notes`, `created_at` |
| `receipts` | `id`, `shop_id`, `deal_id`, `miller_id`, `receipt_no`, `receipt_date`, `amount`, `payment_method`, `transaction_reference`, `notes`, `created_at` |
| `slips` | `id`, `shop_id`, `slip_no`, `slip_type`, `deal_id`, `party_id`, `snapshot_json`, `version`, `status`, `created_by`, `created_at` |
| `payments` | `id`, `shop_id`, `party_id`, `deal_id`, `payment_no`, `payment_date`, `payment_type`, `amount`, `payment_method`, `transaction_reference`, `status`, `notes`, `created_at` |
| `ledger_accounts` | `id`, `shop_id`, `account_code`, `account_name`, `account_type`, `parent_account_id`, `opening_balance`, `balance_side`, `system_account`, `active`, `created_at` |
| `journal_entries` | `id`, `shop_id`, `entry_no`, `entry_date`, `reference_type`, `reference_id`, `description`, `status`, `reversed_entry_id`, `created_at` |
| `journal_lines` | `id`, `journal_entry_id`, `account_id`, `party_id`, `debit`, `credit` |
| `expenses` | `id`, `shop_id`, `expense_no`, `expense_date`, `account_id`, `deal_id`, `expense_category`, `description`, `amount`, `payment_method`, `paid_to`, `transaction_reference`, `created_at` |
| `audit_logs` | `id`, `shop_id`, `user_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `ip_address`, `created_at` |

## Confirmed verification result

- 20 expected tables found; 20 existing.
- The Pages Function D1 binding successfully executed a read-only `SELECT 1`.
- The temporary schema-inspection endpoint was removed after verification.
- No rows were inserted, updated, or deleted by the schema verification.

## Integration rules and known differences

1. **Weight units:** `weighments.weight_quintals` is in quintals. `stock_lots.quantity_kg`, `stock_lots.available_kg`, and `sales.quantity_kg` are in kilograms. Convert explicitly at API boundaries: 1 quintal = 100 kg. Do not silently mix units.
2. **Sales tenant scope:** the live `sales` table has no `shop_id`. Until an approved additive migration adds one, scope sales through its parent `deals.shop_id` join. Never query sales globally.
3. **Purchase model:** use the live purchase fields (`gross_weight`, `tare_weight`, `net_weight`, `purchase_rate`, `total_amount`, `deduction_amount`, `payable_amount`, `paid_amount`, `balance_amount`, `purchase_mode`). Do not use the older blueprint's renamed fields.
4. **Commission snapshot:** use `commission_rule_id`, `weight_quintals`, the fixed/percentage amounts, and `calculation_snapshot`. Store the applied terms per deal so later rule edits do not rewrite history.
5. **Miller-paid commission:** in the commission-agency model, farmer payable must not be reduced by commission. Commission is a separate receivable from the miller.
6. **Slip snapshots:** `slips.snapshot_json` is the immutable print/share snapshot; corrections should create a new version or a reversal/correction record, not silently overwrite a previously issued slip.
7. **Journal lines:** `journal_lines` is linked to `journal_entries`; tenant checks must be enforced by joining through the parent entry and its `shop_id`.
8. **Enums and constraints:** the live column list alone does not prove CHECK constraints or allowed values. Inspect the actual table SQL before relying on enum values such as party type, deal type, stock owner type, or payment status.

## Next safe engineering sequence

1. Treat this document as the live-schema source of truth for application code.
2. Review actual CREATE TABLE SQL / constraints before implementing enum-dependent writes.
3. Add authentication and shop-scoped authorization before exposing farmer/miller names, mobile numbers, balances, or slips through APIs.
4. Implement read/write endpoints with prepared statements, validation, audit records, and transactions.
5. Only after explicit approval, plan any additive schema changes (especially tenant scoping for `sales`) with a backup.

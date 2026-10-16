# Usage credits — approved launch policy

Migration `0152_approved_credit_allowances.sql` is the canonical configuration. Growth retains the subscription ID `business`; only its display name changes. Existing subscription prices and feature hierarchy are unchanged.

| Plan | One-time starter grant | Monthly included allowance |
|---|---:|---:|
| Free | 100, once per organization | 0 |
| Starter | No repeat of the starter grant | 100 |
| Growth | No repeat of the starter grant | 300 |
| Pro | No repeat of the starter grant | 750 |

`plans.one_time_credits`, `monthly_credits`, and `credit_grant_policy` drive public pricing, Billing, upgrade comparison and grants. Custom Multi-Branch allowances remain unconfigured. No purchase-credit UI or arbitrary credit adjustment endpoint is added.

## Ledger and periods

Reuse `organization_credit_grants`, `organization_credit_reservations`, `organization_credit_allocations`, and `organization_credit_ledger`. The existing `trial_credit_accounts` row remains the per-organization mutex. Its exact opening balance is bridged once under `approved-one-time`; migration never refills spent starter credits.

Consumption order is current **plan**, then **one_time**, then **purchased**; within a class, earliest expiry first. Paid included credits expire without rollover. Future purchased lots must expire 12 months after creation; pre-existing lots are preserved by a NOT VALID transition constraint. No production backfill or top-up purchasing is performed.

Periods use authoritative subscription start/end. Annual subscriptions receive monthly anniversary windows anchored to their original timestamp, including clamped month ends. Missing/expired billing periods never generate guessed grants. The grant key contains subscription identity, window start and target allowance; the organization is also part of the unique constraint. Provider retries, reads, and scheduler retries cannot duplicate grants.

Mid-cycle Starter → Growth grants +200; Growth → Pro grants +450. The calculation uses allowance already granted, not remaining balance. Downgrades keep the current grant; next period uses the lower allowance. Cancellation removes future premium access and never regrants starter credits. Existing included grants retain their original expiry. An overlapping provider anchor change retains the already-started credit window to prevent a second full allowance.

Available credits exclude reserved amounts and expired lots. Expiry writes ledger entries; it never deletes history. Expired pending allocations remain held until their outcome is resolved. Commit writes USAGE once; definite rejection RELEASEs; private verified refunds restore the original allocations once and re-expire an expired lot. No business user can adjust or grant credits.

## Operation registry

| Existing operation key | Credit cost | Gate |
|---|---:|---|
| `sms_notification` (SMS_STANDARD_SEGMENT) | 1 per segment per recipient | `reminders`, current worker claim, eligible recipient |
| `transactional_email` | 0 | Existing recipient/provider/permission checks |
| `advanced_report` | 0 | Advanced scope requires `advanced_reports`; basic recent dates remain free |
| `csv_export` | 0 | `advanced_reports` |
| `image_upload` | 0 | `image_uploads`, existing storage quota and role |
| `ai_insight` | 5 | Disabled: no actual AI operation exists |
| `ai_advanced_operation` | Unconfigured | Disabled |

Ordinary business operations, basic reports, search, navigation and in-app notifications never debit credits. Missing/NULL/disabled operation costs cannot cause arbitrary debits.

## SMS adapter contract and limitations

The worker calculates segments after rendering the final body, hashes the body, then reserves through the service-role-only adapter. GSM-7 uses 160 septets for one part, 153 for multipart; extension characters use two septets. Unicode uses 70/67 UTF-16 units and does not split surrogate pairs. No transliteration or smart encoding is assumed. A real provider must explicitly preserve this encoding/concatenation contract and guarantee idempotent submissions before metering can be enabled. All recipients reserve independently.

Provider acceptance commits credits, not delivery confirmation. Definite pre-send failures release; ambiguous outcomes retain their reservation and use the same provider idempotency key. A changed body conflicts with the original reservation. Transactional email never reserves, even if its adapter has variable provider costs.

**No live SMS provider exists in this repository.** Disabled and development-only console providers remain unmetered. No real SMS, payment or customer communication was sent. Provider receipt reconciliation and user-facing send estimates await an actual provider/send workflow. The standard segment utility and worker boundary are covered with synthetic tests.

## Notices and UX

Database status is NORMAL above 20%, LOW at ≤20%, CRITICAL at ≤10%, EMPTY at zero (small absolute floors retained). Paid threshold denominator includes the current included allowance plus available other buckets; an exhausted old starter allowance does not create a permanent warning. Free uses its one-time allowance.

Notices deduplicate by organization, period, recipient and kind; Free uses a lifetime identity. Only owners currently have billing permission. Read state persists. Restored balances hide stale warnings. Account contains balances, included allowance, progress, reserved amounts, next refresh, history and Compare Plans. The dashboard displays only a compact dismissible non-normal notice. Core operations remain usable at zero.

Historical saved report data remains readable under original actor/role/branch/financial checks; preparing new exports and downloading CSV requires current entitlement. See [ENTITLEMENTS.md](ENTITLEMENTS.md) and [REPORTS.md](REPORTS.md).

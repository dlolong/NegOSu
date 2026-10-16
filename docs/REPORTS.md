# Reports

The Reports page opens with seven days of tables. Search expands from an icon beside the filter popup. Category tabs and financial totals remain unchanged across Automotive, Salon, Pet Care and Apartelle & Inn.

Migration `0153_reports_entitlement_policy.sql` supersedes credit-funded report generation:

- Basic single-branch dates within the last 31 branch-local days cost zero, including Free organizations with zero credits.
- This month and recent custom ranges remain available. Switching tabs, searching loaded rows and navigating never consumes credits.
- Extended history, all-branch scope, advanced item/client filtering and CSV require `advanced_reports`.
- Paid filters and export cost zero. No report reservations or usage ledger entries are created at launch.
- Snapshot retries are serialized with a transaction advisory lock and retain their original actor, payload, role, branch and financial checks.
- Existing snapshots remain readable; CSV downloads recheck the current plan. The registry retains the export operation for future policy configuration; any future metering needs explicit approval and consent UX.

Hospitality filtered results reuse the canonical workspace through a private paginated reader, bounded to 10,000 rows and the snapshot size limit. Public CSV export remains separately entitlement-gated. The UI does not display a credit score or per-filter credit charge.

Server authorization remains in canonical report RPCs. Private client purchase data permits basic recent date/category queries but rejects advanced text combinations without entitlement. Report contexts no longer alter plan entitlements.

## Staff transactions

Migration 0154 replaces the Staff tab's customer aggregates with recorded completed work from `staff_completed_work`. One displayed row represents one completed appointment/job or hospitality staff event, with participating staff names combined. Historical participants and branch-local timestamps are retained. Columns are Staff, Date and time, Transaction, Client / guest, and Price. Default seven-day results are paginated; custom dates and CSV use the same staff report contract. A Total amount card above the Staff table counts each grouped transaction once across all loaded pages. There is no revenue card.

Price is the current whole transaction amount, not an employee's pay or allocated revenue. Appointments include their service amount and posted checkout bills; automotive jobs include posted job/linked checkout invoices; hospitality events show posted stay bills. Shared transactions display their price once, without adding staff participation amounts together. Table and CSV grouping use the canonical transaction identity, including for existing saved snapshots. Recorded hospitality events use their event timestamp, appointments their scheduled timestamp, and jobs their completion/recorded timestamp.

The new read RPC preserves canonical report permission, tenant, financial-role, branch and date-scope checks. Free recent reports cost zero; CSV and extended scope retain existing paid entitlements. Apply 0154 after 0153 before deploying the updated Staff tab.

Report lists show per-record Amount/Price alongside the Total amount summary card, without duplicate Revenue collected columns. Exact branch-local timestamps appear where supplied. Client purchase aggregates expose only their last activity date, so no midnight time is fabricated. Catalog room/promo aggregates do not expose an event timestamp and display “—” in Date and time. This is presentation only: paid amounts and balances remain distinct authoritative data, and CSV financial data is preserved.

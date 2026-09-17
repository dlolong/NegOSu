# Contextual plan upgrade guidance

## Implementation

Removed the general top-of-page upgrade banner and the unconditional Apartelle Overview promotion. Reports retain a compact upgrade action inside their limited-access information. Public website publication and maintenance rules show guidance only when the effective plan excludes those capabilities. Branch, staff login and monthly job limits have exact, safe error mappings that offer an upgrade after rejection, rather than promoting upgrades merely because capacity is finite.

The live plan catalog determines the first strictly higher active plan that supplies the missing capability or increases the reached limit. Included features, unreached/unlimited capacity, unsupported industry capabilities, highest-tier plans and failed/unknown entitlement reads produce no prompt. Owners navigate to the relevant Billing & Plan card; staff see owner guidance and public comparison. Verified payment reconciliation refreshes dashboard entitlement context. Existing provider checkout and server/database permissions remain authoritative.

## Files and security

New shared modules: `modules/platform/plan-upgrades.ts`, `lib/billing/upgrades.ts`, `lib/billing/plan-errors.ts`, `components/plan-upgrade.tsx`. Integrated with the dashboard layout/shell, Reports, Hospitality Reports/Overview, website settings, maintenance rules, shared form messages, branch/staff actions, job error handling and payment reconciliation. Added selection/loader/error unit tests and local browser coverage; adjusted the existing billing review browser scenario.

No database migration or RLS changes in this phase. Entitlements use the authenticated membership-checked RPC with the selected organization ID; no global tenant cache, service key or billing-provider identifiers are sent to the browser. Error mapping uses an exact allowlist, never arbitrary SQL or permission messages. Prompts do not grant access or start payment. Previous uncommitted Hospitality changes were preserved.

## Validation

- `npm test`: 426 passed, including 28 new upgrade tests.
- `npm run check`: lint, typecheck and production build passed on the final implementation. Targeted lint also passed for the final touched files.
- Local desktop and 320/390-pixel mobile browser coverage: 9 passed for absence of banners, contextual Reports, real branch-limit rejection, highest-plan behavior, billing navigation and print hiding.
- Existing monthly/yearly billing review browser scenario: 3 passed. Final-build combined browser rerun: all 12 passed after compacting the Reports notice.
- Desktop/mobile screenshots reviewed; no horizontal overflow.

Self-review covered selected-workspace isolation, unknown entitlement failures, paid versus Free plans, industry support, capacity versus feature access, safe errors and owner-only billing. No known blocker/high finding. Database-enforced staff/job rejection paths were inspected; new end-to-end quota coverage exercises branches. No live provider payments or production deployment were performed. The local Next server still logs its previously observed navigation-cancellation “destination stream closed early” message; browser assertions pass.

Next step: review and deploy the application through the normal release process. This phase needs no additional migration; earlier Hospitality migrations remain a separate prerequisite for those pending changes.

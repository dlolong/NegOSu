# Apartelle & Inn standard availability

The latest user request supersedes the controlled-pilot policy in the initial Hospitality specification and earlier implementation reports. Implemented directly by one Developer Agent, with self-review and local validation.

## Implementation

- Apartelle & Inn is a normal signup choice alongside Automotive, Salon & Beauty and Pet Care. Account creation, email verification, business details, owner assignment, Free subscription and first-branch creation use the shared onboarding flow.
- Homepage hero/cards/FAQ, product landing page, navigation, signup, login, recovery, Plans copy, sitemap and dashboard setup present the feature without pilot or invitation messaging.
- Business subtypes are Apartelle, Inn and Guesthouse. Hospitality does not install appointment-service templates. Its dashboard checklist links to rooms, guests, staff, payments, inventory and reports.
- Old `/onboarding/hospitality` bookmarks redirect through standard onboarding. The separate invitation form/action and account notice were removed. Existing workspaces and their records remain intact.

Principal files: `modules/platform/{brand,product-entry,onboarding}.ts`, account/onboarding routes, `app/page.tsx`, `app/apartelle-inn/page.tsx`, business selector/identity and shared marketing components, Hospitality overview, seed/tests and product documentation.

## Database and security

Added append-only `0090_hospitality_general_availability.sql`; prior migrations were not rewritten for this update. The migration extends validated business types and the existing first-organization RPC, retaining authentication, authoritative owner/Free-plan assignment, transaction boundaries, slug locks and first-organization concurrency protection.

`hospitality_enabled` now checks the actual organization's industry and active status. RLS and RPC role/branch/tenant checks remain authoritative. Every Hospitality organization receives the finance-role-only reporting policy, including newly created organizations without historical pilot rows. Users cannot disable this policy. Historical pilot tables remain for existing records; authenticated execution of the retired provisioning RPC is revoked.

No new payment, reservation, inventory or reporting engine was introduced. The existing rooms, guests, stays, manually agreed charges, recorded payments, inventory, reports and staff feature scope is preserved. Public copy makes no claim of future online reservations or automatic room rates.

## Validation actually performed

| Command / suite | Result |
| --- | --- |
| `npm test` | 394 passed |
| `npm run check` | Lint, typecheck and production build passed |
| Guarded `scripts/hospitality-seed.ts` | Passed using shared organization/branch provisioning |
| Guarded `scripts/test-hospitality.ts` | 53 passed, including actual occupancy/payment races, tenant/branch isolation and financial denial |
| Local SQL `hospitality_general_availability` | 17 assertions passed |
| Local SQL `platform_product_entry`, `reports_every_plan`, `report_dependencies_repair` | 77 assertions passed |
| Playwright Hospitality entry and workflow suites | 12 passed; 6 intentional duplicate desktop-only scenarios skipped on mobile |
| Playwright existing marketing regression | 9 passed across 320–1440px |
| `git diff --check` | Clean |

Migration 0090 was applied transactionally to local Supabase and independently replayed against the existing disposable upgrade-validation database. No hosted database was used for migrations or mutations.

Browser testing covered 1366×768, 375×812 and 390×844, including an actual new local account signup, business/branch creation, room creation and Payments/Inventory/Reports access without any invitation or registry entry. Synthetic verification mail went to local Inbucket; the test confirmed that account through the local admin API. Existing guest/staff optional contacts, check-in, charges, partial/full collections, checkout, print styling, financial denial, switching and legacy setup redirect also passed. Desktop/mobile screenshots were inspected. Physical devices and real email delivery were not tested.

## Self-review and remaining deployment work

Reviewed canonical product configuration, public claims, shared signup validation, migration grants/triggers, preservation of financial permissions and existing onboarding behavior. Updated tests that previously treated Hospitality as unsupported; appointment-specific parity assertions now apply only to scheduling industries. A SQL test include-path issue was corrected in the local runner and that suite then passed. No known local blocking defect remains.

**Not executed:** hosted migrations, deployment, real customer communication/payment or subscription changes. Apply migrations through 0090 before deploying the updated application; otherwise hosted business creation can still reject Hospitality. Review normal signup and existing-workspace access in the deployment environment. See `docs/HOSPITALITY.md` for local commands and preserved domain limitations.

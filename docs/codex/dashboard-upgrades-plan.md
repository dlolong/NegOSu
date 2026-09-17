# Contextual plan upgrades

Goal: show upgrade guidance only for a feature excluded from effective plan coverage or after a capacity limit is reached. No general upgrade boxes at the top of pages, including Reports.

Reuse: authenticated effective-entitlements RPC, live ordered plans, shared shell context and existing owner-only Billing & Plan. No schema or RLS changes. Failed reads must not become Free or block daily operations.

Implementation: validated read model and pure capability selection helper, shared inline notice within Reports limited-access information, public website publication and maintenance rules. Safe exact error mapping adds capacity guidance when the database rejects branch, staff login or monthly job limits. Remove the unconditional Apartelle promotion. Refresh dashboard context after payment reconciliation.

Rules: recommend only a higher active plan that supplies the missing feature or increases a reached limit. Hide for included features, unreached/unlimited capacity, highest or unknown plans. Respect industry capabilities. Owners link to billing; other staff receive owner guidance and public plan comparison. Staff quotas apply to login access, not independent operational profiles. Preserve authoritative enforcement and existing payment providers.

Validation: unit tests cover selection, errors, industry and role behavior, failed reads and selected-organization isolation. Browser checks cover no top banners, Free versus highest plan, a real local branch-limit rejection, Reports billing navigation, print and desktop/mobile layouts. Run tests/lint/types/build and self-review. No production changes or live payments.

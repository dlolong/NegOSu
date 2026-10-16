# Plan and permission boundaries

`public.plans` is the commercial source of truth. `plan_entitlements` resolves subscription state; `effective_entitlements` adds catalog allowance metadata; `has_entitlement` is plan-only. A transaction report context can no longer enable a premium feature.

Existing feature keys are reused: `advanced_reports` covers extended history, cross-branch reports and CSV; `image_uploads` covers new image writes; `reminders` covers the existing SMS automation gate; `public_page` retains its existing meaning. No fictional AI or scheduling features are added. Starter, Growth (`business`) and Pro retain their existing feature flags and capacity limits.

User/tenant/branch authorization is checked before feature access. A plan does not grant a user permissions. The browser never determines cost, balance, billing period or effective plan. Billing and notices remain owner-only; generic ledger engines remain private. Outbox reservation is service-role-only and checks its live processing claim.

Free can operate all existing core workflows. Basic single-branch reports support recent dates (the last 31 branch-local days), including this month. Free cannot export, request all branches, or use advanced item/client filters. Paid readers retain financial-role and branch checks. Existing image objects are never deleted or hidden on downgrade; storage write policies still enforce new-upload entitlement.

Expired active subscriptions fall back to Free; Stripe past-due grace remains supported. Records without a valid authoritative billing period do not receive recurring credits. Before production rollout, audit provider synchronization and missing period data; do not invent dates to repair them.

The standard upgrade dialog uses live plan flags and allowances. Only owners can see the optional current credit balance or manage billing; other users receive a comparison link and owner guidance.

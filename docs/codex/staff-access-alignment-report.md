# Staff access alignment report

## Implementation

Fixed Grant system access and related Manage access, replacement invitation, and Staff profile layouts. A shared branch selector used a fixed two-column span inside access forms with implicit columns. Desktop reproduction showed action rows about 243 pixels narrower than their forms. The selector now spans the actual form columns; forms declare their intended column layout. Long branch names wrap without expanding the fieldset or shrinking checkboxes.

Changed `components/staff-branch-fieldset.tsx` and `components/staff-management.tsx`. Added `e2e/staff-access.spec.ts` and `e2e/fixtures/staff-access.tsx`; updated `docs/TESTING.md`.

## Validation and self-review

- Reproduced alignment failures before the fix using local Chrome after the sandbox prevented browser launch.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 301 passed.
- `npm run test:e2e -- e2e/staff-access.spec.ts e2e/form-actions.spec.ts --project=desktop-chromium --project=mobile-320 --project=mobile-390 --workers=2`: 75 passed, including 24 new staff checks.
- `npm run build`: passed.
- `git diff --check`: passed.

Reviewed desktop/320px screenshots and shared selector consumers. Verified action row width, button alignment, long-name overflow, Cancel without mutation, and expected submission contracts for both Salon and Automotive. Existing form regressions also passed.

## Database, business rules, and security

No schema, migration, domain, authorization, RLS, or branch-selection logic changes. Existing server actions retain validation and scoped service/RPC authorization. Only presentation changed; no real invitations were sent.

## Limits and next step

No blocking findings remain. Browser tests compile actual components/CSS with synthetic navigation and server actions; authenticated live-data walkthroughs were not performed. No database tests or deployment were needed for this presentation fix. Review the updated dialog in the local application before release.

## Follow-up: permission information box

Changed `PermissionMatrix` in `components/staff-management.tsx` to a compact, muted, labeled aside with an info icon and a collapsed native disclosure. The existing industry-specific matrix remains available on demand. No permissions, server actions, schema, or RLS changed. Updated the staff-access fixture/spec and UI/testing conventions.

Validation: lint, typecheck, all 301 application tests, production build, and diff whitespace checks passed. The staff-access browser suite passed 30 checks across desktop/320px/390px, including six new collapsed-state, keyboard expansion, role-content, and overflow checks. Self-review found no blocking issues. Browser validation uses synthetic component fixtures; live-data walkthrough and deployment remain outside this task.

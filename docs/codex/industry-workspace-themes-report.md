# Industry workspace themes — Developer Report

Historical report: the later generic-theme revision supersedes automatic matching and the theme catalog described below. See `generic-workspace-themes-report.md` for the current behavior.

## Implementation summary

Added industry-specific workspace palettes and a recommended **Match business industry** preference. Automatic matching uses the active business; explicit choices remain account-wide. Existing Ocean, Graphite, Emerald, and Indigo preferences are preserved under More palettes. Missing or unrecognized preferences use automatic matching; unsupported industries fall back to Ocean.

| Industry | Sidebar | Primary action | Soft accent |
| --- | --- | --- | --- |
| Automotive · Steel Blue | `#172331` | `#2459a9` | `#edf3fb` |
| Salon & Facial Care · Plum | `#352536` | `#85466d` | `#f8edf3` |
| Pet Care · Teal | `#173735` | `#087d72` | `#eaf7f2` |

White working surfaces, coordinated neutral text/borders, and pale canvas colors keep operational content readable. Sidebar focus and active indicators use a lighter dedicated accent. Shared dropdown, row-hover, and selection highlights follow the workspace palette. Success, warning, danger, and information tokens keep their existing meanings.

## Research and color rationale

There is no single universal branding palette across these industries. These choices interpret common color families; the exact application hex values are design decisions adjusted for contrast.

- Automotive graphite/blue draws on the blue and dark-neutral combination in [I-CAR Canada's official branding guide](https://www.aiacanada.com/wp-content/uploads/2022/09/ICAR-Branding-Guidelines-2022.pdf). [Toyota's official red, black, white, and gray system](https://brand.toyota.com/guidelines/visual/brand-colors) illustrates variation between automotive brands.
- Salon/Facial Care plum and blush follow the luxury and modern beauty directions described in [Curated Pixel's MedSpa color guidance](https://www.curatedpixel.com/resources/crafting-your-medspas-identity-how-to-choose-and-use-your-branding-colors). This is design-practitioner guidance, not an industry standard.
- Pet Care teal and mint draw on warm teal/green accents used in [Canine Companions' official branding guidelines](https://canine.org/wp-content/uploads/2021/06/CanineCompanions_Guidelines_Logo2021.pdf). Teal serves as this workspace's primary accent, with mint confined to pale surfaces.
- The automated normal-text target is at least 4.5:1, following [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum). Focus/active accents are checked against their surfaces at 3:1. This is targeted palette validation, not a claim of complete application WCAG conformance.

## Files changed for this task

- `modules/platform/dashboard-theme.ts`: palette catalog, preference allowlist, automatic resolution, compatibility.
- `lib/auth/context.ts`: resolves effective palette from authenticated preference and active membership industry.
- `app/globals.css`: scoped industry tokens, readable muted text, sidebar focus token, themed native controls and text selection.
- `components/workspace-theme-form.tsx` (new), `app/dashboard/settings/page.tsx`: accessible radio chooser, recommended automatic option, expandable classic choices, existing save/reset controls.
- `components/app-shell.tsx`: readable sidebar active indicator.
- `components/searchable-select.tsx`, `components/operations-forms.tsx`, `components/staff-management.tsx`, `components/command-center/command-center.tsx`, `app/dashboard/jobs/page.tsx`, `app/dashboard/vehicles/page.tsx`, `app/dashboard/customers/page.tsx`: replace decorative blue highlights with shared theme tokens.
- `tests/dashboard-theme.test.ts`, `e2e/workspace-themes.spec.ts` (new): preference, contrast, compatibility, responsive and authenticated behavior checks.
- `docs/DESIGN_SYSTEM.md`, `docs/UI_CONVENTIONS.md`, this report, and the bounded implementation plan.

The workspace contains prior authorized work. This list describes the current theme task rather than the entire working-tree diff.

## Database, domain, and security review

No database schema, migrations, RLS policies, scheduling, inventory, or financial rules changed. Preferences use the existing authenticated `updateDashboardTheme` server action and its expanded allowlist. Browser-supplied unrecognized values are rejected; metadata never grants permissions. Active-business selection still uses server-validated membership and existing tenant/branch boundaries. No service-role credentials were added to application code.

The new browser test is guarded to local application and Supabase endpoints. It creates one temporary synthetic user with memberships in three existing local QA businesses, then deletes that user in `finally`. It does not modify existing users' saved preferences. Production data and configuration were not changed.

## Tests and commands

Executed with Node 24.20.0. Builds and browser tests use the protected local environment helper; environment values and credentials are excluded from this report.

- `node --import tsx --test tests/dashboard-theme.test.ts`: 6 passed.
- `npm test`: 335 passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed using local validation configuration.
- `npx playwright test e2e/workspace-themes.spec.ts e2e/release-smoke.spec.ts --project=desktop-chromium --workers=2`: 12 passed.
- `npx playwright test e2e/pet-care.spec.ts --project=desktop-chromium --grep 'Pet navigation and dialogs (320|1440)' --workers=2`: 2 passed, covering Pet Care operational pages and dialog cancellation at phone and desktop widths.
- `git diff --check`: passed.

The new authenticated browser scenario checks automatic defaults for all three industries, business switching, fixed override persistence after reload/switching, classic selection, server rejection of a modified invalid radio value, Apply, and Cancel reset. Settings layout is checked at 320, 390, and 1440px for each industry. Automotive and Salon operational routes and public release routes pass existing smoke checks. Screenshots of Automotive and Salon desktop settings and Pet Care mobile settings were visually reviewed.

Local evidence logs use `/private/tmp/negosu-industry-theme-*.log`; final theme screenshots are under `/private/tmp/negosu-industry-themes-browser-results/`.

## Self-review findings and limits

- Fixed insufficient classic muted-text contrast on off-white surfaces by slightly darkening the shared admin muted token.
- Added lighter sidebar accents because primary button colors have insufficient contrast on dark sidebar backgrounds.
- Retained semantic blue for medium-priority indicators; decorative operational blue now uses shared tokens.
- Initial browser harness failures were corrected to handle the multi-business login chooser and await completion of business switching before navigating. The final scenario passes.
- No blocking findings remain in the changed scope. Cross-browser testing beyond Chromium and a full application accessibility audit were not performed.
- Public branding, production deployment, custom user-defined hex palettes, and changes to business rules are outside this task.

Recommended next step: review Settings → Workspace color theme using Match business industry, or select a fixed palette if preferred. Changes remain local and reviewable; nothing was deployed.

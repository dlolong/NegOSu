# Generic workspace themes

Revised the chooser to exactly five generic themes: **Steel Blue, Plum, Teal, Graphite, and Indigo**. Removed recommendations, industry names, automatic matching, and the expandable secondary palette group. All themes appear together; selection follows the account across businesses. Cards stack on phones and share a five-column row on wide screens. Apply saves the choice and Cancel resets to the saved value.

## Implementation and compatibility

Changed `modules/platform/dashboard-theme.ts`, `components/workspace-theme-form.tsx`, `app/dashboard/settings/page.tsx`, `lib/auth/context.ts`, and `app/globals.css`. Updated `tests/dashboard-theme.test.ts`, `e2e/workspace-themes.spec.ts`, `docs/DESIGN_SYSTEM.md`, and `docs/UI_CONVENTIONS.md`; marked the earlier industry-theme report as historical.

Retired saved values resolve on read: Automotive/Ocean/automatic → Steel Blue, Salon → Plum, and Pet Care/Emerald → Teal. Graphite and Indigo retain their palettes. Missing or invalid metadata uses Steel Blue. Only the five current theme IDs are accepted by the existing save action. Removed obsolete palette CSS and the separate automatic-preference type and context field.

No database migrations, business rules, RLS, or authorization boundaries changed. Preferences remain user-owned presentation metadata. Public branding and semantic status colors retain their existing behavior. No production changes or deployment.

## Validation and self-review

Executed with Node 24 using the protected local environment for build/browser checks:

- `node --import tsx --test tests/dashboard-theme.test.ts`: 6 passed, including five-theme allowlisting, retired-value resolution, CSS/swatches, and contrast.
- `npm test`: 335 passed.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- `npx playwright test e2e/workspace-themes.spec.ts --project=desktop-chromium --workers=1`: 1 passed. Authenticated checks cover all five saves, Cancel reset, persistence after reload and business switching, rejection of invalid values, and 15 theme/viewport combinations (320, 390, 1440px).
- `git diff --check`: passed.

Screenshot review caught the settings grid's implicit minimum column width expanding the theme section for longer business details on narrow screens. Made the mobile column explicitly shrinkable, constrained card/fieldset minimum widths, and added assertions for both settings-page overflow and card boundaries. Desktop and mobile screenshots were reviewed. Browser fixtures use a temporary synthetic local user and clean it up afterward.

No unresolved blocking findings. Browser coverage is Chromium only; a full accessibility audit and production deployment are outside this change. Local evidence: `/private/tmp/negosu-generic-themes-*.log` and `/private/tmp/negosu-generic-themes-browser-results/`.

Next step: review the five choices in Settings → Workspace color theme.

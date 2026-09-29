# Staff designations by vertical

Replaced the job-function browser datalist with an explicit selector populated only from the current vertical's existing suggestions. Facialist remains a Salon & Beauty suggestion; Apartelle & Inn offers Receptionist, Caretaker, Housekeeper and Manager. Automotive and Pet Care keep their own lists. Browser form history was a possible source of the reported mixed suggestions; the configured hospitality list did not contain Facialist.

An explicit Other / custom title choice preserves custom job titles and existing profiles without promoting those values into other businesses' suggested options. Custom titles remain descriptive text, not authorization roles. Existing server validation, tenant scope, branch scope and RLS are unchanged. Specialties now disable browser autocomplete as well.

Reviewed create/edit staff forms, access role options, staff routing, specialties, and permission references across all four verticals. Fixed Pet Care's reused salon Front Desk / Coordinator label in its permission reference. Corrected hospitality's reference to show cashier check-in/out and front desk checkout-only access, matching existing domain rules.

Changed `components/staff-management.tsx`, added `components/staff-job-function-field.tsx`, and extended the existing staff browser fixture and tests to cover every vertical, isolated suggestions, custom/empty/existing values, submission, mobile layout, and hospitality permission copy. No migration or stored-data cleanup is needed. Existing incorrectly assigned titles are retained for owner review rather than silently rewritten.

Validation: 456 unit tests passed using Node 24 (`node --import tsx --test tests/*.test.ts`). Production build passed. Lint and typecheck passed. All 46 staff browser checks passed at desktop 1440px and mobile 320px widths. Browser fixtures exercise real components with mocked server actions; live authenticated database workflows were not rerun because data-access behavior did not change.

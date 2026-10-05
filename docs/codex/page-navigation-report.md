# Page navigation placement

Back controls sit on their own row above page titles, tabs, progress indicators, and other page content. Each includes a left-arrow icon. Close controls remain at the upper right of their header. Existing destinations, accessible link names, semantic IDs, and form pending states are preserved.

`PageBackProvider` supplies a navigation target before layout content. `PageBack` renders page-owned navigation there through a React portal, retaining contextual return destinations without duplicating route rules. Before hydration, it falls back to rendering above the local heading. The dashboard navigation provider, authentication shell, and public booking page supply targets; standalone titles render Back locally above the title. `PageTitle` and `DashboardBackLink` share this behavior. Signup and booking step controls also use it.

Files updated for this revision: shared page-back, page-title, dashboard-back-link, auth-shell, signup-form, public booking page/form, and page-navigation browser fixture/spec. Previous navigation changes in this working tree include PageHeader close slots and detail-page contextual Back links.

No database, migration, RLS, authorization, or business-rule changes. No deployment required.

Self-review checked context-sensitive destinations, one Back control per page, empty navigation targets, tab ordering, keyboard access, preserved pending states, print hiding, and portal cleanup on navigation. Browser regression assertions now check Back above tabs and title, an arrow icon, contextual override, Close alignment, and horizontal overflow.

Validation: 522 unit tests passed, lint and typecheck passed, and page-navigation/service-catalog browser fixtures compiled. The production build (`npm run build -- --webpack`) passed. `git diff --check` passed. Browser execution and visual mobile/desktop checks remain unverified because browser escalation was previously declined. Manual follow-up: check client/vehicle/job tabs, appointment return navigation, and signup/booking steps on desktop and mobile.

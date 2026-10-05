# Client detail navigation

The client detail page now shows its profile first (contact details, status, joined date, address), followed by History, Products bought, and Reminders links. Only the selected section is rendered and loaded. Notes and less frequent profile actions are collapsed under Notes/More options. Edit and booking actions remain in the header. The former layout-level Overview/Communication consent tabs are removed; consent settings remain reachable from More options and existing direct links.

History retains appointment status/date/time and source links; automotive customers retain vehicle links and pet owners retain pet profiles. Product search, clearing filters, and pagination preserve the Products bought tab. Reminder pagination, creation, and client-origin completion/cancellation preserve the Reminders tab. Existing old pagination/product search URLs select the corresponding tab. Unknown tabs safely open History.

Files: customer detail page/layout; client-follow-up and client-reminder-rows; ListingFilters optional clear destination; reminder server actions; client-detail-navigation helper and tests. No database migration or RLS changes. Reminder return destinations use an allowlisted origin and a customer identity read from the authorized reminder record, never an arbitrary browser-provided URL.

Validation: targeted navigation/reminder/search tests passed; full lint and typecheck passed. All 535 unit tests and the production webpack build passed. An obsolete design-system assertion was updated to expect the new page-level tabs. Live database and browser visual execution remain unverified.

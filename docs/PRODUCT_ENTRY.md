# NegOSu Product Entry, Authentication, and Onboarding

NegOSu is the customer-facing business operating system and repository folder name; the npm package is `negosu`. ServiceCore remains an internal architecture name. The supported commercial verticals are **NegOSu Automotive**, **NegOSu Salon & Beauty**, and **NegOSu Pet Care**.

```text
NegOSu → Shared authentication → Organization → Persisted industry
                                              ├─ Automotive
                                              ├─ Salon & Beauty
                                              └─ Pet Care
```

## Public routes and presentation context

- `/` is the shared NegOSu landing page.
- `/automotive` is the NegOSu Automotive solution page.
- `/salon` is the NegOSu Salon & Beauty solution page.
- `/pet-care` is the NegOSu Pet Care grooming solution page.
- `/login` and `/signup` are one shared authentication implementation.
- `/sign-in` and `/sign-up` remain compatibility redirects and preserve their query parameters.

An allowlisted `industry=automotive|salon|pet_care` query may prefill signup and present the matching vertical context in shared auth. It is not authorization and never changes an existing organization. Missing or unsupported context stays generic; generic signup requires the customer to choose one of the supported business types. A prefilled choice remains editable.

## Account and first-business flow

```text
NegOSu entry
↓
Account + Automotive, Salon & Beauty, or Pet Care selection
↓
Email verification / shared Supabase identity
↓
Business identity + vertical-specific business type
↓
Transactional Organization + owner membership + free subscription
↓
Recoverable first Branch setup
↓
Derived vertical checklist
↓
Dashboard
```

The browser never submits an owner role. `create_first_organization` derives the user from `auth.uid()`, validates enabled industries and business-type pairing, takes a per-user transaction advisory lock, and creates the organization, owner membership, subscription, and audit record together. Duplicate or concurrent first-organization requests cannot create another first organization.

Organization creation and first-branch creation remain separate transactions deliberately. If identity or organization setup succeeds but the next step is interrupted, login derives the missing step from active membership and Branch records and returns the owner to it. No cleanup or redundant onboarding flags are required. The rolling-deployment compatibility path continues to support legacy Automotive organization creation, but never sends Salon or Pet Care setup to the old Automotive-only RPC.

## Organization resolution and switching

```text
Login
→ active memberships
→ no organization: business setup
→ one organization: branch recovery or dashboard
→ multiple organizations: Choose Business
→ membership-authorized selection
→ HTTP-only active-organization cookie
→ persisted industry config
→ vertical navigation and server route gates
```

The selector and authenticated shell perform a real tenant-context change. The server validates an active membership, clears stale Branch context, and derives either first-branch recovery or the dashboard destination. A missing, forged, or inactive organization cookie never silently selects one of several tenants. Industry presentation and browser state cannot bypass organization membership, role checks, server route/action gates, or RLS.

## Derived vertical onboarding

`modules/platform/onboarding.ts` defines the visible checklist per supported industry. Completion is derived from tenant-scoped Branches, Services/Treatments, additional Staff memberships, Scheduling Resources, Customers/Clients, Vehicles where applicable, and Appointments.

NegOSu Automotive:

```text
Branch → Services → Staff → Service Bays → Customer → Vehicle → Appointment
```

NegOSu Salon & Beauty:

```text
Branch → Treatments → Staff → Chairs / Rooms → Client → Appointment
```

Owners may open the dashboard before the optional checklist is complete and return through **Continue setup**. No setup-completion booleans are stored.

## Branding and legacy compatibility

Shared login/signup and platform marketing use `NegOSu`. Once a business is known, organization selection cards, setup, workspace chrome, and business-owned customer pages lead with its name and logo, with a small `Powered by NegOSu` attribution. See `docs/BRANDING.md`. ServiceCore remains valid in internal architecture, compatibility identifiers, and developer documentation. The repository folder is `NegOSu`; local paths must use the current checkout location. KarKR names may remain in internal Automotive fixtures, symbols, and legacy assets while compatibility work continues; they are not the shared public product identity.

The development seed contains fake Automotive and Salon organizations for cross-vertical switching. It provides no reusable production credential and must never be applied to production.

Pet Care uses `pet_grooming` and `pet_spa` business types. Migration 0073 replaces the invitation gate with ordinary industry/status/role checks. Existing organizations remain in their original industry and plan. Apply 0070–0074 in order before publishing an application that offers Pet Care signup.

### Industry starter services

New Automotive, Salon, and Pet Care workspaces receive ten industry-specific starter services after owner membership creation. These use editable PHP sample prices and durations, are available internally, and remain unpublished for public booking. Owners and managers can preview and add the same catalog from **Services → Starter services**. Repeating an import preserves existing records, prices, inactive states, and visibility. Setup can continue if import fails; the Services action retries it.

For existing local fixtures, use `node --import tsx scripts/install-starter-services.ts --all --dry-run`, then `--apply` with the protected local environment. `--organization=<uuid>` narrows the target. The script shares the QA seed's production rejection and explicit remote-development guards. Do not use it to backfill production without reviewed tenant scope and authorization. No new migration is needed.

Salon and Pet Care offer **Add walk-in** on their dashboards and appointment lists. A walk-in starts at database time and is created directly as a checked-in appointment; Automotive continues to use its vehicle queue. Salon uses client/treatment selectors, while Pet Care requires a pet, groomer, and resource. Branch hours and scheduling availability still apply. Failed saves preserve the form, and retries with the same request key return the original visit. Migration `0078_appointment_walk_ins.sql` is required, following the appointment-trigger repair in `0077_pet_appointment_trigger_row_identity.sql`.

Website administration is under **Settings → Website and booking**. Use the **Locations** tab, then **Map and hours** to paste a Google Maps link or the code from **Share → Embed a map → Copy HTML**. The editor previews embedded maps and stores only a validated map URL in the existing branch record. Regular map links remain directions links. Use **Edit address** to update the branch address. Save publishes location changes to an already published website; Cancel discards the draft. Website, Services, Locations, and Gallery have separate tabs.

Public storefronts show branch maps and directions, contact actions, section links, and mobile booking controls. The booking page also shows the selected location. Maps load lazily from Google; directions links remain available when an embedded map cannot load. No new database migration or API key is needed for the Google Maps Share embed format.

Public websites include a Contact us section with the business and published branch phone/email details, plus configured website and social links. Branch contacts can be maintained under Settings → Branches → Edit. On phones, the business header stays at the top while scrolling; the bottom menu provides Services/Treatments, Locations, Contact, Gallery when available, and Book now when booking is available. Desktop retains the header section navigation.

## Guided website chat and customer inbox

All business public websites include a Chat button. Quick choices use the existing published services, prices, locations and opening hours. Booking help and service-question suggestions can fill a short message for the customer to review before sending. Custom conversations go to **Customer Inbox** in the selected branch; owners, managers and advisors with appointment-management permission can read, reply, close and reopen them. The inbox has Needs reply, Open and Closed tabs and updates every 15 seconds while visible. Customers receive replies in the same browser tab, checked every 10 seconds while chat is open. This does not send email or SMS.

Customers can send three messages of up to 300 characters per conversation. A server-derived visitor fingerprint limits new conversations to five per business in a rolling 24-hour window. Staff replies allow up to 1,000 characters, with at most 50 replies per thread. Customer access expires after seven days; expired conversations remain in the staff inbox. The browser tab retains an opaque conversation key in session storage; closing the tab or clearing that storage can lose access to replies. No public inbox listing is available.

The chat's Book an appointment action retains the selected public location and service. For a conversation in that location, booking prefills the customer name and customer messages as an editable note; business replies are not copied. Availability, final pricing, contact/vehicle/pet details and business confirmation continue through the existing booking flow.

Deployment requires migration `0080_customer_chat.sql` and the existing server-only `SUPABASE_SERVICE_ROLE_KEY`. Apply through the normal reviewed Supabase migration process; no external chat provider or new dependency is required. Guided answers and booking links remain usable if chat persistence is temporarily unavailable. With no published service or bookable location, the chat offers questions/contact information without promising appointment availability.

The admin header includes a Notifications bell for outstanding work in the active branch. Depending on permissions and industry, it shows customer conversations needing replies, pending public booking requests, appointments awaiting confirmation, low/out-of-stock items, and overdue Automotive jobs. Appointment/job alerts open the next relevant record; other alerts open their working lists. The count represents unresolved tasks, so opening the bell does not clear it. It refreshes every 30 seconds while the page is visible, when returning to the window, on page navigation, and when opened/refreshed manually. Missing sources show a partial-update warning rather than an all-clear result. Chat counts depend on migration 0080; the bell adds no new migration.

Open dialogs lock background scrolling on public pages and the admin workspace (including its sidebar). Dialog contents retain their own scrolling, and closing the last dialog restores normal page scrolling.

The workspace menu prioritizes daily operations: Automotive starts with Queue, Job Orders, and My Work; Salon and Pet Care start with Appointments and Booking Requests. Payments sits within Operations. Customer records follow, then Inventory, Reports, Services/Treatments, and Staff; resources, branches, and settings stay under More. Automotive maintenance reminders sit with customer and vehicle records. Mobile shows the first three accessible destinations in this same order, including Dashboard, and keeps all remaining destinations in More. Existing role and industry access rules continue to apply.

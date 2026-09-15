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

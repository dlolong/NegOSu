# Searchable appointment entry

Goal: select records by typing and explicitly create missing customers, services, or categories without leaving or resetting the appointment draft.

Existing capabilities: Core customer/vehicle quick creation, service/category schemas and RLS, shared appointment forms, Pet Care scheduling, inventory forms.

Modules: shared accessible searchable selector; scoped record lookup and catalog creation; appointment, Pet Care, service, vehicle, and inventory record fields. Fixed workflow enums remain constrained choices.

Database/security: no schema migration expected. Reuse tenant-scoped tables and existing RLS. Resolve actor server-side; owner/manager catalog writes, operator customer writes. Validate category ownership and retry IDs. No automatic creation from free text.

Business/UI: multiple services remain supported; search by service or category; newly saved records become selected. Cancel inline creation preserves other fields. Search failures must not imply a record is missing. Keyboard, mobile, required fields, and submission state must work.

Compatibility: preserve form field names, Core scheduling, pricing, capacity, branch authorization, and existing records.

Validation: focused domain tests for scoped lookup, permissions, validation, retry behavior; browser tests for searching, confirmation/cancellation, multi-selection and mobile layout; lint, typecheck, unit suite, build and regression smoke tests. Review diff and RLS before reporting.

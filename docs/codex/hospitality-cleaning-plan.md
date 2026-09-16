# Room cleaning after checkout

Goal: occupied → cleaning at checkout → available only after staff confirm ready. Reuse rooms, checkout transaction, scoped roles/RLS, reports and dialogs. Append migration 0092; retain existing rooms/history without retroactively guessing their cleaning state. Extend Rooms, stay checkout copy, Overview, report/export and local tests.

Store the cleaning cycle using the departed stay ID plus required flag/completion actor/time. Checkout sets cleaning once; retries never re-dirty a ready room. A locked room readiness RPC checks the expected cycle, role and branch; stale confirmations cannot release a later cleaning cycle. A database trigger blocks new active stays while cleaning, sharing the check-in room lock. No financial/RLS policy changes. Housekeeping uses existing Operations Staff access; viewers remain read-only.

Acceptance: cleaning rooms cannot check in, counts/CSV agree, ready enables arrival, duplicate/stale actions safe, housekeeper has no money/rate-edit rights, branch/tenant isolation preserved, old stays retained, responsive accessible actions/cancel. Validate unit/integration/SQL/browser plus lint/typecheck/build; local databases only.

# Source feature and action inventory

Generated with `node --import tsx scripts/qa-inventory.ts`. Source discovery is not browser verification. Expressions, permission requirements and composed controls require manual expansion. See `verification-results.md` for executed suite evidence; no route is fully verified merely by loading.

| Source | Kind | Semantic ID | Action / destination | Literal label | Result |
| --- | --- | --- | --- | --- | --- |
| app/accept-invite/actions.ts:3 | server action | acceptInvitation | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/accept-invite/page.tsx:22 | form | "negosu-accept-invitation-form" | {acceptInvitation} |  | NOT EXECUTED individually |
| app/accept-invite/page.tsx:24 | SubmitButton | "negosu-accept-invitation-button" | (composed) | Accept invitation | NOT EXECUTED individually |
| app/apartelle-inn/page.tsx:34 | Link | "negosu-hospitality-sign-in-link" | {hospitalityBrand.loginPath} | Already have an account? Sign in | NOT EXECUTED individually |
| app/appointment/[token]/actions.ts:9 | server action | updatePublicSalonAppointment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/appointment/[token]/page.tsx:27 | form | "public-salon-appointment-confirm-form" | {updatePublicSalonAppointment} |  | NOT EXECUTED individually |
| app/appointment/[token]/page.tsx:27 | SubmitButton | "public-salon-appointment-confirm-button" | (composed) | Confirm appointment | NOT EXECUTED individually |
| app/appointment/[token]/page.tsx:27 | form | "public-salon-appointment-reschedule-form" | {updatePublicSalonAppointment} |  | NOT EXECUTED individually |
| app/appointment/[token]/page.tsx:27 | Input | "public-salon-appointment-reschedule-input" | "startsAt" | Choose a new time | NOT EXECUTED individually |
| app/appointment/[token]/page.tsx:27 | SubmitButton | "public-salon-appointment-reschedule-button" | (composed) | Reschedule appointment | NOT EXECUTED individually |
| app/auth/actions.ts:32 | server action | signIn | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/auth/actions.ts:54 | server action | signUp | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/auth/actions.ts:82 | server action | requestPasswordReset | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/auth/actions.ts:97 | server action | updatePassword | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/auth/actions.ts:114 | server action | signOut | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/booking/[token]/booking-status-refresh.tsx:25 | Button | "public-booking-status-refresh-button" | {refresh} |  | NOT EXECUTED individually |
| app/booking/[token]/page.tsx:93 | Link | "public-booking-status-shop-link" | {`/shop/${encodeURIComponent(safeShopSlug)}`} | Business page | NOT EXECUTED individually |
| app/booking/[token]/page.tsx:132 | Button | "booking-reservation-queue-link" | (composed) |  | NOT EXECUTED individually |
| app/booking/[token]/page.tsx:132 | Link | (unscoped) | {`/booking/${encodeURIComponent(token)}/queue`} | View your branch’s queue | NOT EXECUTED individually |
| app/booking/[token]/page.tsx:133 | Button | "public-booking-status-new-request-button" | (composed) |  | NOT EXECUTED individually |
| app/booking/[token]/page.tsx:133 | Link | (unscoped) | {`/shop/${encodeURIComponent(safeShopSlug)}/book`} | Create another booking | NOT EXECUTED individually |
| app/booking/[token]/queue/error.tsx:9 | button | "reservation-queue-retry" | {reset} | Try again | NOT EXECUTED individually |
| app/dashboard/actions.ts:10 | server action | switchOrganization | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/actions.ts:20 | server action | switchBranch | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:58 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:58 | Link | {salon?"salon-appointment-edit-button":"appointment-edit-button"} | {`/dashboard/appointments/${appointment.id}/edit`} | Edit | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:64 | form | "appointment-enqueue-form" | {enqueueAppointment} |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:64 | SubmitButton | "appointment-enqueue-button" | (composed) | Add to queue | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:64 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:64 | Link | (unscoped) | "/dashboard/queue" | View in queue | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:65 | form | (unscoped) | {createSalonAppointmentLink} |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:65 | SubmitButton | "salon-appointment-create-customer-link-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:66 | Button | "salon-appointment-record-payment-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:66 | Link | (unscoped) | {`/dashboard/appointments/${appointment.id}?dialog=payment`} | Record payment | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:68 | form | "salon-appointment-payment-form" | {recordSalonAppointmentPayment} |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:68 | Input | "salon-appointment-payment-amount-input" | "amount" | Amount PHP | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:68 | select | "salon-appointment-payment-method-select" | "method" |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:68 | Input | "salon-appointment-payment-reference-input" | "reference" | Reference | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:68 | Input | "salon-appointment-payment-notes-input" | "notes" | Notes | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:68 | SubmitButton | "salon-appointment-payment-save-button" | (composed) | Record payment | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:73 | form | {`appointment-${action}-form`} | {transitionAppointment} |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:73 | SubmitButton | {`appointment-${action}-button`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:76 | form | {`salon-appointment-${action}-form`} | {transitionSalonAppointment} |  | NOT EXECUTED individually |
| app/dashboard/appointments/[appointmentId]/page.tsx:76 | SubmitButton | {`salon-appointment-${action.replaceAll("_","-")}-button`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/entity-actions.ts:7 | server action | createAppointmentCustomer | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/appointments/entity-actions.ts:12 | server action | createAppointmentVehicle | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/appointments/entity-actions.ts:17 | server action | lookupRecords | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/appointments/entity-actions.ts:22 | server action | createAppointmentCategory | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/appointments/entity-actions.ts:27 | server action | createAppointmentService | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:49 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:49 | Link | "salon-add-walk-in-button" | "/dashboard/appointments/new?mode=walk-in" | Add walk-in | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:49 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:49 | Link | {salon?"salon-appointment-create-button":"appointment-create-button"} | "/dashboard/appointments/new" | New appointment | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:51 | ListTabs | "appointment-range-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:52 | form | {salon?"salon-appointments-filter-form":"appointments-filter-form"} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:52 | input | {salon?"salon-appointments-search-input":"appointments-search-input"} | "q" | Search | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:52 | input | {salon?"salon-appointments-date-input":"appointments-date-input"} | "date" | Date | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:52 | select | {salon?"salon-appointments-status-select":"appointments-status-select"} | "status" |  | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:52 | Button | {salon?"salon-appointments-filter-button":"appointments-filter-button"} | (composed) | Apply filters | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:54 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:54 | Link | {salon?"salon-appointments-clear-filters":"appointments-clear-filters"} | {`/dashboard/appointments?date=${date}&view=${params.view??"day"}`} | Clear filters | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:54 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:54 | Link | {salon?"salon-appointments-empty-create":"appointments-empty-create"} | "/dashboard/appointments/new" | Create appointment | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:55 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:55 | Link | (unscoped) | {href(Math.max(1,page-1))} | Previous | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:55 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/appointments/page.tsx:55 | Link | (unscoped) | {href(Math.min(pages,page+1))} | Next | NOT EXECUTED individually |
| app/dashboard/appointments/salon-actions.ts:18 | server action | transitionSalonAppointment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/appointments/salon-actions.ts:25 | server action | createSalonAppointmentLink | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/appointments/salon-actions.ts:33 | server action | recordSalonAppointmentPayment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/appointments/walk-in-actions.ts:20 | server action | saveAppointmentWalkIn | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/bookings/actions.ts:11 | server action | reviewBooking | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:68 | form | {`booking-request-confirm-form-${request.id}`} | {reviewBooking} |  | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:77 | SearchableSelect | {`pet-request-pet-${request.id}`} | "petId" |  | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:82 | SearchableSelect | {`pet-request-staff-${request.id}`} | "staffId" |  | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:86 | SearchableSelect | {`pet-request-resource-${request.id}`} | "resourceId" |  | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:94 | SubmitButton | {`booking-request-confirm-button-${request.id}`} | (composed) | Confirm and create appointment | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:100 | form | {`booking-request-decline-form-${request.id}`} | {reviewBooking} |  | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:108 | input | {`booking-request-decline-reason-${request.id}`} | "reason" |  | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:110 | SubmitButton | {`booking-request-decline-button-${request.id}`} | (composed) | Decline | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:125 | ListTabs | "booking-requests-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:126 | form | "booking-requests-search-form" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:126 | input | "booking-requests-search" | "q" |  | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:126 | Button | "booking-requests-search-button" | (composed) | Search | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:127 | Button | "booking-requests-retry-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/bookings/page.tsx:127 | Link | (unscoped) | {closeHref} | Try again | NOT EXECUTED individually |
| app/dashboard/crm-actions.ts:38 | server action | saveBranch | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/crm-actions.ts:52 | server action | setPrimaryBranch | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/crm-actions.ts:60 | server action | toggleBranch | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/crm-actions.ts:68 | server action | saveCustomer | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/crm-actions.ts:91 | server action | archiveCustomer | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/crm-actions.ts:99 | server action | saveVehicle | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/crm-actions.ts:122 | server action | archiveVehicle | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/layout.tsx:3 | Tabs | "customer-sections-navigation" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:29 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:29 | Link | (unscoped) | {`/dashboard/customers?edit=${data.id}`} | Edit | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:29 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:29 | Link | (unscoped) | {`/dashboard/vehicles/new?customerId=${data.id}`} | Add vehicle | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:29 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:29 | Link | "customer-book-appointment-button" | {activeMembership.industry==="pet_care"?`/dashboard/pet-care/appointments?dialog=create&customerId=${data.id}`:`/dashboard/appointments/new?customerId=${data.id}`} | Book appointment | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:31 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:31 | Link | "customer-add-pet-button" | {`/dashboard/pet-care/pets?dialog=create&customerId=${data.id}`} | Add pet | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:31 | Link | {`customer-pet-${pet.id}`} | {`/dashboard/pet-care/pets/${pet.id}`} | · · | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:32 | form | (unscoped) | {archiveCustomer} |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:32 | SubmitButton | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:33 | Link | {`salon-client-appointment-${appointment.id}`} | {activeMembership.industry === "pet_care" ? `/dashboard/pet-care/appointments/${appointment.id}` : `/dashboard/appointments/${appointment.id}`} |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/page.tsx:33 | Link | (unscoped) | {`/dashboard/vehicles/${vehicle.id}`} |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/preferences/page.tsx:32 | form | "customer-communication-preferences-form" | {saveCommunicationPreferences} |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/preferences/page.tsx:35 | input | "customer-transactional-email-opt-in" | "emailOptIn" |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/preferences/page.tsx:39 | input | "customer-transactional-sms-opt-in" | "smsOptIn" |  | NOT EXECUTED individually |
| app/dashboard/customers/[customerId]/preferences/page.tsx:43 | SubmitButton | "customer-communication-preferences-save-button" | (composed) | Save preferences | NOT EXECUTED individually |
| app/dashboard/customers/import/page.tsx:24 | Link | "customer-import-template-link" | "/dashboard/customers/import/template" | Download CSV template | NOT EXECUTED individually |
| app/dashboard/customers/import/page.tsx:24 | input | "customer-import-file-input" | (composed) | Choose CSV | NOT EXECUTED individually |
| app/dashboard/customers/import/page.tsx:24 | Link | "customer-import-back-link" | "/dashboard/customers" | Back to customers | NOT EXECUTED individually |
| app/dashboard/customers/new/page.tsx:12 | Link | "customer-import-link" | "/dashboard/customers/import" | Preview a CSV import | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:42 | Button | {salon?"salon-client-create-button":"customer-create-button"} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:42 | Link | (unscoped) | {`${listHref}&create=1`} | Add | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:44 | ListTabs | "customers-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:45 | form | {salon?"salon-clients-filter-form":"customers-filter-form"} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:46 | input | {salon?"salon-clients-search-input":"customers-search-input"} | "q" |  | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:47 | Button | {salon?"salon-clients-search-button":"customers-search-button"} | (composed) | Search | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:49 | Button | {`${salon?"salon-client":"customer"}-edit-${c.id}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:49 | Link | (unscoped) | {`${listHref}&edit=${c.id}`} | Edit | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:50 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:50 | Link | (unscoped) | "/dashboard/customers" | Clear filters | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:51 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:51 | Link | (unscoped) | {`?q=${encodeURIComponent(p.q??"")}&status=${p.status??"active"}&page=${Math.max(1,page-1)}`} | Previous | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:51 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/customers/page.tsx:51 | Link | (unscoped) | {`?q=${encodeURIComponent(p.q??"")}&status=${p.status??"active"}&page=${Math.min(pages,page+1)}`} | Next | NOT EXECUTED individually |
| app/dashboard/estimates/[estimateId]/page.tsx:4 | form | (unscoped) | {issueInvoice} |  | NOT EXECUTED individually |
| app/dashboard/estimates/[estimateId]/page.tsx:4 | SubmitButton | (unscoped) | (composed) | Issue invoice | NOT EXECUTED individually |
| app/dashboard/estimates/[estimateId]/page.tsx:5 | form | (unscoped) | {transitionEstimate} |  | NOT EXECUTED individually |
| app/dashboard/estimates/[estimateId]/page.tsx:5 | SubmitButton | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/actions.ts:16 | server action | saveRoom | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/hospitality/actions.ts:28 | server action | checkIn | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/hospitality/actions.ts:43 | server action | checkOut | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/hospitality/actions.ts:53 | server action | addCharge | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/hospitality/actions.ts:64 | server action | recordPayment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/hospitality/actions.ts:78 | server action | reverseStayPayment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/hospitality/actions.ts:96 | server action | markRoomReady | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/hospitality/actions.ts:107 | server action | extendStay | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/hospitality/actions.ts:123 | server action | saveReceipt | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:40 | Button | "hospitality-add-room-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:40 | Link | (unscoped) | {`${base}?tab=${tab}&dialog=room`} | Add room | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:41 | ListTabs | "hospitality-rooms-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:42 | form | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:42 | input | "hospitality-room-search" | "q" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:42 | Button | "hospitality-room-search-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:46 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:46 | Link | {`hospitality-check-in-${r.id}`} | {`${base}?tab=${tab}&dialog=check-in&room=${r.id}${q.guest ? `&guest=${encodeURIComponent(q.guest)}` : ""}`} |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:46 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:46 | Link | {`hospitality-check-out-${r.id}`} | {`/dashboard/hospitality/stays/${r.stay_id}?dialog=checkout`} |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:46 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:46 | Link | {`hospitality-mark-ready-${r.id}`} | {`${base}?tab=${tab}&dialog=ready&room=${r.id}`} |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:46 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:46 | Link | (unscoped) | {`${base}?tab=all&dialog=room&room=${r.id}`} |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:50 | input | "hospitality-room-name" | "name" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:50 | input | "hospitality-room-type" | "roomType" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:50 | input | "hospitality-room-capacity" | "capacity" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:50 | input | "hospitality-room-active" | "active" | Active room | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:52 | textarea | "hospitality-room-description" | "description" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:56 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:56 | Link | (unscoped) | {`${base}?tab=${tab}&dialog=check-in&room=${room.id}`} | Check in | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:56 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:56 | Link | (unscoped) | {`${base}?tab=${tab}&dialog=ready&room=${room.id}`} | Mark ready | NOT EXECUTED individually |
| app/dashboard/hospitality/rooms/page.tsx:56 | Link | (unscoped) | {`/dashboard/hospitality/stays/${room.stay_id}`} | View occupied stay | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:58 | Button | "hospitality-check-out-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:58 | Link | (unscoped) | {`${base}?dialog=checkout`} | Check out | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:60 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:60 | Link | "hospitality-extend-button" | {`${base}?dialog=extend`} | Extend stay | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:68 | ListTabs | "hospitality-stay-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:69 | Link | (unscoped) | {`/dashboard/customers/${stay.guest_id}`} |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:72 | Button | "hospitality-add-charge-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:72 | Link | (unscoped) | {`${base}?tab=charges&dialog=charge`} | Additional charge | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:72 | Button | "hospitality-record-payment-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:72 | Link | (unscoped) | {`${base}?tab=charges&dialog=payment`} | Record payment | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:72 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:72 | Link | "hospitality-receipt-link" | {`${base}/receipt`} | Statement | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:74 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:74 | Link | "hospitality-edit-receipt-button" | {`${base}?tab=charges&dialog=receipt`} | Edit receipt number | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:77 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:77 | Link | (unscoped) | {`${base}?tab=charges&dialog=reverse&payment=${p.id}&page=${page}`} |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:80 | input | "hospitality-charge-description" | "description" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:80 | input | "hospitality-charge-quantity" | "quantity" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:80 | input | "hospitality-charge-amount" | "amount" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:81 | input | "hospitality-payment-amount" | "amount" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:81 | select | "hospitality-payment-method" | "method" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:81 | input | "hospitality-payment-date" | "paidDate" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:81 | input | "hospitality-payment-reference" | "reference" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:81 | input | "hospitality-payment-receipt-number" | "receiptNumber" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:81 | textarea | "hospitality-payment-notes" | "notes" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:82 | input | "hospitality-stay-receipt-number" | "receiptNumber" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:84 | select | "hospitality-reversal-kind" | "reversal" |  | NOT EXECUTED individually |
| app/dashboard/hospitality/stays/[stayId]/page.tsx:84 | input | "hospitality-reversal-reason" | "reason" |  | NOT EXECUTED individually |
| app/dashboard/inbox/actions.ts:9 | server action | manageChat | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/inbox/conversation.tsx:11 | Button | "inbox-refresh" | {() => router.refresh()} | Refresh | NOT EXECUTED individually |
| app/dashboard/inbox/conversation.tsx:35 | form | "inbox-reply-form" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/inbox/conversation.tsx:35 | textarea | "inbox-reply" | (composed) | Reply | NOT EXECUTED individually |
| app/dashboard/inbox/conversation.tsx:35 | Button | "inbox-close-conversation" | {() => { void submit("close"); }} | Close conversation | NOT EXECUTED individually |
| app/dashboard/inbox/conversation.tsx:35 | Button | "inbox-send-reply" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/inbox/conversation.tsx:35 | Button | "inbox-reopen-conversation" | {() => { void submit("reopen"); }} | Reopen conversation | NOT EXECUTED individually |
| app/dashboard/inbox/page.tsx:32 | ListTabs | "customer-inbox-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/inbox/page.tsx:33 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/inbox/page.tsx:33 | Link | (unscoped) | {`/dashboard/inbox?tab=${tab}&page=${page - 1}`} | Previous | NOT EXECUTED individually |
| app/dashboard/inbox/page.tsx:33 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/inbox/page.tsx:33 | Link | (unscoped) | {`/dashboard/inbox?tab=${tab}&page=${page + 1}`} | Next | NOT EXECUTED individually |
| app/dashboard/inventory/actions.ts:18 | server action | createInventoryItem | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/inventory/actions.ts:30 | server action | recordMovement | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/inventory/actions.ts:42 | server action | transferStock | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/inventory/actions.ts:54 | server action | saveRecipe | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:30 | form | (unscoped) | {recordPayment} |  | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:30 | Input | (unscoped) | "amount" | Amount PHP | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:30 | select | (unscoped) | "method" |  | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:30 | Input | (unscoped) | "reference" | Reference | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:30 | Input | (unscoped) | "notes" | Notes | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:30 | SubmitButton | "record-payment-save-button" | (composed) | Record payment | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:31 | form | (unscoped) | {reversePayment} |  | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:31 | select | (unscoped) | "action" |  | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:31 | Input | (unscoped) | "note" |  | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:31 | SubmitButton | {`invoice-payment-reversal-${payment.id}-save-button`} | (composed) | Reverse | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:32 | form | (unscoped) | {voidInvoice} |  | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:32 | Input | (unscoped) | "reason" |  | NOT EXECUTED individually |
| app/dashboard/invoices/[invoiceId]/page.tsx:32 | SubmitButton | "void-invoice-save-button" | (composed) | Void invoice | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:5 | server action | startQueueJob | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:6 | server action | transitionJob | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:7 | server action | startTechnicianWork | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:8 | server action | endTechnicianWork | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:9 | server action | assignJob | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:10 | server action | saveInspection | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:11 | server action | uploadJobPhoto | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:12 | server action | createEstimate | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:13 | server action | transitionEstimate | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:14 | server action | issueInvoice | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:15 | server action | recordPayment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:16 | server action | addJobService | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:17 | server action | transitionJobService | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:18 | server action | reversePayment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:19 | server action | voidInvoice | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/job-actions.ts:20 | server action | assignJobItem | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/layout.tsx:3 | Tabs | "job-order-sections-navigation" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:97 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:97 | Link | (unscoped) | {`/dashboard/jobs/${j.id}?print=1`} | Print | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:97 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:97 | Link | (unscoped) | {`/dashboard/invoices/${invoice.id}`} | Invoice | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:100 | a | (unscoped) | {`#job-order-${id}-section`} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:104 | form | (unscoped) | {assignJob} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:104 | SearchableSelect | "job-order-technician-select" | "staffId" | Technician | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:104 | Input | "job-order-promised-at-input" | "promisedAt" | Promised completion | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:104 | SubmitButton | "assign-job-save-button" | (composed) | Save assignment | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:106 | form | "job-order-inspection-form" | {saveInspection} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:106 | Input | (unscoped) | "odometerIn" | Odometer in | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:106 | Input | (unscoped) | "fuelLevel" | Fuel level % | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:106 | textarea | (unscoped) | {name} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:106 | SubmitButton | "job-order-save-inspection-button" | (composed) | Save inspection | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:107 | Button | "job-order-add-estimate-item-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:107 | Link | (unscoped) | {`/dashboard/jobs/${j.id}?dialog=estimate-item`} | Add item | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:107 | Link | (unscoped) | {`/dashboard/jobs/${j.id}?dialog=estimate-item&item=${item.id}`} | Edit | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:107 | Link | (unscoped) | {`/dashboard/jobs/${j.id}?dialog=estimate-item&item=${item.id}`} | Edit | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:107 | form | (unscoped) | {createEstimate} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:107 | SubmitButton | (unscoped) | (composed) | Prepare estimate | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:108 | Button | "job-order-record-payment-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:108 | Link | (unscoped) | {`/dashboard/jobs/${j.id}?dialog=payment`} | Record payment | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:108 | form | (unscoped) | {issueInvoice} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:108 | SubmitButton | (unscoped) | (composed) | Issue invoice | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:109 | form | (unscoped) | {uploadJobPhoto} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:109 | select | (unscoped) | "category" |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:109 | input | (unscoped) | "photo" |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:109 | SubmitButton | "upload-job-photo-save-button" | (composed) | Upload | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:109 | a | (unscoped) | {photo.url} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:111 | Button | "job-order-share-approval-link-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:111 | Link | (unscoped) | {`/dashboard/jobs/${j.id}?dialog=approval-link`} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:111 | Button | "job-order-record-authorization-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:111 | Link | (unscoped) | {`/dashboard/jobs/${j.id}?dialog=authorization`} | Record manually | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:113 | form | "job-order-estimate-item-form" | {saveAdvisorEstimateItem} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:113 | select | "estimate-item-type-select" | "itemType" |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:113 | SearchableSelect | "estimate-item-inventory-select" | "inventoryItemId" | Branch inventory | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:113 | Input | "estimate-item-description-input" | "description" | Description | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:113 | Input | "estimate-item-quantity-input" | "quantity" | Quantity | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:113 | Input | "estimate-item-price-input" | "unitPrice" | Unit price PHP | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:113 | Input | "estimate-item-discount-input" | "discount" | Line discount PHP | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:113 | SubmitButton | "estimate-item-save-button" | (composed) | Save item | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:114 | Button | "job-order-revoke-approval-link-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:114 | Link | (unscoped) | {`/dashboard/jobs/${j.id}?dialog=approval-link-revoke`} | Revoke link | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:115 | form | "job-order-revoke-approval-link-form" | {revokeEstimateApprovalLinkAction} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:115 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:115 | Link | (unscoped) | {`/dashboard/jobs/${j.id}?dialog=approval-link`} | Keep link | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:115 | SubmitButton | "job-order-confirm-revoke-approval-link-button" | (composed) | Revoke link | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:116 | form | "job-order-authorization-form" | {recordAdvisorAuthorization} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:116 | select | "authorization-decision-select" | "decision" |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:116 | select | "authorization-method-select" | "method" |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:116 | textarea | "authorization-notes-input" | "note" | Notes | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:116 | SubmitButton | "authorization-save-button" | (composed) | Record decision | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:117 | form | "job-order-payment-form" | {recordAdvisorPayment} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:117 | Input | "job-order-payment-amount-input" | "amount" | Amount PHP | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:117 | select | "job-order-payment-method-select" | "method" |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:117 | Input | (unscoped) | "reference" | Reference | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:117 | Input | (unscoped) | "notes" | Notes | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:117 | SubmitButton | "job-order-payment-save-button" | (composed) | Record payment | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:118 | form | "inventory-reservation-form" | {reserveAdvisorJobPart} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:118 | Input | "inventory-reservation-quantity-input" | "quantity" | Quantity ( ) | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:118 | SubmitButton | "inventory-reservation-submit-button" | (composed) | Reserve part | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:119 | form | "inventory-consumption-form" | {consumeAdvisorJobPart} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:119 | Input | "inventory-consumption-quantity-input" | "quantity" | Quantity used ( ) | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:119 | SubmitButton | "inventory-consumption-submit-button" | (composed) | Record usage | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:120 | form | "inventory-release-form" | {releaseAdvisorJobPart} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:120 | Input | "inventory-release-quantity-input" | "quantity" | Quantity to release ( ) | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:120 | SubmitButton | "inventory-release-submit-button" | (composed) | Release reservation | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:159 | Link | {`job-order-part-reserve-button-${part.inventoryItemId}-${context}`} | {`/dashboard/jobs/${jobOrderId}?dialog=reserve-part&part=${part.inventoryItemId}`} | Reserve | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:160 | Link | {`job-order-part-consume-button-${part.inventoryItemId}-${context}`} | {`/dashboard/jobs/${jobOrderId}?dialog=consume-part&part=${part.inventoryItemId}`} | Use | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:161 | Link | {`job-order-part-release-button-${part.inventoryItemId}-${context}`} | {`/dashboard/jobs/${jobOrderId}?dialog=release-part&part=${part.inventoryItemId}`} | Release | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:164 | form | (unscoped) | {reserveAdvisorRequiredJobParts} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:164 | SubmitButton | "job-order-reserve-parts-button" | (composed) | Reserve required parts | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:185 | form | (unscoped) | {retryEstimateApprovalNotificationAction} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:185 | SubmitButton | {`notification-retry-button-${row.outbox_id}`} | (composed) | Retry | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:190 | form | (unscoped) | {transitionJob} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:190 | SubmitButton | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:192 | form | (unscoped) | {createEstimate} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:192 | SubmitButton | (unscoped) | (composed) | Prepare estimate | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:193 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:193 | Link | (unscoped) | {`/dashboard/jobs/${jobId}?dialog=authorization`} | Record authorization | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:194 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:194 | Link | (unscoped) | "#job-order-estimate-section" | Check parts | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:195 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:195 | a | (unscoped) | "#job-order-work-tracking-section" | Start technician timer | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:196 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:196 | a | (unscoped) | "#job-order-work-tracking-section" | Resume technician timer | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:198 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/page.tsx:198 | Link | (unscoped) | {`/dashboard/jobs/${jobId}?dialog=payment`} | Record payment | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:56 | Button | "job-order-work-back-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:56 | Link | (unscoped) | {`/dashboard/jobs/${jobId}`} | Back to job | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:69 | form | {`job-order-work-assignment-form-${item.id}`} | {assignJobItem} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:73 | SearchableSelect | {`job-order-work-technician-select-${item.id}`} | "staffId" |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:74 | SubmitButton | {`job-order-work-assign-button-${item.id}`} | (composed) | Assign | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:86 | form | "job-order-additional-work-form" | {addJobService} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:89 | SearchableSelect | "job-order-additional-service-select" | "serviceId" | Service | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:92 | Input | "job-order-additional-quantity-input" | "quantity" | Quantity | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:95 | input | "job-order-additional-approval-checkbox" | "requiresApproval" | Customer approval required | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:98 | textarea | "job-order-additional-notes-input" | "notes" | Notes | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:100 | SubmitButton | "job-order-additional-work-save-button" | (composed) | Add work | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:108 | form | {`job-order-work-${action}-form-${itemId}`} | {transitionJobService} |  | NOT EXECUTED individually |
| app/dashboard/jobs/[jobId]/work/page.tsx:110 | SubmitButton | {`job-order-work-${action}-button-${itemId}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/advisor-actions.ts:33 | server action | recoverEstimateApprovalLinkAction | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/advisor-actions.ts:42 | server action | generateEstimateApprovalLinkAction | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/advisor-actions.ts:53 | server action | retryEstimateApprovalNotificationAction | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/advisor-actions.ts:65 | server action | revokeEstimateApprovalLinkAction | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/advisor-actions.ts:73 | server action | saveAdvisorEstimateItem | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/advisor-actions.ts:82 | server action | recordAdvisorAuthorization | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/advisor-actions.ts:90 | server action | recordAdvisorPayment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/advisor-actions.ts:99 | server action | reserveAdvisorJobPart | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/advisor-actions.ts:108 | server action | reserveAdvisorRequiredJobParts | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/advisor-actions.ts:117 | server action | consumeAdvisorJobPart | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/advisor-actions.ts:126 | server action | releaseAdvisorJobPart | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/jobs/page.tsx:24 | ListTabs | "job-orders-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/page.tsx:25 | form | "job-orders-filter-form" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/page.tsx:25 | input | "job-orders-search-input" | "q" |  | NOT EXECUTED individually |
| app/dashboard/jobs/page.tsx:25 | select | "job-orders-status-filter" | "status" |  | NOT EXECUTED individually |
| app/dashboard/jobs/page.tsx:25 | Button | (unscoped) | (composed) | Filter | NOT EXECUTED individually |
| app/dashboard/jobs/page.tsx:26 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/jobs/page.tsx:26 | Link | (unscoped) | "/dashboard/jobs" | Clear filters | NOT EXECUTED individually |
| app/dashboard/my-work/page.tsx:47 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/my-work/page.tsx:47 | Link | (unscoped) | "/dashboard/jobs" | All Job Orders | NOT EXECUTED individually |
| app/dashboard/my-work/page.tsx:49 | ListTabs | "technician-work-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/my-work/page.tsx:58 | form | {`technician-${action}-work-form-${session.id}`} | {endTechnicianWork} |  | NOT EXECUTED individually |
| app/dashboard/my-work/page.tsx:58 | SubmitButton | {`technician-${action}-work-button-${session.id}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/operations-actions.ts:19 | server action | saveCategory | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/operations-actions.ts:30 | server action | deleteCategory | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/operations-actions.ts:49 | server action | saveService | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/operations-actions.ts:76 | server action | toggleService | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/operations-actions.ts:104 | server action | saveAppointment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/operations-actions.ts:123 | server action | transitionAppointment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/operations-actions.ts:124 | server action | enqueueAppointment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/operations-actions.ts:125 | server action | createWalkIn | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/operations-actions.ts:149 | server action | transitionQueue | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/operations-actions.ts:151 | server action | addStarterServices | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/page.tsx:38 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/page.tsx:38 | Link | (unscoped) | "/dashboard" | Current branch | NOT EXECUTED individually |
| app/dashboard/page.tsx:38 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/page.tsx:38 | Link | (unscoped) | "/dashboard/settings" | Settings | NOT EXECUTED individually |
| app/dashboard/page.tsx:86 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/page.tsx:86 | Link | "negosu-staff-dashboard-new-appointment" | "/dashboard/appointments/new" | New Appointment | NOT EXECUTED individually |
| app/dashboard/page.tsx:87 | Link | (unscoped) | "/dashboard/appointments" | View all | NOT EXECUTED individually |
| app/dashboard/page.tsx:95 | Link | {`negosu-staff-dashboard-appointment-${appointment.id}`} | {`/dashboard/appointments/${appointment.id}`} |  | NOT EXECUTED individually |
| app/dashboard/pet-care/actions.ts:21 | server action | savePet | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/pet-care/actions.ts:30 | server action | savePetAppointment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/pet-care/actions.ts:43 | server action | transitionPet | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/pet-care/actions.ts:49 | server action | payPetAppointment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/pet-care/actions.ts:58 | server action | createPetLink | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/pet-care/actions.ts:66 | server action | reschedulePetAppointment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/pet-care/actions.ts:80 | server action | addGroomingNote | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/pet-care/actions.ts:89 | server action | createAppointmentPet | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:44 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:44 | Link | "pet-appointment-reschedule-button" | {`${href}?dialog=reschedule`} | Reschedule | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:45 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:45 | Link | "pet-appointment-close-button" | "/dashboard/pet-care/appointments" | Close | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:53 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:53 | Link | "pet-appointment-profile-link" | {`/dashboard/pet-care/pets/${d.pet_id}`} | Pet profile | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:55 | form | (unscoped) | {transitionPet} |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:55 | SubmitButton | {`pet-${action === "ready" ? "ready-for-pickup" : action === "collect" ? "collected" : action}-button`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:56 | form | (unscoped) | {createPetLink} |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:56 | SubmitButton | "pet-create-link-button" | (composed) | Create link | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:56 | Link | "pet-customer-link" | {query.link} |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:57 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:57 | Link | "pet-record-payment-toggle" | {`${href}?dialog=payment`} | Record payment | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:59 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:59 | Link | "pet-grooming-note-add-button" | {`${href}?dialog=note`} | Add note | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:60 | form | "pet-payment-form" | {payPetAppointment} |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:60 | Input | "pet-payment-amount" | "amount" | Amount ( ) | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:60 | select | "pet-payment-method" | "method" |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:60 | Input | "pet-payment-reference" | "reference" | Reference (optional) | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:60 | SubmitButton | "pet-payment-save" | (composed) | Record payment | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:61 | form | "pet-grooming-note-form" | {addGroomingNote} |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:61 | textarea | "pet-grooming-note-input" | "note" | Grooming result and observations | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:61 | Input | "pet-grooming-next-visit" | "nextVisitOn" | Recommended return date (optional) | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:61 | SubmitButton | "pet-grooming-note-save" | (composed) | Save visit note | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:62 | form | "pet-reschedule-form" | {reschedulePetAppointment} |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:62 | Input | "pet-reschedule-time" | "startsAt" | New appointment time ( ) | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/[appointmentId]/page.tsx:62 | SubmitButton | "pet-reschedule-save" | (composed) | Save time | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:39 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:39 | Link | "pet-add-walk-in-button" | "/dashboard/pet-care/appointments?dialog=walk-in" | Add walk-in | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:39 | Button | "pet-appointment-create-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:39 | Link | (unscoped) | "/dashboard/pet-care/appointments?dialog=create" | Book appointment | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:40 | ListTabs | "pet-appointment-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:41 | form | "pet-appointment-filters" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:41 | Input | "pet-schedule-search" | "q" | Search pet | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:41 | Input | "pet-schedule-date" | "date" | Date ( ) | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:41 | select | "pet-schedule-status" | "status" |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:41 | Button | "pet-schedule-reset" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:41 | Link | (unscoped) | "/dashboard/pet-care/appointments" | Reset | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:41 | Button | "pet-schedule-filter" | (composed) | Filter | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:46 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:46 | Link | "pet-schedule-previous" | {pageHref(page-1)} | Previous | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:46 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/appointments/page.tsx:46 | Link | "pet-schedule-next" | {pageHref(page+1)} | Next | NOT EXECUTED individually |
| app/dashboard/pet-care/page.tsx:29 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/page.tsx:29 | Link | "pet-dashboard-walk-in-button" | "/dashboard/pet-care/appointments?dialog=walk-in" | Add walk-in | NOT EXECUTED individually |
| app/dashboard/pet-care/page.tsx:29 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/page.tsx:29 | Link | "pet-dashboard-book-button" | "/dashboard/pet-care/appointments?dialog=create" | Book appointment | NOT EXECUTED individually |
| app/dashboard/pet-care/page.tsx:29 | Link | {`pet-today-${a.id}`} | {`/dashboard/pet-care/appointments/${a.id}`} |  | NOT EXECUTED individually |
| app/dashboard/pet-care/page.tsx:29 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/page.tsx:29 | Link | "pet-dashboard-pets-link" | "/dashboard/pet-care/pets" | Pets | NOT EXECUTED individually |
| app/dashboard/pet-care/page.tsx:29 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/page.tsx:29 | Link | "pet-dashboard-setup-link" | "/onboarding/setup" | Setup checklist | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/[petId]/page.tsx:18 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/[petId]/page.tsx:18 | Link | (unscoped) | "/dashboard/pet-care/pets" | Pets | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/[petId]/page.tsx:18 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/[petId]/page.tsx:18 | Link | "pet-detail-edit-button" | {`/dashboard/pet-care/pets?dialog=edit&petId=${pet.id}`} | Edit | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/[petId]/page.tsx:18 | Link | "pet-owner-profile-link" | {`/dashboard/customers/${pet.customer_id}`} | Owner profile | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/[petId]/page.tsx:18 | Link | {`pet-tab-${key}`} | {`?tab=${key}`} |  | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/[petId]/page.tsx:19 | Link | {`pet-history-${v.appointment_id}`} | {`/dashboard/pet-care/appointments/${v.appointment_id}`} | · | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/page.tsx:19 | Button | "pet-create-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/page.tsx:19 | Link | (unscoped) | "/dashboard/pet-care/pets?dialog=create" | Add pet | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/page.tsx:20 | ListTabs | "pets-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/page.tsx:21 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/pet-care/pets/page.tsx:21 | Link | {`pet-edit-${pet.id}`} | {`/dashboard/pet-care/pets?dialog=edit&petId=${pet.id}`} | Edit | NOT EXECUTED individually |
| app/dashboard/queue/page.tsx:44 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/queue/page.tsx:44 | Link | "queue-add-walk-in-button" | "/dashboard/queue/new" | Add walk-in | NOT EXECUTED individually |
| app/dashboard/queue/page.tsx:44 | form | "queue-search-form" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/queue/page.tsx:44 | input | "queue-search-input" | "q" |  | NOT EXECUTED individually |
| app/dashboard/queue/page.tsx:44 | Button | "queue-search-button" | (composed) | Search | NOT EXECUTED individually |
| app/dashboard/queue/page.tsx:52 | form | {`appointment-job-order-conversion-form-${entry.id}`} | {startQueueJob} |  | NOT EXECUTED individually |
| app/dashboard/queue/page.tsx:52 | input | {`appointment-job-order-copy-staff-checkbox-${entry.id}`} | "copyScheduledStaff" | Assign scheduled staff to this Job Order | NOT EXECUTED individually |
| app/dashboard/queue/page.tsx:52 | select | {`appointment-job-order-staff-select-${entry.id}`} | "scheduledStaffId" |  | NOT EXECUTED individually |
| app/dashboard/queue/page.tsx:52 | SubmitButton | {`appointment-job-order-convert-button-${entry.id}`} | (composed) | Start job | NOT EXECUTED individually |
| app/dashboard/queue/page.tsx:57 | form | {`queue-${status}-form-${id}`} | {transitionQueue} |  | NOT EXECUTED individually |
| app/dashboard/queue/page.tsx:57 | SubmitButton | {`queue-${status}-button-${id}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/reminders/actions.ts:5 | server action | saveMaintenanceRule | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/reminders/actions.ts:6 | server action | dismissVehicleMaintenance | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/reminders/actions.ts:7 | server action | snoozeVehicleMaintenance | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/reminders/actions.ts:8 | server action | resumeVehicleMaintenance | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/reminders/actions.ts:9 | server action | activateBackfilledMaintenance | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/reminders/actions.ts:10 | server action | saveCommunicationPreferences | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:77 | ListTabs | "maintenance-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:79 | Link | {`maintenance-${status}-filter`} | {`/dashboard/reminders?status=${status}`} |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:80 | form | "maintenance-filters" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:80 | Input | "maintenance-search-input" | "q" |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:80 | select | "maintenance-status-select" | "status" |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:80 | Button | "maintenance-filter-button" | (composed) | Filter | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:84 | form | "maintenance-rule-form" | {saveMaintenanceRule} |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:84 | SearchableSelect | "maintenance-rule-service-select" | "serviceId" | Service | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:84 | Input | "maintenance-rule-months-input" | "intervalMonths" |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:84 | Input | "maintenance-rule-km-input" | "intervalKm" |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:84 | Input | "maintenance-rule-lead-input" | "leadDays" |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:84 | SubmitButton | "maintenance-rule-save-button" | (composed) | Save interval | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:86 | form | "maintenance-snooze-form" | {snoozeVehicleMaintenance} |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:86 | Input | "maintenance-snooze-until-input" | "snoozedUntil" | Snooze until | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:86 | textarea | "maintenance-snooze-reason-input" | "reason" | Reason (optional) | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:86 | SubmitButton | "maintenance-snooze-confirm-button" | (composed) | Snooze reminder | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:87 | form | "maintenance-dismiss-form" | {dismissVehicleMaintenance} |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:87 | textarea | "maintenance-dismiss-reason-input" | "reason" | Reason | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:87 | SubmitButton | "maintenance-dismiss-confirm-button" | (composed) | Dismiss recommendation | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:94 | Link | (unscoped) | {`/dashboard/appointments/${row.appointment_id}`} |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:100 | Button | {`maintenance-create-appointment-button-${row.id}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:100 | Link | (unscoped) | {`/dashboard/appointments/new?maintenanceDueId=${row.id}`} | Create appointment | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:100 | form | (unscoped) | {resumeVehicleMaintenance} |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:100 | SubmitButton | {`maintenance-resume-reminders-button-${row.id}`} | (composed) | Resume | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:100 | Button | {`maintenance-snooze-button-${row.id}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:100 | Link | (unscoped) | {`/dashboard/reminders?dialog=snooze&id=${row.id}`} | Snooze | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:100 | form | (unscoped) | {activateBackfilledMaintenance} |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:100 | SubmitButton | {`maintenance-activate-reminders-button-${row.id}`} | (composed) | Activate reminders | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:100 | Button | {`maintenance-dismiss-button-${row.id}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/reminders/page.tsx:100 | Link | (unscoped) | {`/dashboard/reminders?dialog=dismiss&id=${row.id}`} | Dismiss | NOT EXECUTED individually |
| app/dashboard/reports/page.tsx:94 | Button | "reports-export-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/reports/page.tsx:95 | Link | (unscoped) | {`/dashboard/reports/export?${exportQuery}`} | Export CSV | NOT EXECUTED individually |
| app/dashboard/reports/page.tsx:107 | form | "reports-filter-form" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/reports/page.tsx:111 | select | "reports-period-select" | "preset" |  | NOT EXECUTED individually |
| app/dashboard/reports/page.tsx:115 | input | "reports-start-date-input" | "start" | From | NOT EXECUTED individually |
| app/dashboard/reports/page.tsx:116 | input | "reports-end-date-input" | "end" | To | NOT EXECUTED individually |
| app/dashboard/reports/page.tsx:119 | select | "reports-branch-select" | "branch" |  | NOT EXECUTED individually |
| app/dashboard/reports/page.tsx:124 | Button | "reports-apply-filters-button" | (composed) | Apply | NOT EXECUTED individually |
| app/dashboard/reports/page.tsx:136 | Tabs | "reports-section-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/reports/page.tsx:170 | Button | "reports-retry-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/reports/page.tsx:170 | Link | (unscoped) | "/dashboard/reports" | Try again | NOT EXECUTED individually |
| app/dashboard/services/[serviceId]/page.tsx:123 | Button | {isSalon ? "salon-treatment-edit-button" : undefined} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/services/[serviceId]/page.tsx:128 | Link | (unscoped) | {`/dashboard/services/${service.id}/edit`} | Edit | NOT EXECUTED individually |
| app/dashboard/services/[serviceId]/page.tsx:216 | form | (unscoped) | {toggleService} |  | NOT EXECUTED individually |
| app/dashboard/services/[serviceId]/page.tsx:229 | SubmitButton | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/services/page.tsx:45 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/services/page.tsx:45 | Link | "starter-services-open-button" | "/dashboard/services?dialog=starter-services" | Starter services | NOT EXECUTED individually |
| app/dashboard/services/page.tsx:45 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/services/page.tsx:45 | Link | {salon ? "salon-treatment-create-button" : "service-create-button"} | "/dashboard/services/new" | Add | NOT EXECUTED individually |
| app/dashboard/services/page.tsx:47 | Tabs | "service-catalog-sections" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/services/page.tsx:52 | form | {salon ? "salon-treatments-filter-form" : "services-filter-form"} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/services/page.tsx:53 | Input | {salon ? "salon-treatments-search-input" : "services-search-input"} | "q" |  | NOT EXECUTED individually |
| app/dashboard/services/page.tsx:54 | select | {salon ? "salon-treatments-category-filter" : "services-category-filter"} | "category" |  | NOT EXECUTED individually |
| app/dashboard/services/page.tsx:55 | Button | {salon ? "salon-treatments-filter-button" : "services-filter-button"} | (composed) | Search | NOT EXECUTED individually |
| app/dashboard/services/page.tsx:62 | form | "starter-services-form" | {addStarterServices} |  | NOT EXECUTED individually |
| app/dashboard/services/page.tsx:62 | SubmitButton | "starter-services-add-button" | (composed) | Add starter services | NOT EXECUTED individually |
| app/dashboard/settings/actions.ts:19 | server action | updateProfile | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/actions.ts:29 | server action | updateDashboardTheme | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/actions.ts:39 | server action | updateBusinessBranding | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/actions.ts:21 | server action | startCheckout | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/actions.ts:49 | server action | openBillingPortal | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/history/page.tsx:24 | Button | "billing-history-plans" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/history/page.tsx:24 | Link | (unscoped) | "/dashboard/settings/billing" | View plans | NOT EXECUTED individually |
| app/dashboard/settings/billing/history/page.tsx:25 | ListTabs | "billing-history-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/history/page.tsx:26 | Button | "billing-history-retry" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/history/page.tsx:26 | Link | (unscoped) | {href(page)} | Try again | NOT EXECUTED individually |
| app/dashboard/settings/billing/history/page.tsx:26 | Button | "billing-history-previous" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/history/page.tsx:26 | Link | (unscoped) | {href(page - 1)} | Previous | NOT EXECUTED individually |
| app/dashboard/settings/billing/history/page.tsx:26 | Button | "billing-history-next" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/history/page.tsx:26 | Link | (unscoped) | {href(page + 1)} | Next | NOT EXECUTED individually |
| app/dashboard/settings/billing/orders/[orderId]/page.tsx:20 | Link | (unscoped) | "/dashboard/settings/billing/history" | Return to payment history | NOT EXECUTED individually |
| app/dashboard/settings/billing/orders/[orderId]/page.tsx:27 | Button | "billing-order-close" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/orders/[orderId]/page.tsx:27 | Link | (unscoped) | "/dashboard/settings/billing" | Close | NOT EXECUTED individually |
| app/dashboard/settings/billing/orders/[orderId]/page.tsx:32 | form | (unscoped) | {cancelPayment} |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/orders/[orderId]/page.tsx:32 | SubmitButton | "billing-payment-cancel" | (composed) | Cancel payment | NOT EXECUTED individually |
| app/dashboard/settings/billing/orders/[orderId]/page.tsx:32 | form | (unscoped) | {resumePayment} |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/orders/[orderId]/page.tsx:32 | SubmitButton | "billing-payment-resume" | (composed) | Resume checkout | NOT EXECUTED individually |
| app/dashboard/settings/billing/orders/[orderId]/page.tsx:32 | Button | "billing-payment-done" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/orders/[orderId]/page.tsx:32 | Link | (unscoped) | {paid ? "/dashboard" : "/dashboard/settings/billing"} |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/paymongo-actions.ts:21 | server action | purchasePlan | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/paymongo-actions.ts:41 | server action | refreshPaymentStatus | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/paymongo-actions.ts:49 | server action | resumePayment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/paymongo-actions.ts:64 | server action | cancelPayment | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/upgrade/page.tsx:25 | Button | "billing-upgrade-close" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/upgrade/page.tsx:25 | Link | (unscoped) | "/dashboard/settings/billing" | Close | NOT EXECUTED individually |
| app/dashboard/settings/billing/upgrade/page.tsx:29 | form | "billing-upgrade-term-form" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/upgrade/page.tsx:30 | select | "billing-upgrade-interval" | "interval" |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/upgrade/page.tsx:30 | Button | "billing-upgrade-update" | (composed) | Update | NOT EXECUTED individually |
| app/dashboard/settings/billing/upgrade/page.tsx:35 | form | "billing-upgrade-confirm-form" | {purchasePlan} |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/upgrade/page.tsx:37 | input | "billing-upgrade-accept" | "accepted" |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/upgrade/page.tsx:38 | Button | "billing-upgrade-cancel" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/billing/upgrade/page.tsx:38 | Link | (unscoped) | "/dashboard/settings/billing" | Cancel | NOT EXECUTED individually |
| app/dashboard/settings/billing/upgrade/page.tsx:38 | SubmitButton | "billing-upgrade-pay" | (composed) | Continue to PayMongo | NOT EXECUTED individually |
| app/dashboard/settings/branches/page.tsx:29 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/branches/page.tsx:29 | Link | "branch-create-button" | "/dashboard/settings/branches/new" | Add branch | NOT EXECUTED individually |
| app/dashboard/settings/branches/page.tsx:31 | ListTabs | "branches-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/branches/page.tsx:34 | Button | {`branch-edit-button-${branch.id}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/branches/page.tsx:34 | Link | (unscoped) | {`/dashboard/settings/branches/${branch.id}/edit`} | Edit | NOT EXECUTED individually |
| app/dashboard/settings/branches/page.tsx:35 | form | {`branch-default-form-${branch.id}`} | {setPrimaryBranch} |  | NOT EXECUTED individually |
| app/dashboard/settings/branches/page.tsx:35 | SubmitButton | {`branch-default-button-${branch.id}`} | (composed) | Make default | NOT EXECUTED individually |
| app/dashboard/settings/branches/page.tsx:36 | form | {`branch-toggle-form-${branch.id}`} | {toggleBranch} |  | NOT EXECUTED individually |
| app/dashboard/settings/branches/page.tsx:36 | SubmitButton | {`branch-toggle-button-${branch.id}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/layout.tsx:16 | Tabs | {salon?"salon-settings-navigation":"settings-sections-navigation"} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/page.tsx:26 | form | "settings-profile-form" | {updateProfile} |  | NOT EXECUTED individually |
| app/dashboard/settings/page.tsx:26 | Input | "settings-profile-name-input" | "fullName" | Full name | NOT EXECUTED individually |
| app/dashboard/settings/page.tsx:26 | Input | "settings-profile-phone-input" | "phone" | Phone | NOT EXECUTED individually |
| app/dashboard/settings/page.tsx:26 | Input | "settings-profile-email-input" | (composed) | Email | NOT EXECUTED individually |
| app/dashboard/settings/page.tsx:26 | SubmitButton | "settings-profile-save-button" | (composed) | Save profile | NOT EXECUTED individually |
| app/dashboard/settings/page.tsx:27 | Button | "settings-manage-branches-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/page.tsx:27 | a | (unscoped) | "/dashboard/settings/branches" | Manage branches | NOT EXECUTED individually |
| app/dashboard/settings/page.tsx:27 | Button | "settings-manage-staff-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/page.tsx:27 | a | (unscoped) | "/dashboard/settings/staff" | Manage staff | NOT EXECUTED individually |
| app/dashboard/settings/public-page/actions.ts:23 | server action | savePublicPage | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/actions.ts:32 | server action | saveBranchPublic | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/actions.ts:43 | server action | togglePublicService | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/actions.ts:52 | server action | addGalleryImage | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:80 | Link | "public-page-settings-retry" | "/dashboard/settings/public-page" | Try again | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:94 | Button | "public-page-view-link" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:94 | Link | (unscoped) | {`/shop/${organization.slug}`} | View public page | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:107 | Link | (unscoped) | "/dashboard/bookings" | Booking Requests | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:115 | ListTabs | "website-settings-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:120 | form | "public-page-profile-form" | {savePublicPage} |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:122 | input | "public-page-enabled-checkbox" | "enabled" | Publish public page | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:132 | textarea | "public-page-description-input" | "description" | Business description | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:146 | SubmitButton | "public-page-save-button" | (composed) | Save public page | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:155 | form | {`public-service-form-${service.id}`} | {togglePublicService} |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:167 | SubmitButton | {`public-service-toggle-button-${service.id}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:178 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:178 | Link | (unscoped) | "/dashboard/settings/branches/new" | Add location | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:189 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:189 | Link | {`website-location-address-${branch.id}`} | {`/dashboard/settings/branches/${branch.id}/edit`} | Edit address | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:189 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:189 | Link | {`website-location-edit-${branch.id}`} | {`/dashboard/settings/public-page?tab=locations&branchId=${branch.id}`} | Map and hours | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:193 | input | {`public-branch-bookings-checkbox-${branch.id}`} | "acceptsBookings" | Accept online requests at this location | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:194 | textarea | {`public-branch-description-input-${branch.id}`} | "description" | Branch description | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:203 | input | {`public-branch-${day}-enabled-${branch.id}`} | {`hours-${day}-enabled`} |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:204 | Input | {`public-branch-${day}-open-${branch.id}`} | {`hours-${day}-open`} | Opens | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:205 | Input | {`public-branch-${day}-close-${branch.id}`} | {`hours-${day}-close`} | Closes | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:209 | SubmitButton | {`public-branch-save-button-${branch.id}`} | (composed) | Save location | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:219 | form | "public-gallery-form" | {addGalleryImage} |  | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:222 | SubmitButton | "public-gallery-add-button" | (composed) | Add image | NOT EXECUTED individually |
| app/dashboard/settings/public-page/page.tsx:269 | Input | {id} | {name} |  | NOT EXECUTED individually |
| app/dashboard/settings/resources/[resourceId]/edit/page.tsx:21 | form | {`${prefix}-edit-form`} | {saveSchedulingResource} |  | NOT EXECUTED individually |
| app/dashboard/settings/resources/[resourceId]/edit/page.tsx:21 | Input | {`${prefix}-edit-name-input`} | "name" | Name | NOT EXECUTED individually |
| app/dashboard/settings/resources/[resourceId]/edit/page.tsx:21 | SearchableSelect | {`${prefix}-edit-branch-select`} | "branchId" | Branch | NOT EXECUTED individually |
| app/dashboard/settings/resources/[resourceId]/edit/page.tsx:21 | select | {`${prefix}-edit-type-select`} | "resourceType" |  | NOT EXECUTED individually |
| app/dashboard/settings/resources/[resourceId]/edit/page.tsx:21 | Input | {`${prefix}-edit-capacity-input`} | "capacity" | Capacity | NOT EXECUTED individually |
| app/dashboard/settings/resources/[resourceId]/edit/page.tsx:21 | SubmitButton | {`${prefix}-edit-save-button`} | (composed) | Save changes | NOT EXECUTED individually |
| app/dashboard/settings/resources/actions.ts:18 | server action | saveSchedulingResource | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/resources/actions.ts:31 | server action | toggleSchedulingResource | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:35 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:35 | Link | {`${prefix}-create-button`} | "/dashboard/settings/resources?create=1" | Add resource | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:37 | ListTabs | "resources-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:45 | form | {`${prefix}-form`} | {saveSchedulingResource} |  | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:45 | Input | {`${prefix}-name-input`} | "name" | Name | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:45 | SearchableSelect | {`${prefix}-branch-select`} | "branchId" | Branch | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:45 | select | {`${prefix}-type-select`} | "resourceType" |  | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:45 | Input | {`${prefix}-capacity-input`} | "capacity" | Capacity | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:45 | SubmitButton | {`${prefix}-save-button`} | (composed) | Save resource | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:52 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:52 | Link | {`${prefix}-${resource.id}-edit-${context}`} | {`/dashboard/settings/resources/${resource.id}/edit`} | Edit | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:52 | form | {`${prefix}-${resource.id}-toggle-form-${context}`} | {toggleSchedulingResource} |  | NOT EXECUTED individually |
| app/dashboard/settings/resources/page.tsx:52 | SubmitButton | {`${prefix}-${resource.id}-toggle-${context}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/staff/actions.ts:37 | server action | saveStaffProfile | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/staff/actions.ts:60 | server action | createStaffProfileInvitation | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/staff/actions.ts:83 | server action | updateStaffProfileAccess | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/staff/actions.ts:105 | server action | revokeInvitation | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/dashboard/settings/staff/page.tsx:98 | Button | {`${prefix}-create-button`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/staff/page.tsx:98 | Link | (unscoped) | "/dashboard/settings/staff?dialog=create" | Add Staff | NOT EXECUTED individually |
| app/dashboard/settings/staff/page.tsx:103 | ListTabs | {`${prefix}-tabs`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/settings/staff/page.tsx:104 | Link | (unscoped) | "/dashboard/settings/staff" | Try again | NOT EXECUTED individually |
| app/dashboard/settings/staff/page.tsx:142 | form | (unscoped) | {revokeInvitation} |  | NOT EXECUTED individually |
| app/dashboard/settings/staff/page.tsx:142 | SubmitButton | {`${prefix}-revoke-invitation-${invitation.id}`} | (composed) | Revoke | NOT EXECUTED individually |
| app/dashboard/vehicles/[vehicleId]/history/page.tsx:33 | Button | "vehicle-history-back-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/[vehicleId]/history/page.tsx:33 | Link | (unscoped) | {`/dashboard/vehicles/${vehicle.id}`} | Vehicle overview | NOT EXECUTED individually |
| app/dashboard/vehicles/[vehicleId]/history/page.tsx:35 | Link | {`vehicle-service-history-card-${record.job_order_id}`} | {`/dashboard/jobs/${record.job_order_id}`} |  | NOT EXECUTED individually |
| app/dashboard/vehicles/[vehicleId]/history/page.tsx:36 | Link | (unscoped) | "/dashboard/reminders" | View all | NOT EXECUTED individually |
| app/dashboard/vehicles/[vehicleId]/history/page.tsx:36 | Link | {`vehicle-maintenance-book-${item.id}`} | {`/dashboard/appointments/new?${booking}`} | Create appointment | NOT EXECUTED individually |
| app/dashboard/vehicles/[vehicleId]/layout.tsx:3 | Tabs | "vehicle-sections-navigation" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/[vehicleId]/page.tsx:4 | Link | (unscoped) | {`/dashboard/customers/${v.customer_id}`} |  | NOT EXECUTED individually |
| app/dashboard/vehicles/[vehicleId]/page.tsx:4 | Button | "vehicle-edit-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/[vehicleId]/page.tsx:4 | Link | (unscoped) | {`/dashboard/vehicles/${v.id}/edit`} | Edit vehicle | NOT EXECUTED individually |
| app/dashboard/vehicles/[vehicleId]/page.tsx:4 | form | "vehicle-archive-form" | {archiveVehicle} |  | NOT EXECUTED individually |
| app/dashboard/vehicles/[vehicleId]/page.tsx:4 | SubmitButton | "vehicle-archive-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/new/page.tsx:14 | form | "vehicle-customer-search-form" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/new/page.tsx:14 | input | "vehicle-customer-search-input" | "customerQ" |  | NOT EXECUTED individually |
| app/dashboard/vehicles/new/page.tsx:14 | Button | "vehicle-customer-search-button" | (composed) | Find | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:29 | Button | "vehicle-create-button" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:29 | Link | (unscoped) | {`${listHref}&create=1`} | Add vehicle | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:31 | ListTabs | "vehicles-tabs" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:32 | form | "vehicles-filter-form" | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:32 | input | "vehicles-search-input" | "q" |  | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:32 | Button | (unscoped) | (composed) | Search | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:33 | Link | (unscoped) | {`/dashboard/customers/${v.customer_id}`} |  | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:33 | Button | {`vehicle-edit-${v.id}`} | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:33 | Link | (unscoped) | {`${listHref}&edit=${v.id}`} | Edit | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:34 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:34 | Link | (unscoped) | "/dashboard/vehicles" | Clear filters | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:35 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:35 | Link | (unscoped) | {`?q=${encodeURIComponent(p.q??"")}&status=${p.status??"active"}&page=${Math.max(1,page-1)}`} | Previous | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:35 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/dashboard/vehicles/page.tsx:35 | Link | (unscoped) | {`?q=${encodeURIComponent(p.q??"")}&status=${p.status??"active"}&page=${Math.min(pages,page+1)}`} | Next | NOT EXECUTED individually |
| app/error.tsx:21 | Button | (unscoped) | {reset} | Try again | NOT EXECUTED individually |
| app/estimate/[token]/actions.ts:12 | server action | decideEstimateAction | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/estimate/[token]/page.tsx:60 | a | (unscoped) | {`tel:${approval.branch.phone}`} |  | NOT EXECUTED individually |
| app/estimate/[token]/page.tsx:60 | a | (unscoped) | {`mailto:${approval.branch.email}`} |  | NOT EXECUTED individually |
| app/estimate/[token]/page.tsx:62 | Button | "public-estimate-approve-button" | (composed) |  | NOT EXECUTED individually |
| app/estimate/[token]/page.tsx:62 | Link | (unscoped) | {`/estimate/${token}?confirm=approve`} | Approve estimate | NOT EXECUTED individually |
| app/estimate/[token]/page.tsx:62 | Button | "public-estimate-decline-button" | (composed) |  | NOT EXECUTED individually |
| app/estimate/[token]/page.tsx:62 | Link | (unscoped) | {`/estimate/${token}?confirm=decline`} | Decline estimate | NOT EXECUTED individually |
| app/estimate/[token]/page.tsx:65 | form | "public-estimate-decision-form" | {decideEstimateAction} |  | NOT EXECUTED individually |
| app/estimate/[token]/page.tsx:65 | textarea | "public-estimate-comment-input" | "comment" | Comment (optional) | NOT EXECUTED individually |
| app/estimate/[token]/page.tsx:65 | SubmitButton | "public-estimate-confirm-decision-button" | (composed) |  | NOT EXECUTED individually |
| app/forgot-password/page.tsx:19 | Link | "negosu-forgot-password-login-link" | {`/login${contextQuery}`} | Back to sign in | NOT EXECUTED individually |
| app/forgot-password/page.tsx:19 | form | "negosu-forgot-password-form" | {requestPasswordReset} |  | NOT EXECUTED individually |
| app/forgot-password/page.tsx:19 | Input | "negosu-forgot-password-email-input" | "email" | Email address | NOT EXECUTED individually |
| app/forgot-password/page.tsx:19 | SubmitButton | "negosu-forgot-password-submit-button" | (composed) | Send reset link | NOT EXECUTED individually |
| app/login/page.tsx:24 | Link | "negosu-login-create-account-link" | {`/signup${contextQuery}`} | Create an account | NOT EXECUTED individually |
| app/login/page.tsx:26 | form | "negosu-login-form" | {signIn} |  | NOT EXECUTED individually |
| app/login/page.tsx:29 | Input | "negosu-login-email-input" | "email" | Email address | NOT EXECUTED individually |
| app/login/page.tsx:30 | Input | "negosu-login-password-input" | "password" | Password | NOT EXECUTED individually |
| app/login/page.tsx:31 | Link | "negosu-login-forgot-password-link" | {`/forgot-password${contextQuery}`} | Forgot password? | NOT EXECUTED individually |
| app/login/page.tsx:32 | SubmitButton | "negosu-login-submit-button" | (composed) | Sign in | NOT EXECUTED individually |
| app/not-found.tsx:14 | Button | "negosu-not-found-dashboard-button" | (composed) |  | NOT EXECUTED individually |
| app/not-found.tsx:14 | Link | (unscoped) | "/dashboard" | Back to dashboard | NOT EXECUTED individually |
| app/onboarding/actions.ts:29 | server action | createOrganization | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/onboarding/actions.ts:66 | server action | createInitialBranch | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:36 | form | "negosu-onboarding-branch-form" | {createInitialBranch} |  | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:38 | Input | "negosu-branch-name-input" | "branchName" | Branch name | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:39 | Input | "negosu-branch-address-input" | "addressLine" | Address line | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:40 | Input | "negosu-branch-barangay-input" | "barangay" | Barangay | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:42 | Input | "negosu-branch-city-input" | "city" | City / municipality | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:43 | Input | "negosu-branch-province-input" | "province" | Province | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:46 | Input | "negosu-branch-postal-input" | "postalCode" | Postal code | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:47 | Input | "negosu-branch-country-input" | "country" | Country | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:50 | Input | "negosu-branch-phone-input" | "phone" | Branch phone | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:51 | Input | "negosu-branch-email-input" | "email" | Branch email | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:53 | textarea | "negosu-branch-notes-input" | "openingNotes" | Opening notes | NOT EXECUTED individually |
| app/onboarding/branch/page.tsx:54 | SubmitButton | "negosu-branch-submit-button" | (composed) | Finish setup | NOT EXECUTED individually |
| app/onboarding/business/page.tsx:30 | form | "negosu-onboarding-business-form" | {createOrganization} |  | NOT EXECUTED individually |
| app/onboarding/business/page.tsx:32 | Input | "negosu-business-legal-name-input" | "legalName" | Registered business name | NOT EXECUTED individually |
| app/onboarding/business/page.tsx:34 | Input | "negosu-business-phone-input" | "phone" | Business phone | NOT EXECUTED individually |
| app/onboarding/business/page.tsx:35 | Input | "negosu-business-email-input" | "email" | Business email | NOT EXECUTED individually |
| app/onboarding/business/page.tsx:37 | Input | "negosu-business-website-input" | "website" | Website | NOT EXECUTED individually |
| app/onboarding/business/page.tsx:38 | Input | "negosu-business-facebook-input" | "facebookPage" | Facebook page | NOT EXECUTED individually |
| app/onboarding/business/page.tsx:40 | SubmitButton | "negosu-business-submit-button" | (composed) | Continue to branch setup | NOT EXECUTED individually |
| app/onboarding/setup/page.tsx:43 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/onboarding/setup/page.tsx:43 | Link | "negosu-onboarding-next-step-link" | {nextStep.href} | Set up now | NOT EXECUTED individually |
| app/onboarding/setup/page.tsx:51 | Link | {`negosu-onboarding-step-${step.key}-link`} | {step.href} | Continue | NOT EXECUTED individually |
| app/onboarding/setup/page.tsx:58 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/onboarding/setup/page.tsx:58 | Link | "negosu-onboarding-open-dashboard" | "/dashboard" |  | NOT EXECUTED individually |
| app/organizations/actions.ts:9 | server action | chooseOrganization | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/organizations/page.tsx:44 | form | {`negosu-business-option-${choice.organization_id}`} | {chooseOrganization} |  | NOT EXECUTED individually |
| app/organizations/page.tsx:49 | SubmitButton | {`negosu-business-option-${choice.organization_id}-select-button`} | (composed) | Open | NOT EXECUTED individually |
| app/page.tsx:44 | Link | "negosu-start-free-button" | "/signup" | Start Free | NOT EXECUTED individually |
| app/page.tsx:45 | a | "negosu-explore-solutions-button" | "#solutions" | Explore Solutions | NOT EXECUTED individually |
| app/page.tsx:60 | Link | "negosu-hero-hospitality-link" | {hospitalityBrand.path} | Explore Apartelle & Inn | NOT EXECUTED individually |
| app/page.tsx:78 | Link | "negosu-explore-automotive-link" | {verticalBrands.automotive.path} | Explore Automotive | NOT EXECUTED individually |
| app/page.tsx:84 | Link | "negosu-explore-salon-link" | {verticalBrands.salon.path} | Explore Salon &amp; Beauty | NOT EXECUTED individually |
| app/page.tsx:86 | Link | "negosu-explore-pet-care-link" | {petCareBrand.path} | Explore Pet Care | NOT EXECUTED individually |
| app/page.tsx:87 | Link | "negosu-explore-hospitality-link" | {hospitalityBrand.path} | Explore Apartelle &amp; Inn | NOT EXECUTED individually |
| app/page.tsx:103 | Link | (unscoped) | {verticalBrands.automotive.path} | See Automotive | NOT EXECUTED individually |
| app/page.tsx:104 | Link | (unscoped) | {verticalBrands.salon.path} | See Salon &amp; Beauty | NOT EXECUTED individually |
| app/page.tsx:105 | Link | "negosu-pet-care-overview-link" | {petCareBrand.path} | See Pet Care | NOT EXECUTED individually |
| app/page.tsx:106 | Link | "negosu-hospitality-overview-link" | {hospitalityBrand.path} | See Apartelle &amp; Inn | NOT EXECUTED individually |
| app/pet-care/page.tsx:34 | Link | "negosu-pet-care-create-account-button" | {petCareBrand.signupPath} | Create free account | NOT EXECUTED individually |
| app/pet-care/page.tsx:34 | Link | "negosu-pet-care-sign-in-link" | {petCareBrand.loginPath} | Sign in | NOT EXECUTED individually |
| app/reset-password/page.tsx:18 | Link | "negosu-reset-password-request-link" | {`/forgot-password${contextQuery}`} | Request a new reset link | NOT EXECUTED individually |
| app/reset-password/page.tsx:24 | form | "negosu-reset-password-form" | {updatePassword} |  | NOT EXECUTED individually |
| app/reset-password/page.tsx:27 | SubmitButton | "negosu-reset-password-submit-button" | (composed) | Update password | NOT EXECUTED individually |
| app/shop/[slug]/actions.ts:11 | server action | submitBooking | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:43 | form | "public-booking-request-form" | {action} |  | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:59 | input | {`public-booking-time-${index}`} | "preferredAt" |  | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:69 | Input | "public-booking-name-input" | "customerName" | Full name | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:70 | Input | "public-booking-phone-input" | "phone" | Mobile number | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:71 | Input | "public-booking-email-input" | "email" | Email | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:76 | Input | "public-booking-pet-name" | "petName" | Pet name | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:77 | select | "public-booking-pet-species" | "species" |  | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:78 | Input | "public-booking-pet-breed" | "breed" | Breed (optional) | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:84 | Input | "public-booking-vehicle-make-input" | "vehicleMake" | Vehicle make | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:85 | Input | "public-booking-vehicle-model-input" | "vehicleModel" | Vehicle model | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:86 | Input | "public-booking-vehicle-year-input" | "vehicleYear" | Model year | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:87 | Input | "public-booking-vehicle-type-input" | "vehicleType" | Vehicle type | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:88 | Input | "public-booking-plate-input" | "plateNumber" | Plate number | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:93 | textarea | "public-booking-notes-input" | "customerNote" | Anything the business should know? | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:96 | input | (unscoped) | "website" | Website | NOT EXECUTED individually |
| app/shop/[slug]/book/booking-form.tsx:97 | Button | "public-booking-submit-button" | (composed) |  | NOT EXECUTED individually |
| app/shop/[slug]/book/page.tsx:157 | Link | "public-booking-back-link" | {`/shop/${encodeURIComponent(slug)}`} |  | NOT EXECUTED individually |
| app/shop/[slug]/book/page.tsx:174 | form | "public-booking-availability-form" | (composed) |  | NOT EXECUTED individually |
| app/shop/[slug]/book/page.tsx:175 | select | "public-booking-branch-select" | "branch" |  | NOT EXECUTED individually |
| app/shop/[slug]/book/page.tsx:176 | input | {`public-booking-service-${item.id}`} | "services" |  | NOT EXECUTED individually |
| app/shop/[slug]/book/page.tsx:181 | Button | "public-booking-show-availability-button" | (composed) | Update availability | NOT EXECUTED individually |
| app/shop/[slug]/book/page.tsx:189 | Button | "public-booking-previous-month" | (composed) |  | NOT EXECUTED individually |
| app/shop/[slug]/book/page.tsx:189 | Link | (unscoped) | {bookingHref(slug, branch.id, selectedServiceIds, { month: calendar.previousMonth })} |  | NOT EXECUTED individually |
| app/shop/[slug]/book/page.tsx:191 | Button | "public-booking-next-month" | (composed) |  | NOT EXECUTED individually |
| app/shop/[slug]/book/page.tsx:191 | Link | (unscoped) | {bookingHref(slug, branch.id, selectedServiceIds, { month: calendar.nextMonth })} |  | NOT EXECUTED individually |
| app/shop/[slug]/book/page.tsx:200 | Link | {`public-booking-date-${day.date}`} | {`${bookingHref(slug, branch.id, selectedServiceIds, { month: calendar.month, date: day.date })}#public-booking-details-section`} |  | NOT EXECUTED individually |
| app/shop/[slug]/chat-actions.ts:9 | server action | customerChat | authenticated/domain validation required |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:57 | a | "public-shop-skip-link" | "#public-automotive-shop-services" | Skip to services | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:60 | Link | "public-shop-home-link" | {`/shop/${encodeURIComponent(slug)}`} |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:63 | Button | "public-shop-header-book-button" | (composed) |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:63 | Link | (unscoped) | {bookingAvailable?bookingHref:"#public-automotive-shop-branches"} |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:65 | a | (unscoped) | "#public-automotive-shop-services" |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:65 | a | (unscoped) | "#public-automotive-shop-branches" | Locations | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:65 | a | (unscoped) | "#public-automotive-shop-gallery" | Gallery | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:65 | a | (unscoped) | "#public-shop-contact" | Contact | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:74 | Button | "public-automotive-shop-book-button" | (composed) |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:74 | Link | (unscoped) | {bookingAvailable?bookingHref:"#public-automotive-shop-branches"} |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:75 | a | "public-shop-quick-location" | "#public-automotive-shop-branches" |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:75 | a | (unscoped) | {`tel:${publicShop.phone.replace(/[^\d+]/g, "")}`} |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:85 | Button | "public-shop-services-book-button" | (composed) |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:85 | Link | (unscoped) | {bookingHref} | Check availability | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:86 | Link | {`public-shop-service-book-${service.id}`} | {`${bookingHref}?service=${encodeURIComponent(service.id)}`} | Book this | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:99 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:99 | a | {`public-location-call-${branch.id}`} | {`tel:${branch.phone.replace(/[^\d+]/g,"")}`} | Call location | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:99 | Button | {`public-shop-branch-book-${branch.id}`} | (composed) |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:99 | Link | (unscoped) | {`${bookingHref}?branch=${encodeURIComponent(branch.id)}`} | Book at this location | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:109 | a | "public-shop-call-link" | {`tel:${publicShop.phone.replace(/[^\d+]/g,"")}`} |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:109 | a | "public-shop-email-link" | {`mailto:${publicShop.email}`} |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:109 | a | (unscoped) | {publicShop.website} | Website | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:109 | a | (unscoped) | {publicShop.facebook} | Facebook | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:109 | a | (unscoped) | {publicShop.instagram} | Instagram | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:112 | a | "public-mobile-services-button" | "#public-automotive-shop-services" |  | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:113 | a | "public-mobile-location-button" | "#public-automotive-shop-branches" | Locations | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:114 | a | "public-mobile-gallery-button" | "#public-automotive-shop-gallery" | Gallery | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:115 | a | "public-mobile-contact-button" | "#public-shop-contact" | Contact | NOT EXECUTED individually |
| app/shop/[slug]/page.tsx:116 | Link | "public-mobile-book-button" | {bookingHref} | Book now | NOT EXECUTED individually |
| app/signup/page.tsx:25 | Link | "negosu-signup-login-link" | {`/login${contextQuery}`} | Sign in | NOT EXECUTED individually |
| app/signup/page.tsx:27 | form | "negosu-signup-form" | {signUp} |  | NOT EXECUTED individually |
| app/signup/page.tsx:30 | Input | "negosu-signup-first-name-input" | "firstName" | First name | NOT EXECUTED individually |
| app/signup/page.tsx:31 | Input | "negosu-signup-last-name-input" | "lastName" | Last name | NOT EXECUTED individually |
| app/signup/page.tsx:33 | Input | "negosu-signup-email-input" | "email" | Email address | NOT EXECUTED individually |
| app/signup/page.tsx:35 | SubmitButton | "negosu-signup-submit-button" | (composed) | Create account | NOT EXECUTED individually |
| app/verify-email/page.tsx:9 | Link | "negosu-verify-email-login-link" | {`/login${contextQuery}`} | Back to sign in | NOT EXECUTED individually |
| components/active-approval-link-copy.tsx:20 | form | "job-order-approval-copy-link-form" | {action} |  | NOT EXECUTED individually |
| components/active-approval-link-copy.tsx:22 | SubmitButton | "job-order-approval-copy-link-button" | (composed) | Copy active link | NOT EXECUTED individually |
| components/active-approval-link-copy.tsx:26 | input | "job-order-approval-copy-link-output" | (composed) |  | NOT EXECUTED individually |
| components/active-approval-link-copy.tsx:27 | button | "job-order-approval-copy-link-confirm-button" | {copy} | Copy link | NOT EXECUTED individually |
| components/admin-notification-bell.tsx:62 | button | "dashboard-notification-bell" | {() => setOpen(true)} |  | NOT EXECUTED individually |
| components/admin-notification-bell.tsx:65 | Button | "dashboard-notification-close" | {close} |  | NOT EXECUTED individually |
| components/admin-notification-bell.tsx:70 | Link | {`dashboard-notification-${item.id}`} | {item.href} |  | NOT EXECUTED individually |
| components/admin-notification-bell.tsx:73 | Button | "dashboard-notification-refresh" | {() => refresh.current?.()} |  | NOT EXECUTED individually |
| components/app-shell.tsx:118 | Link | {`desktop-nav-${item.key.replaceAll("_", "-")}`} | {item.href} |  | NOT EXECUTED individually |
| components/app-shell.tsx:155 | Link | {`mobile-more-nav-${item.key.replaceAll("_", "-")}`} | {item.href} |  | NOT EXECUTED individually |
| components/app-shell.tsx:190 | Link | "negosu-dashboard-home-link" | "/dashboard" |  | NOT EXECUTED individually |
| components/app-shell.tsx:197 | Link | "negosu-sidebar-dashboard" | {dashboardNavigation.href} |  | NOT EXECUTED individually |
| components/app-shell.tsx:212 | Link | "negosu-dashboard-mobile-home-link" | "/dashboard" |  | NOT EXECUTED individually |
| components/app-shell.tsx:214 | form | "dashboard-branch-switcher" | {switchBranch} |  | NOT EXECUTED individually |
| components/app-shell.tsx:214 | select | "branchId" | "branchId" |  | NOT EXECUTED individually |
| components/app-shell.tsx:214 | SubmitButton | (unscoped) | (composed) | Switch | NOT EXECUTED individually |
| components/app-shell.tsx:215 | form | "negosu-business-switcher" | {switchOrganization} |  | NOT EXECUTED individually |
| components/app-shell.tsx:215 | select | "negosu-business-switcher-select" | "organizationId" |  | NOT EXECUTED individually |
| components/app-shell.tsx:215 | SubmitButton | "negosu-business-switcher-submit-button" | (composed) | Switch | NOT EXECUTED individually |
| components/app-shell.tsx:221 | form | "dashboard-mobile-branch-switcher" | {switchBranch} |  | NOT EXECUTED individually |
| components/app-shell.tsx:221 | select | "dashboard-mobile-branch-select" | "branchId" |  | NOT EXECUTED individually |
| components/app-shell.tsx:221 | SubmitButton | "dashboard-mobile-branch-submit-button" | (composed) | Switch branch | NOT EXECUTED individually |
| components/app-shell.tsx:222 | form | "negosu-mobile-business-switcher" | {switchOrganization} |  | NOT EXECUTED individually |
| components/app-shell.tsx:222 | select | "negosu-mobile-business-switcher-select" | "organizationId" |  | NOT EXECUTED individually |
| components/app-shell.tsx:222 | SubmitButton | "negosu-mobile-business-switcher-submit-button" | (composed) | Switch business | NOT EXECUTED individually |
| components/app-shell.tsx:223 | Link | "negosu-user-menu-continue-setup-link" | "/onboarding/setup" | Continue setup | NOT EXECUTED individually |
| components/app-shell.tsx:224 | Link | "user-menu-profile-settings-link" | "/dashboard/settings" | Profile settings | NOT EXECUTED individually |
| components/app-shell.tsx:225 | form | "user-menu-sign-out-form" | {signOut} |  | NOT EXECUTED individually |
| components/app-shell.tsx:225 | SubmitButton | "user-menu-sign-out-button" | (composed) | Sign out | NOT EXECUTED individually |
| components/app-shell.tsx:236 | Link | {`mobile-nav-${item.label.toLowerCase().replaceAll(" ", "-")}`} | {item.href} |  | NOT EXECUTED individually |
| components/auth-shell.tsx:13 | Link | {`${id}-home-link`} | {homeHref} |  | NOT EXECUTED individually |
| components/billing-overview.tsx:29 | Button | "billing-retry-button" | (composed) |  | NOT EXECUTED individually |
| components/billing-overview.tsx:29 | a | (unscoped) | "/dashboard/settings/billing" | Try again | NOT EXECUTED individually |
| components/billing-overview.tsx:33 | form | "billing-portal-form" | {openBillingPortal} |  | NOT EXECUTED individually |
| components/billing-overview.tsx:33 | SubmitButton | "billing-manage-subscription-button" | (composed) | Manage subscription | NOT EXECUTED individually |
| components/billing-overview.tsx:42 | Button | "billing-payment-history" | (composed) |  | NOT EXECUTED individually |
| components/billing-overview.tsx:42 | Link | (unscoped) | "/dashboard/settings/billing/history" | Payment history | NOT EXECUTED individually |
| components/billing-overview.tsx:45 | a | (unscoped) | "/dashboard/settings/billing" | Try again | NOT EXECUTED individually |
| components/billing-overview.tsx:57 | Button | {`billing-choose-plan-${plan.id}`} | (composed) |  | NOT EXECUTED individually |
| components/billing-overview.tsx:57 | Link | (unscoped) | {`/dashboard/settings/billing/upgrade?planId=${plan.id}&interval=month`} |  | NOT EXECUTED individually |
| components/billing-overview.tsx:57 | Button | {`billing-contact-sales-${plan.id}`} | (composed) |  | NOT EXECUTED individually |
| components/billing-overview.tsx:57 | a | (unscoped) | "mailto:sales@negosu.com" | Contact sales | NOT EXECUTED individually |
| components/billing-overview.tsx:57 | form | {`billing-checkout-form-${plan.id}`} | {startCheckout} |  | NOT EXECUTED individually |
| components/billing-overview.tsx:57 | select | {`billing-interval-${plan.id}`} | "interval" |  | NOT EXECUTED individually |
| components/billing-overview.tsx:57 | SubmitButton | {`billing-choose-plan-${plan.id}`} | (composed) | Choose | NOT EXECUTED individually |
| components/billing-payment-refresh.tsx:31 | Button | "billing-payment-refresh" | {check} |  | NOT EXECUTED individually |
| components/business-branding-form.tsx:15 | form | "settings-business-branding-form" | {updateBusinessBranding} |  | NOT EXECUTED individually |
| components/business-branding-form.tsx:18 | Input | "settings-business-logo-url-input" | "logoUrl" | Business logo URL | NOT EXECUTED individually |
| components/business-branding-form.tsx:21 | SubmitButton | "settings-business-branding-save-button" | (composed) | Save business logo | NOT EXECUTED individually |
| components/business-identity-fields.tsx:19 | Input | "negosu-business-name-input" | "businessName" | Business name | NOT EXECUTED individually |
| components/business-identity-fields.tsx:27 | input | "negosu-business-slug-input" | "slug" |  | NOT EXECUTED individually |
| components/business-type-selector.tsx:47 | input | {`${idPrefix}-business-type-${value}`} | "industry" |  | NOT EXECUTED individually |
| components/business-type-selector.tsx:66 | select | {`${idPrefix}-business-subtype`} | "businessType" |  | NOT EXECUTED individually |
| components/catalog-fields.tsx:27 | SearchableSelect | {id} | {name} |  | NOT EXECUTED individually |
| components/catalog-fields.tsx:28 | Input | {`${id}-new-name`} | (composed) | Category name | NOT EXECUTED individually |
| components/catalog-fields.tsx:28 | Button | {`${id}-new-save`} | {() => void save()} |  | NOT EXECUTED individually |
| components/catalog-fields.tsx:49 | SearchableSelect | {`${id}-service-select`} | (composed) |  | NOT EXECUTED individually |
| components/catalog-fields.tsx:50 | button | {`${id}-service-${serviceId}-remove`} | {() => setSelected(current => current.filter(value => value !== serviceId))} |  | NOT EXECUTED individually |
| components/catalog-fields.tsx:52 | Input | {`${id}-new-service-name`} | (composed) | Name | NOT EXECUTED individually |
| components/catalog-fields.tsx:54 | Input | {`${id}-new-service-price`} | (composed) | Price (PHP) | NOT EXECUTED individually |
| components/catalog-fields.tsx:55 | Input | {`${id}-new-service-duration`} | (composed) | Duration (minutes) | NOT EXECUTED individually |
| components/catalog-fields.tsx:57 | Button | {`${id}-new-service-save`} | {() => void save()} |  | NOT EXECUTED individually |
| components/command-center/command-center.tsx:48 | form | "negosu-command-center-branch-selector-form" | "/dashboard/branch-context" |  | NOT EXECUTED individually |
| components/command-center/command-center.tsx:50 | select | "negosu-command-center-branch-selector" | "branch" |  | NOT EXECUTED individually |
| components/command-center/command-center.tsx:55 | Button | "negosu-command-center-branch-apply" | (composed) | Apply | NOT EXECUTED individually |
| components/command-center/command-center.tsx:64 | Link | {id} | {metric.href} |  | NOT EXECUTED individually |
| components/command-center/command-center.tsx:73 | Link | {`negosu-action-item-${action.id}`} | {action.href} |  | NOT EXECUTED individually |
| components/command-center/command-center.tsx:82 | Link | {`negosu-operation-${operation.id}`} | {operation.href} |  | NOT EXECUTED individually |
| components/command-center/command-center.tsx:90 | Link | {`negosu-command-center-quick-action-${action.id}`} | {action.href} |  | NOT EXECUTED individually |
| components/command-center/command-center.tsx:95 | Link | {`negosu-staff-item-${staff.id}`} | {staff.href} |  | NOT EXECUTED individually |
| components/crm-forms.tsx:20 | form | {branch?"branch-edit-form":"branch-create-form"} | {saveBranch} |  | NOT EXECUTED individually |
| components/crm-forms.tsx:22 | Input | "branch-name-input" | "name" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:23 | Input | "branch-country-input" | "country" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:24 | Input | "branch-address-input" | "addressLine" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:25 | Input | "branch-barangay-input" | "barangay" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:26 | Input | "branch-city-input" | "city" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:27 | Input | "branch-province-input" | "province" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:28 | Input | "branch-postal-input" | "postalCode" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:29 | Input | "branch-phone-input" | "phone" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:30 | Input | "branch-email-input" | "email" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:31 | textarea | "branch-opening-notes-input" | "openingNotes" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:32 | SubmitButton | "branch-save-button" | (composed) | Save branch | NOT EXECUTED individually |
| components/crm-forms.tsx:38 | Link | "customer-duplicate-link" | {`/dashboard/customers/${duplicateId}`} | View existing | NOT EXECUTED individually |
| components/crm-forms.tsx:38 | input | "customer-accept-duplicate-checkbox" | "acceptDuplicate" | Save anyway | NOT EXECUTED individually |
| components/crm-forms.tsx:38 | form | "customer-form" | {saveCustomer} |  | NOT EXECUTED individually |
| components/crm-forms.tsx:40 | Input | "customer-full-name-input" | "fullName" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:41 | Input | "customer-phone-input" | "phone" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:42 | Input | "customer-email-input" | "email" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:43 | Input | "customer-address-input" | "addressLine" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:44 | Input | "customer-city-input" | "city" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:45 | Input | "customer-province-input" | "province" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:46 | textarea | "customer-notes-input" | "notes" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:47 | SubmitButton | "customer-save-button" | (composed) | Save | NOT EXECUTED individually |
| components/crm-forms.tsx:54 | Link | "vehicle-duplicate-link" | {`/dashboard/vehicles/${duplicateId}`} | View existing vehicle | NOT EXECUTED individually |
| components/crm-forms.tsx:54 | input | "vehicle-accept-duplicate-checkbox" | "acceptDuplicate" | Save anyway | NOT EXECUTED individually |
| components/crm-forms.tsx:54 | form | "vehicle-form" | {saveVehicle} |  | NOT EXECUTED individually |
| components/crm-forms.tsx:57 | Input | "vehicle-make-input" | "make" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:58 | Input | "vehicle-model-input" | "model" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:59 | Input | "vehicle-year-input" | "modelYear" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:60 | Input | "vehicle-variant-input" | "variant" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:61 | Input | "vehicle-plate-number-input" | "plateNumber" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:62 | select | "vehicle-type-select" | "vehicleType" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:63 | Input | "vehicle-color-input" | "color" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:64 | Input | "vehicle-odometer-input" | "odometerKm" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:65 | Input | "vehicle-fuel-type-input" | "fuelType" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:66 | Input | "vehicle-transmission-input" | "transmission" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:67 | Input | "vehicle-vin-input" | "vin" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:68 | Input | "vehicle-engine-number-input" | "engineNumber" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:69 | textarea | "vehicle-notes-input" | "notes" |  | NOT EXECUTED individually |
| components/crm-forms.tsx:70 | SubmitButton | "vehicle-save-button" | (composed) | Save vehicle | NOT EXECUTED individually |
| components/customer-queue-display.tsx:132 | a | "queue-display-reservation-link" | {`/booking/${encodeURIComponent(reservationToken)}`} | Your reservation | NOT EXECUTED individually |
| components/customer-queue-display.tsx:133 | button | "queue-display-refresh" | {() => refresh.current?.()} |  | NOT EXECUTED individually |
| components/customer-queue-display.tsx:134 | button | "queue-display-fullscreen" | {() => { void toggleFullscreen(); }} |  | NOT EXECUTED individually |
| components/dashboard-back-link.tsx:12 | Button | "dashboard-page-back-button" | (composed) |  | NOT EXECUTED individually |
| components/dashboard-back-link.tsx:12 | Link | (unscoped) | {destination.href} |  | NOT EXECUTED individually |
| components/estimate-approval-link-controls.tsx:33 | input | "estimate-approval-link-output" | (composed) |  | NOT EXECUTED individually |
| components/estimate-approval-link-controls.tsx:34 | button | "estimate-approval-link-copy-button" | {copyLink} | Copy link | NOT EXECUTED individually |
| components/estimate-approval-link-controls.tsx:41 | form | "estimate-approval-link-generate-form" | {action} |  | NOT EXECUTED individually |
| components/estimate-approval-link-controls.tsx:45 | SubmitButton | "estimate-approval-link-generate-button" | (composed) |  | NOT EXECUTED individually |
| components/form-actions.tsx:28 | Button | {cancelId ?? `${id}-cancel-button`} | {onCancel} |  | NOT EXECUTED individually |
| components/form-actions.tsx:29 | Button | {cancelId ?? `${id}-cancel-button`} | (composed) |  | NOT EXECUTED individually |
| components/form-actions.tsx:29 | Link | (unscoped) | {href} |  | NOT EXECUTED individually |
| components/form-actions.tsx:30 | Button | {cancelId ?? `${id}-cancel-button`} | (composed) |  | NOT EXECUTED individually |
| components/hospitality/action-form.tsx:6 | form | {id} | {formAction} |  | NOT EXECUTED individually |
| components/hospitality/check-out-form.tsx:25 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/hospitality/check-out-form.tsx:25 | Link | "hospitality-check-out-payment-link" | {`${closeHref}?tab=charges&dialog=payment`} | Record payment | NOT EXECUTED individually |
| components/hospitality/check-out-form.tsx:27 | input | "hospitality-check-out-debt" | "acknowledgeDebt" | Check out with this balance unpaid. It will remain due. | NOT EXECUTED individually |
| components/hospitality/check-out-form.tsx:31 | select | "hospitality-deposit-refund-method" | "refundMethod" |  | NOT EXECUTED individually |
| components/hospitality/check-out-form.tsx:31 | input | "hospitality-deposit-refund-reference" | "refundReference" |  | NOT EXECUTED individually |
| components/hospitality/check-out-form.tsx:31 | input | "hospitality-deposit-refund-confirm" | "confirmRefund" | I have returned the full deposit to the guest. | NOT EXECUTED individually |
| components/hospitality/extension-form.tsx:16 | select | "hospitality-extension-rate" | "rateId" |  | NOT EXECUTED individually |
| components/hospitality/extension-form.tsx:17 | input | "hospitality-extension-hours" | "hours" |  | NOT EXECUTED individually |
| components/hospitality/guests.tsx:27 | Button | "hospitality-add-guest" | (composed) |  | NOT EXECUTED individually |
| components/hospitality/guests.tsx:27 | Link | (unscoped) | {`${base}?create=1`} | Add guest | NOT EXECUTED individually |
| components/hospitality/guests.tsx:28 | form | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/hospitality/guests.tsx:28 | input | "hospitality-guest-search" | "q" |  | NOT EXECUTED individually |
| components/hospitality/guests.tsx:28 | Button | "hospitality-guest-search-button" | (composed) |  | NOT EXECUTED individually |
| components/hospitality/guests.tsx:32 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/hospitality/guests.tsx:32 | Link | (unscoped) | {`${base}?edit=${g.id}`} | Edit | NOT EXECUTED individually |
| components/hospitality/guests.tsx:52 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/hospitality/guests.tsx:52 | Link | (unscoped) | {`/dashboard/customers?edit=${guestId}`} | Edit guest | NOT EXECUTED individually |
| components/hospitality/guests.tsx:52 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/hospitality/guests.tsx:52 | Link | (unscoped) | {`/dashboard/hospitality/rooms?guest=${guestId}`} | Choose room | NOT EXECUTED individually |
| components/hospitality/overview.tsx:41 | Link | (unscoped) | {href} | . | NOT EXECUTED individually |
| components/hospitality/paid-check-in-form.tsx:19 | select | "hospitality-check-in-rate" | "rateId" |  | NOT EXECUTED individually |
| components/hospitality/paid-check-in-form.tsx:24 | input | "hospitality-check-in-occupants" | "occupants" |  | NOT EXECUTED individually |
| components/hospitality/paid-check-in-form.tsx:25 | input | "hospitality-check-in-guest-name" | "guestName" |  | NOT EXECUTED individually |
| components/hospitality/paid-check-in-form.tsx:25 | textarea | "hospitality-check-in-notes" | "notes" |  | NOT EXECUTED individually |
| components/hospitality/print-button.tsx:4 | Button | "hospitality-print-statement" | {() => window.print()} | Print statement | NOT EXECUTED individually |
| components/hospitality/report.tsx:48 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/hospitality/report.tsx:48 | Link | "hospitality-report-export" | {`/dashboard/reports/export?${qs}`} | Export CSV | NOT EXECUTED individually |
| components/hospitality/report.tsx:48 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/hospitality/report.tsx:48 | Link | (unscoped) | "/dashboard/hospitality/rooms" | Rooms | NOT EXECUTED individually |
| components/hospitality/report.tsx:50 | form | "hospitality-report-filters" | (composed) |  | NOT EXECUTED individually |
| components/hospitality/report.tsx:50 | select | "hospitality-report-period" | "preset" |  | NOT EXECUTED individually |
| components/hospitality/report.tsx:50 | input | "hospitality-report-start" | "start" |  | NOT EXECUTED individually |
| components/hospitality/report.tsx:50 | input | "hospitality-report-end" | "end" |  | NOT EXECUTED individually |
| components/hospitality/report.tsx:50 | select | "hospitality-report-branch" | "branch" |  | NOT EXECUTED individually |
| components/hospitality/report.tsx:50 | Button | "hospitality-report-apply" | (composed) | Apply | NOT EXECUTED individually |
| components/hospitality/report.tsx:53 | ListTabs | "hospitality-report-tabs" | (composed) |  | NOT EXECUTED individually |
| components/hospitality/room-rates-editor.tsx:21 | input | {`hospitality-rate-${row.durationMinutes}-enabled`} | (composed) |  | NOT EXECUTED individually |
| components/hospitality/room-rates-editor.tsx:22 | input | {`hospitality-rate-${row.durationMinutes}-price`} | (composed) | Package price | NOT EXECUTED individually |
| components/hospitality/room-rates-editor.tsx:23 | input | {`hospitality-rate-${row.durationMinutes}-extension`} | (composed) | Per extra hour | NOT EXECUTED individually |
| components/hospitality/settlement-fields.tsx:20 | input | {`${prefix}-final-price`} | "finalPrice" |  | NOT EXECUTED individually |
| components/hospitality/settlement-fields.tsx:21 | select | {`${prefix}-discount-type`} | "discountType" |  | NOT EXECUTED individually |
| components/hospitality/settlement-fields.tsx:22 | input | {`${prefix}-discount-card`} | "discountCard" |  | NOT EXECUTED individually |
| components/hospitality/settlement-fields.tsx:23 | input | {`${prefix}-deposit`} | "deposit" |  | NOT EXECUTED individually |
| components/hospitality/settlement-fields.tsx:24 | select | {`${prefix}-method`} | "method" |  | NOT EXECUTED individually |
| components/hospitality/settlement-fields.tsx:25 | input | {`${prefix}-tendered`} | "tendered" |  | NOT EXECUTED individually |
| components/hospitality/settlement-fields.tsx:25 | input | {`${prefix}-reference`} | "reference" |  | NOT EXECUTED individually |
| components/hospitality/settlement-fields.tsx:33 | input | {`${prefix}-receipt-number`} | "receiptNumber" |  | NOT EXECUTED individually |
| components/hospitality/settlement-fields.tsx:36 | SubmitButton | {`${prefix}-submit`} | (composed) |  | NOT EXECUTED individually |
| components/hospitality/shared.tsx:9 | SubmitButton | {`${id}-submit`} | (composed) |  | NOT EXECUTED individually |
| components/hospitality/shared.tsx:12 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/hospitality/shared.tsx:12 | Link | (unscoped) | {href(page - 1)} | Previous | NOT EXECUTED individually |
| components/hospitality/shared.tsx:12 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/hospitality/shared.tsx:12 | Link | (unscoped) | {href(page + 1)} | Next | NOT EXECUTED individually |
| components/hospitality/shift-staff-fields.tsx:39 | SearchableSelect | {`${prefix}-cashier`} | "cashierStaffId" |  | NOT EXECUTED individually |
| components/hospitality/shift-staff-fields.tsx:39 | SearchableSelect | {`${prefix}-housekeeper`} | "housekeeperStaffId" |  | NOT EXECUTED individually |
| components/hospitality/shift-staff-fields.tsx:40 | Link | {`${prefix}-manage-staff`} | "/dashboard/settings/staff" | Staff directory | NOT EXECUTED individually |
| components/inventory-forms.tsx:32 | form | {id} | {action} |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:37 | Input | {`${productPrefix}-name-input`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:38 | Input | {`${productPrefix}-sku-input`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:40 | Input | {`${productPrefix}-unit-input`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:41 | Input | {`${productPrefix}-cost-input`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:42 | Input | {`${productPrefix}-price-input`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:43 | Input | {`${productPrefix}-reorder-input`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:46 | Input | {`${productPrefix}-lot-input`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:47 | Input | {`${productPrefix}-expiry-input`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:48 | Input | {`${productPrefix}-description-input`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:54 | select | {`${productPrefix}-movement-type`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:56 | Input | {`${productPrefix}-movement-quantity`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:57 | Input | {`${productPrefix}-movement-note`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:59 | SearchableSelect | {`${inventoryPrefix}-transfer-source`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:60 | SearchableSelect | {`${inventoryPrefix}-transfer-target`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:62 | Input | {`${inventoryPrefix}-transfer-quantity`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:63 | Input | {`${inventoryPrefix}-transfer-note`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:65 | SearchableSelect | "inventory-recipe-service-select" | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:66 | SearchableSelect | "inventory-recipe-item-select" | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:67 | Input | "inventory-recipe-quantity-input" | (composed) |  | NOT EXECUTED individually |
| components/inventory-forms.tsx:71 | SubmitButton | {mode === "create" ? `${productPrefix}-save-button` : mode === "transfer" ? `${inventoryPrefix}-transfer-button` : mode === "recipe" ? "inventory-recipe-save-button" : `${productPrefix}-movement-save`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:39 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:39 | Link | {`${productPrefix}-record-${suffix}-${item.id}`} | {href({ dialog: "movement", itemId: item.id })} |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:42 | Button | {`${prefix}-transfer-open-button`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:42 | Link | (unscoped) | {href({ dialog: "transfer" })} | Transfer stock | NOT EXECUTED individually |
| components/inventory-workspace.tsx:43 | Button | {`${productPrefix}-add-button`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:43 | Link | (unscoped) | {href({ dialog: "create" })} | Add product | NOT EXECUTED individually |
| components/inventory-workspace.tsx:48 | Link | {`${prefix}-${metric.id}`} | {inventoryHref({ status: metric.status })} |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:52 | Tabs | {`${prefix}-tabs`} | (composed) |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:56 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:56 | Link | "inventory-recipe-open-button" | {href({ dialog: "recipe" })} | Service recipes | NOT EXECUTED individually |
| components/inventory-workspace.tsx:65 | form | {`${prefix}-filters`} | "/dashboard/inventory" |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:66 | Input | {`${prefix}-search-input`} | "q" | Search products | NOT EXECUTED individually |
| components/inventory-workspace.tsx:67 | select | {`${prefix}-category-filter`} | "category" |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:68 | select | {`${prefix}-status-filter`} | "status" |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:69 | Button | {`${prefix}-filter-button`} | (composed) | Search | NOT EXECUTED individually |
| components/inventory-workspace.tsx:69 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:69 | Link | {`${prefix}-clear-filters`} | {inventoryHref()} | Clear | NOT EXECUTED individually |
| components/inventory-workspace.tsx:73 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:73 | Link | (unscoped) | {inventoryHref()} | Clear filters | NOT EXECUTED individually |
| components/inventory-workspace.tsx:77 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:77 | Link | (unscoped) | {href({ page: String(page - 1) })} | Previous | NOT EXECUTED individually |
| components/inventory-workspace.tsx:77 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:77 | Link | (unscoped) | {href({ page: String(page + 1) })} | Next | NOT EXECUTED individually |
| components/inventory-workspace.tsx:80 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/inventory-workspace.tsx:80 | Link | (unscoped) | {closeHref} | Try again | NOT EXECUTED individually |
| components/job-order-work-tracking.tsx:46 | form | {`job-order-end-work-form-${session.id}`} | {endTechnicianWork} |  | NOT EXECUTED individually |
| components/job-order-work-tracking.tsx:46 | select | {`job-order-end-work-action-${session.id}`} | "action" |  | NOT EXECUTED individually |
| components/job-order-work-tracking.tsx:46 | input | {`job-order-work-note-${session.id}`} | "notes" |  | NOT EXECUTED individually |
| components/job-order-work-tracking.tsx:46 | SubmitButton | {`job-order-stop-work-button-${session.id}`} | (composed) | Save | NOT EXECUTED individually |
| components/job-order-work-tracking.tsx:50 | form | {`job-order-start-work-form-${staff.staffId}`} | {startTechnicianWork} |  | NOT EXECUTED individually |
| components/job-order-work-tracking.tsx:50 | SubmitButton | {`job-order-start-work-button-${staff.staffId}`} | (composed) |  | NOT EXECUTED individually |
| components/list-tabs.tsx:10 | Tabs | {id} | (composed) |  | NOT EXECUTED individually |
| components/location-map-field.tsx:17 | textarea | {`public-branch-map-url-input-${branchId}`} | "mapUrl" |  | NOT EXECUTED individually |
| components/location-map-field.tsx:26 | form | {id} | {async data=>{setError(undefined);const result=await saveBranchPublic(data);setError(result.error);}} |  | NOT EXECUTED individually |
| components/location-map.tsx:15 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/location-map.tsx:15 | a | {`${id}-directions`} | {directionsUrl} | Get directions | NOT EXECUTED individually |
| components/management-ui.tsx:26 | Link | {`${id}-close-button`} | {closeHref} |  | NOT EXECUTED individually |
| components/marketing/plan-catalog.tsx:17 | Link | "negosu-view-all-plans-link" | "/plans" | Compare all plans | NOT EXECUTED individually |
| components/marketing/plan-catalog.tsx:20 | Link | (unscoped) | {petCareBrand.path} | Explore Pet Care. | NOT EXECUTED individually |
| components/marketing/plan-catalog.tsx:37 | a | {`negosu-plan-${plan.id}-contact-link`} | "mailto:sales@negosu.com" | Contact sales | NOT EXECUTED individually |
| components/marketing/plan-catalog.tsx:38 | Link | {`negosu-plan-${plan.id}-start-link`} | "/signup" |  | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:28 | Link | "negosu-header-home-link" | "/" |  | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:33 | Link | "negosu-desktop-solutions-link" | "/#solutions" | Solutions | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:34 | Link | "negosu-desktop-automotive-link" | {marketingBrands.automotive.path} | Automotive | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:35 | Link | "negosu-desktop-salon-link" | {marketingBrands.salon.path} | Salon &amp; Beauty | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:36 | Link | "negosu-desktop-pet-care-link" | {petCareBrand.path} | Pet Care | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:37 | Link | "negosu-desktop-hospitality-link" | {hospitalityBrand.path} | Apartelle &amp; Inn | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:38 | Link | "negosu-desktop-features-link" | "/#features" | Features | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:39 | Link | "negosu-desktop-plans-link" | "/plans" | Plans | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:43 | Link | "negosu-header-sign-in-link" | {loginPath} | Sign In | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:44 | Link | "negosu-header-start-free-button" | {signupPath} | Start Free | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:52 | Link | "negosu-mobile-solutions-link" | "/#solutions" | Solutions | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:53 | Link | "negosu-mobile-automotive-link" | {marketingBrands.automotive.path} | Automotive | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:54 | Link | "negosu-mobile-salon-link" | {marketingBrands.salon.path} | Salon &amp; Beauty | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:55 | Link | "negosu-mobile-pet-care-link" | {petCareBrand.path} | Pet Care | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:56 | Link | "negosu-mobile-hospitality-link" | {hospitalityBrand.path} | Apartelle &amp; Inn | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:57 | Link | "negosu-mobile-features-link" | "/#features" | Features | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:58 | Link | "negosu-mobile-plans-link" | "/plans" | Plans | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:60 | Link | "negosu-mobile-sign-in-link" | {loginPath} | Sign In | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:61 | Link | "negosu-mobile-start-free-button" | {signupPath} | Start Free | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:84 | Link | {`negosu-${toId(vertical)}-start-free-button`} | {marketingBrands[vertical].signupPath} | Start Free | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:87 | a | {`negosu-${toId(vertical)}-explore-features-button`} | {`#negosu-${toId(vertical)}-features`} | Explore Features | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:149 | Link | {vertical ? `negosu-${toId(vertical)}-final-start-button` : "negosu-final-start-button"} | {signupPath} | Start Free | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:166 | Link | "negosu-footer-automotive-link" | {marketingBrands.automotive.path} | Automotive | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:167 | Link | "negosu-footer-salon-link" | {marketingBrands.salon.path} | Salon &amp; Beauty | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:168 | Link | "negosu-footer-pet-care-link" | {petCareBrand.path} | Pet Care | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:169 | Link | "negosu-footer-hospitality-link" | {hospitalityBrand.path} | Apartelle &amp; Inn | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:170 | Link | "negosu-footer-plans-link" | "/plans" | Plans | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:171 | Link | "negosu-footer-sign-in-link" | {vertical ? marketingBrands[vertical].loginPath : "/login"} | Sign In | NOT EXECUTED individually |
| components/marketing/product-landing.tsx:172 | Link | "negosu-footer-start-free-link" | {vertical ? marketingBrands[vertical].signupPath : "/signup"} | Start Free | NOT EXECUTED individually |
| components/open-queue-display.tsx:31 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/open-queue-display.tsx:31 | a | {id} | {href} |  | NOT EXECUTED individually |
| components/operations-forms.tsx:25 | form | {`${idPrefix}-${service?"edit":"create"}-form`} | {saveService} |  | NOT EXECUTED individually |
| components/operations-forms.tsx:26 | Input | {`${idPrefix}-name-input`} | "name" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:28 | Input | {`${idPrefix}-base-price-input`} | "basePrice" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:29 | Input | {`${idPrefix}-duration-input`} | "durationMinutes" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:30 | Input | (unscoped) | "code" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:31 | SearchableSelect | {`${idPrefix}-parent-service-select`} | "parentServiceId" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:32 | Input | (unscoped) | "shortDescription" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:33 | textarea | (unscoped) | "description" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:34 | textarea | (unscoped) | "vehiclePrices" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:35 | Input | (unscoped) | {`branchBasePrice:${branch.id}`} |  | NOT EXECUTED individually |
| components/operations-forms.tsx:35 | textarea | (unscoped) | {`branchVehiclePrices:${branch.id}`} |  | NOT EXECUTED individually |
| components/operations-forms.tsx:36 | input | (unscoped) | "allBranches" | Available at all branches | NOT EXECUTED individually |
| components/operations-forms.tsx:36 | input | (unscoped) | "branchIds" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:37 | input | (unscoped) | "isAddOn" | This is an add-on | NOT EXECUTED individually |
| components/operations-forms.tsx:38 | SubmitButton | {`${idPrefix}-save-button`} | (composed) | Save | NOT EXECUTED individually |
| components/operations-forms.tsx:49 | form | {formId} | {async data=>{setSaveError(undefined);const result=await action(data);if(result)setSaveError(result.error);}} |  | NOT EXECUTED individually |
| components/operations-forms.tsx:52 | SearchableSelect | {`${controlPrefix}-branch-select`} | "branchId" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:54 | Input | {`${controlPrefix}-starts-at-input`} | "startsAt" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:54 | input | {`${controlPrefix}-allow-conflict-checkbox`} | "acceptConflict" | Allow an overlapping booking after reviewing the schedule | NOT EXECUTED individually |
| components/operations-forms.tsx:55 | SearchableSelect | {`${controlPrefix}-staff-select`} | "staffIds" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:55 | SearchableSelect | {`${controlPrefix}-resource-select`} | "resourceIds" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:57 | textarea | {`${controlPrefix}-customer-notes-input`} | {mode==="appointment"?"customerNote":"notes"} |  | NOT EXECUTED individually |
| components/operations-forms.tsx:58 | textarea | {`${controlPrefix}-internal-notes-input`} | "internalNote" |  | NOT EXECUTED individually |
| components/operations-forms.tsx:59 | SubmitButton | {`${controlPrefix}-save-button`} | (composed) |  | NOT EXECUTED individually |
| components/password-fields.tsx:21 | Input | {`${idPrefix}-password-input`} | "password" |  | NOT EXECUTED individually |
| components/password-fields.tsx:26 | Input | {`${idPrefix}-confirm-password-input`} | "confirmPassword" | Confirm password | NOT EXECUTED individually |
| components/payment-workspace.tsx:33 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/payment-workspace.tsx:33 | Link | "payments-retry-button" | {baseHref} | Retry | NOT EXECUTED individually |
| components/payment-workspace.tsx:42 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/payment-workspace.tsx:42 | Link | "payments-appointments-button" | {appointmentsHref} | View appointments | NOT EXECUTED individually |
| components/payment-workspace.tsx:47 | Tabs | "payments-tabs" | (composed) |  | NOT EXECUTED individually |
| components/payment-workspace.tsx:54 | form | "payments-search-form" | {baseHref} |  | NOT EXECUTED individually |
| components/payment-workspace.tsx:56 | input | "payments-search-input" | "q" |  | NOT EXECUTED individually |
| components/payment-workspace.tsx:57 | Button | "payments-search-button" | (composed) |  | NOT EXECUTED individually |
| components/payment-workspace.tsx:58 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/payment-workspace.tsx:58 | Link | "payments-search-clear" | {paymentViewHref(baseHref,view.tab)} |  | NOT EXECUTED individually |
| components/payment-workspace.tsx:82 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/payment-workspace.tsx:82 | Link | "payments-previous" | {paymentViewHref(baseHref,view.tab,view.search,view.page-1)} | Previous | NOT EXECUTED individually |
| components/payment-workspace.tsx:82 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/payment-workspace.tsx:82 | Link | "payments-next" | {paymentViewHref(baseHref,view.tab,view.search,view.page+1)} | Next | NOT EXECUTED individually |
| components/pet-care-forms.tsx:18 | form | "pet-form" | {savePet} |  | NOT EXECUTED individually |
| components/pet-care-forms.tsx:21 | Input | "pet-name-input" | "name" | Pet name | NOT EXECUTED individually |
| components/pet-care-forms.tsx:22 | select | "pet-species-select" | "species" |  | NOT EXECUTED individually |
| components/pet-care-forms.tsx:23 | Input | "pet-breed-input" | "breed" | Breed (optional) | NOT EXECUTED individually |
| components/pet-care-forms.tsx:24 | Input | "pet-birth-input" | "date_of_birth" | Date of birth (optional) | NOT EXECUTED individually |
| components/pet-care-forms.tsx:25 | select | "pet-size-select" | "size_category" |  | NOT EXECUTED individually |
| components/pet-care-forms.tsx:26 | select | "pet-active-select" | "is_active" |  | NOT EXECUTED individually |
| components/pet-care-forms.tsx:27 | textarea | {`pet-${name}-input`} | {String(name)} |  | NOT EXECUTED individually |
| components/pet-care-forms.tsx:28 | SubmitButton | "pet-save-button" | (composed) | Save pet | NOT EXECUTED individually |
| components/pet-care-forms.tsx:33 | form | "pet-appointment-form" | {async data => { setError(undefined); const result = await (walkIn ? saveAppointmentWalkIn(data) : savePetAppointment(data)); setError(result.error); }} |  | NOT EXECUTED individually |
| components/pet-care-forms.tsx:36 | Input | "pet-appointment-time-input" | "startsAt" | Appointment time ( ) | NOT EXECUTED individually |
| components/pet-care-forms.tsx:39 | SearchableSelect | "pet-appointment-staff-select" | "staffIds" | Groomer | NOT EXECUTED individually |
| components/pet-care-forms.tsx:40 | SearchableSelect | "pet-appointment-resource-select" | "resourceIds" | Grooming resource | NOT EXECUTED individually |
| components/pet-care-forms.tsx:42 | SubmitButton | "pet-appointment-save-button" | (composed) |  | NOT EXECUTED individually |
| components/pet-visit-fields.tsx:21 | SearchableSelect | "pet-appointment-pet-select" | "petId" |  | NOT EXECUTED individually |
| components/pet-visit-fields.tsx:22 | Button | "pet-appointment-new-pet-button" | {()=>open()} | Add pet and owner | NOT EXECUTED individually |
| components/pet-visit-fields.tsx:22 | Input | "pet-appointment-new-pet-name" | (composed) | Pet name | NOT EXECUTED individually |
| components/pet-visit-fields.tsx:22 | select | "pet-appointment-new-pet-species" | (composed) |  | NOT EXECUTED individually |
| components/pet-visit-fields.tsx:22 | Button | "pet-appointment-new-pet-save" | {()=>void save()} |  | NOT EXECUTED individually |
| components/plan-upgrade.tsx:30 | Button | {`${id}-button`} | (composed) |  | NOT EXECUTED individually |
| components/plan-upgrade.tsx:30 | Link | (unscoped) | {upgradeDestination(upgrade.plan.id, isOwner)} |  | NOT EXECUTED individually |
| components/public-chat.tsx:89 | button | "public-chat-open" | {() => setOpen(true)} | Chat | NOT EXECUTED individually |
| components/public-chat.tsx:92 | Button | "public-chat-close" | {close} |  | NOT EXECUTED individually |
| components/public-chat.tsx:95 | select | "public-chat-branch" | (composed) |  | NOT EXECUTED individually |
| components/public-chat.tsx:98 | Button | {`public-chat-topic-${key}`} | {() => setTopic(key)} |  | NOT EXECUTED individually |
| components/public-chat.tsx:100 | select | "public-chat-service" | (composed) |  | NOT EXECUTED individually |
| components/public-chat.tsx:102 | a | "public-chat-call" | {`tel:${(branch?.phone \|\| shop.phone)!.replace(/[^\d+]/g, "")}`} | Call the business | NOT EXECUTED individually |
| components/public-chat.tsx:107 | form | "public-chat-message-form" | (composed) |  | NOT EXECUTED individually |
| components/public-chat.tsx:107 | Input | "public-chat-name" | (composed) | Your name | NOT EXECUTED individually |
| components/public-chat.tsx:110 | Button | {`public-chat-suggestion-${suggestion.id}`} | {() => setBody(suggestion.text)} |  | NOT EXECUTED individually |
| components/public-chat.tsx:110 | textarea | "public-chat-message" | (composed) | Message | NOT EXECUTED individually |
| components/public-chat.tsx:110 | Button | "public-chat-send" | (composed) |  | NOT EXECUTED individually |
| components/public-chat.tsx:110 | Button | "public-chat-reset" | {reset} | Start a new conversation | NOT EXECUTED individually |
| components/public-chat.tsx:112 | Button | "public-chat-book" | (composed) |  | NOT EXECUTED individually |
| components/public-chat.tsx:112 | Link | (unscoped) | {bookingHref} | Book an appointment | NOT EXECUTED individually |
| components/public-contact.tsx:21 | a | {`public-contact-phone-${contact.id}`} | {`tel:${contact.phone.replace(/[^\d+]/g,"")}`} |  | NOT EXECUTED individually |
| components/public-contact.tsx:22 | a | {`public-contact-email-${contact.id}`} | {`mailto:${encodeURIComponent(contact.email)}`} |  | NOT EXECUTED individually |
| components/public-contact.tsx:25 | a | {`public-contact-${channel.label.toLowerCase()}`} | {channel.href} |  | NOT EXECUTED individually |
| components/record-item.tsx:24 | Link | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/searchable-select.tsx:56 | input | {id} | {() => setOpen(true)} |  | NOT EXECUTED individually |
| components/searchable-select.tsx:65 | button | {`${id}-clear`} | {() => choose()} |  | NOT EXECUTED individually |
| components/searchable-select.tsx:74 | button | {`${id}-create`} | {() => { onCreate(query.trim()); setOpen(false); }} |  | NOT EXECUTED individually |
| components/section-placeholder.tsx:9 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/section-placeholder.tsx:9 | Link | (unscoped) | "/dashboard" | Back to dashboard | NOT EXECUTED individually |
| components/service-catalog.tsx:33 | Button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/service-catalog.tsx:33 | Link | {`${prefix}-edit-${service.id}`} | {`/dashboard/services/${service.id}/edit`} | Edit | NOT EXECUTED individually |
| components/service-catalog.tsx:41 | Button | {`${prefix}-add-button`} | (composed) |  | NOT EXECUTED individually |
| components/service-catalog.tsx:41 | Link | (unscoped) | {href("category-create")} | Add category | NOT EXECUTED individually |
| components/service-catalog.tsx:44 | Button | {`${prefix}-edit-${category.id}`} | (composed) |  | NOT EXECUTED individually |
| components/service-catalog.tsx:44 | Link | (unscoped) | {href("category-edit",category.id)} | Edit | NOT EXECUTED individually |
| components/service-catalog.tsx:44 | Button | {`${prefix}-delete-${category.id}`} | (composed) |  | NOT EXECUTED individually |
| components/service-catalog.tsx:44 | Link | (unscoped) | {href("category-delete",category.id)} | Delete | NOT EXECUTED individually |
| components/service-category-form.tsx:22 | form | {`${prefix}-${mode}-form`} | {action} |  | NOT EXECUTED individually |
| components/service-category-form.tsx:32 | Input | {`${prefix}-${mode}-name-input`} | "name" | Category name | NOT EXECUTED individually |
| components/service-category-form.tsx:35 | Input | {`${prefix}-${mode}-sort-input`} | "sortOrder" | Sort order | NOT EXECUTED individually |
| components/service-category-form.tsx:38 | input | {`${prefix}-${mode}-active-input`} | "isActive" | Available when adding services | NOT EXECUTED individually |
| components/service-category-form.tsx:41 | SubmitButton | {`${prefix}-${mode}-save-button`} | (composed) |  | NOT EXECUTED individually |
| components/staff-branch-fieldset.tsx:18 | input | {`${id}-all-checkbox`} | "allBranches" | All current and future branches | NOT EXECUTED individually |
| components/staff-branch-fieldset.tsx:24 | input | {`${id}-${branch.id}-checkbox`} | "branchIds" |  | NOT EXECUTED individually |
| components/staff-management.tsx:62 | form | {`${prefix}-form`} | {saveStaffProfile} |  | NOT EXECUTED individually |
| components/staff-management.tsx:65 | Input | {`${prefix}-name-input`} | "fullName" | Full name | NOT EXECUTED individually |
| components/staff-management.tsx:68 | Input | {`${prefix}-email-input`} | "email" | Email | NOT EXECUTED individually |
| components/staff-management.tsx:72 | Input | {`${prefix}-mobile-input`} | "mobile" | Mobile | NOT EXECUTED individually |
| components/staff-management.tsx:77 | Input | {`${prefix}-job-function-input`} | "jobFunction" | Job function | NOT EXECUTED individually |
| components/staff-management.tsx:81 | Input | {`${prefix}-specializations-input`} | "specializations" | Specialties | NOT EXECUTED individually |
| components/staff-management.tsx:84 | select | {`${prefix}-status-select`} | "isActive" |  | NOT EXECUTED individually |
| components/staff-management.tsx:90 | SubmitButton | {`${prefix}-save-button`} | (composed) |  | NOT EXECUTED individually |
| components/staff-management.tsx:103 | form | {`${prefix}-form`} | {createStaffProfileInvitation} |  | NOT EXECUTED individually |
| components/staff-management.tsx:106 | Input | {`${prefix}-login-email-input`} | "loginEmail" | Login email | NOT EXECUTED individually |
| components/staff-management.tsx:112 | select | {`${prefix}-expiry-select`} | "expiresHours" |  | NOT EXECUTED individually |
| components/staff-management.tsx:116 | SubmitButton | {`${prefix}-save-button`} | (composed) |  | NOT EXECUTED individually |
| components/staff-management.tsx:119 | form | {`${prefix}-form`} | {updateStaffProfileAccess} |  | NOT EXECUTED individually |
| components/staff-management.tsx:123 | select | {`${prefix}-status-select`} | "isActive" |  | NOT EXECUTED individually |
| components/staff-management.tsx:129 | SubmitButton | {`${prefix}-save-button`} | (composed) | Save system access | NOT EXECUTED individually |
| components/staff-management.tsx:162 | select | {id} | {name} |  | NOT EXECUTED individually |
| components/staff-management.tsx:170 | Button | {`${prefix}-edit-${profile.id}`} | (composed) |  | NOT EXECUTED individually |
| components/staff-management.tsx:170 | Link | (unscoped) | {`/dashboard/settings/staff?dialog=edit&staffId=${profile.id}`} | Edit | NOT EXECUTED individually |
| components/staff-management.tsx:170 | Button | {`${prefix}-access-${profile.id}`} | (composed) |  | NOT EXECUTED individually |
| components/staff-management.tsx:170 | Link | (unscoped) | {`/dashboard/settings/staff?dialog=access&staffId=${profile.id}`} |  | NOT EXECUTED individually |
| components/submit-button.tsx:9 | Button | {id} | (composed) |  | NOT EXECUTED individually |
| components/suggested-value-field.tsx:13 | SearchableSelect | {id} | {name} |  | NOT EXECUTED individually |
| components/suggested-value-field.tsx:13 | Input | {`${id}-new-name`} | (composed) |  | NOT EXECUTED individually |
| components/suggested-value-field.tsx:13 | Button | {`${id}-new-save`} | {()=>{const next=draft.trim();setAdded(current=>[...current,next]);onValueChange(next);setDraft(null);}} | Use | NOT EXECUTED individually |
| components/ui/button.tsx:64 | button | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/ui/input.tsx:6 | input | (unscoped) | (composed) |  | NOT EXECUTED individually |
| components/ui/tabs.tsx:36 | Link | {item.id} | {item.href} |  | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:84 | SearchableSelect | {customerSelectId} | {customerName} |  | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:85 | Button | {`${prefix}-quick-${lowerLabel}-open-button`} | {() => open("customer")} | Create | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:87 | Input | {`${prefix}-quick-${lowerLabel}-name`} | (composed) | Full name * | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:88 | Input | {`${prefix}-quick-${lowerLabel}-phone`} | (composed) | Phone (optional) | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:89 | Input | {`${prefix}-quick-${lowerLabel}-email`} | (composed) | Email (optional) | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:90 | Button | {`${prefix}-quick-${lowerLabel}-save-button`} | {() => void save("customer")} |  | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:96 | SearchableSelect | {`${vehiclePrefix}-vehicle-select`} | "vehicleId" |  | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:97 | Button | {`${prefix}-quick-vehicle-open-button`} | {() => open("vehicle")} | Create vehicle | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:99 | Input | {`${prefix}-quick-vehicle-make`} | (composed) | Make * | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:100 | Input | {`${prefix}-quick-vehicle-model`} | (composed) | Model * | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:101 | Input | {`${prefix}-quick-vehicle-plate`} | (composed) | Plate (optional) | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:102 | Input | {`${prefix}-quick-vehicle-type`} | (composed) | Vehicle class (optional) | NOT EXECUTED individually |
| components/visit-entity-fields.tsx:103 | Button | {`${prefix}-quick-vehicle-save-button`} | {() => void save("vehicle")} |  | NOT EXECUTED individually |
| components/workspace-theme-form.tsx:8 | form | "settings-theme-form" | {updateDashboardTheme} |  | NOT EXECUTED individually |
| components/workspace-theme-form.tsx:16 | SubmitButton | "settings-theme-save-button" | (composed) | Apply color theme | NOT EXECUTED individually |
| components/workspace-theme-form.tsx:21 | input | {`settings-theme-radio-${theme.id}`} | "dashboardTheme" |  | NOT EXECUTED individually |

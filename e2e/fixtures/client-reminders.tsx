import React from "react";
import { createRoot } from "react-dom/client";
import { ReminderRows, HistoryNavigation } from "@/components/client-reminder-rows";
import { AppointmentBackButton } from "@/components/appointment-back-button";
const query = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(<>
  <AppointmentBackButton from={query.get("from") ?? undefined}/>
  <ReminderRows now="2026-10-05T00:00:00Z" timezone="Asia/Manila" canWrite={!query.has("readonly")} rows={[{ id: "reminder-one", customer_id: "client-one", reason: "Facial and cleaning follow-up with a long note to check mobile wrapping", due_at: "2020-10-05T06:30:00Z", status: "pending", resolved_at: null, customers: { full_name: "Client with a long display name", phone: "09171234567" }, branches: { name: "Main", timezone: "Asia/Manila" } }]}/>
  <HistoryNavigation id="test-history" path="/dashboard/customers/client-one" parameter="historyPage" page={1} hasMore/>
</>);

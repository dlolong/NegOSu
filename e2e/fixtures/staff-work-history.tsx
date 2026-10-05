import React from "react";
import { createRoot } from "react-dom/client";
import { StaffWorkHistory } from "@/components/staff-work-history";
import { WorkContributors } from "@/components/work-contributors";
import type { StaffWork } from "@/modules/core/staff/work-history";
const rows: StaffWork[] = [{ kind: "appointment", record_id: "visit", target_id: "visit", staff_id: "alex", customer_name: "Jamie Customer", occurred_at: "2026-10-05T02:00:00Z", time_label: "Appointment time", work_label: "Haircut and color promo", sources: ["visit_assignment"] }];
const params = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(<><StaffWorkHistory staffId="alex" branchName="Main" industry="salon" timezone="Asia/Manila" query={{}} page={1} rows={params.has("empty") ? [] : rows} error={params.has("error")}/><section id="fixture-contributors"><WorkContributors canOpenStaff people={[{staffId:"alex",name:"Alex",sources:["visit_assignment"]},{staffId:"bo",name:"Bo",sources:["service_assignment","work_session"]}]}/></section></>);

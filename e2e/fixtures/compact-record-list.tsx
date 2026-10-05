import React from "react";
import { createRoot } from "react-dom/client";
import { RecordTable } from "@/components/record-table";
import { RecordLink } from "@/components/record-item";
createRoot(document.getElementById("root")!).render(<RecordTable searchable id="records" caption="Visits" columns={[{key:"name",label:"Client"},{key:"date",label:"Date",secondary:true},{key:"status",label:"Status"},{key:"actions",label:"Actions",align:"right"}]} rows={[{id:"ana",cells:{name:<RecordLink id="ana-open" href="/clients/ana">Ana</RecordLink>,date:"Oct 5, 2026, 10:00 AM",status:"Completed",actions:<a id="ana-edit" href="/clients/ana/edit">Edit</a>}}, {id:"bea",cells:{name:"Bea",date:"Oct 6, 2026, 11:00 AM",status:"Scheduled",actions:<button id="bea-edit">Edit</button>}}]}/>);

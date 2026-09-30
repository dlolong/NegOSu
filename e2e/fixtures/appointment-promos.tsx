import React, {useState} from "react";
import { createRoot } from "react-dom/client";
import { ServicePicker } from "@/components/catalog-fields";
import { saveAppointment } from "@/app/dashboard/operations-actions";
function Fixture(){
 const [branch,setBranch]=useState("main"),[date,setDate]=useState("2026-10-01");
 return <form action={saveAppointment}><label>Branch<select id="promo-test-branch" value={branch} onChange={e=>setBranch(e.target.value)}><option value="main">Main</option><option value="other">Other</option></select></label><label>Date<input id="promo-test-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><ServicePicker key={branch} id="booking" branchId={branch} appointmentDate={date} services={[{id:"10000000-0000-4000-8000-000000000002",name:"Haircut"}]} defaultIds={["10000000-0000-4000-8000-000000000002"]} promos={[{id:"10000000-0000-4000-8000-000000000001",serviceId:"10000000-0000-4000-8000-000000000002",serviceIds: new URLSearchParams(location.search).has("multi") ? ["10000000-0000-4000-8000-000000000002","10000000-0000-4000-8000-000000000003"] : undefined,name:"Haircut and take-home shampoo",description:"One haircut and one bottle",branchId:"main",priceCentavos:120000,currency:"PHP",version:2,validFrom:"2026-10-01",validThrough:"2026-10-31"}]}/><button id="promo-test-save" type="submit">Book</button></form>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);

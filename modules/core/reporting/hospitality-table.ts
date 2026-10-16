import type { HospitalityWorkspace } from "@/modules/hospitality/contracts";
import { formatMoney } from "@/lib/operations";
export function hospitalityReportTable(report:HospitalityWorkspace,section:string,currency:string) {
 const keys=section==="stays"?["guest","room","checked_in_at","checked_out_at",...(report.finance?["charges","paid","balance"]:[])]:["guest","room","paid_at","method","status","amount"];
 const labels:Record<string,string>={guest:"Guest",room:"Room",checked_in_at:"Check-in",checked_out_at:"Check-out",charges:"Total amount",paid:"Revenue collected",balance:"Balance",paid_at:"Received",method:"Method",status:"Status",amount:"Amount"};
 return {columns:keys.map(key=>({key,label:labels[key]??key})),rows:report.rows.map((row,index)=>({id:String(row.payment_id??row.id??index),cells:Object.fromEntries(keys.map(key=>[key,["charges","paid","balance","amount"].includes(key)?formatMoney(Number(row[key]??0),currency):key.endsWith("_at")&&row[key]?new Intl.DateTimeFormat("en-PH",{timeZone:String(row.timezone??"UTC"),dateStyle:"medium",timeStyle:"short"}).format(new Date(String(row[key]))):String(row[key]??"—")]))}))};
}

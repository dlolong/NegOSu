import type { OwnerReport } from "@/lib/reporting";
import { formatMoney } from "@/lib/operations";

/** Shared mapping for default and filtered booking tables. Amounts remain canonical. */
export function bookingReportTable(report: OwnerReport, category: "bookings" | "payments", currency: string, industry = "salon"): {columns: {key:string;label:string}[];rows:{id:string;cells:Record<string,string>}[]} {
  const date = (value: string, timezone: string) => new Intl.DateTimeFormat("en-PH", {timeZone:timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
  const details = report.bookingDetails ?? report.salonDetails;
  const labels = bookingReportLabels(industry);
  if (!details) throw new Error("Booking report details unavailable");
  if (category === "bookings") return {
    columns: [{key:"date",label:labels.date},{key:"client",label:labels.client},{key:"staff",label:labels.staff},{key:"products",label:labels.products},{key:"total",label:labels.total},{key:"status",label:"Status"}],
    rows: details.appointments.map(row=>({id:row.id,cells:{date:date(row.starts_at,row.timezone),client:row.client,staff:row.staff,products:row.products,total:formatMoney(row.total,currency),status:row.status.replaceAll("_"," ")}})),
  };
  return {
    columns:[{key:"date",label:"Received"},{key:"method",label:"Method"},{key:"status",label:"Status"},{key:"amount",label:"Amount"}],
    rows:details.payments.map(row=>({id:row.id,cells:{date:date(row.paid_at,row.timezone),method:row.method.replaceAll("_"," "),status:row.status.replaceAll("_"," "),amount:formatMoney(row.amount,currency)}})),
  };
}

export function bookingReportLabels(industry: string) {
  return industry === "automotive" ? {date:"Booking",client:"Customer",staff:"Technicians",products:"Products purchased",total:"Total billed"}
    : industry === "pet_care" ? {date:"Grooming appointment",client:"Pet owner",staff:"Grooming staff",products:"Products availed",total:"Total amount"}
    : {date:"Appointment",client:"Client",staff:"Staff",products:"Products availed",total:"Total amount"};
}

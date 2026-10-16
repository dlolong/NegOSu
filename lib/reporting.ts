import { z } from "zod";

export const reportQuerySchema = z.object({ preset: z.enum(["today", "7d", "30d", "month", "custom"]).default("month"), start: z.iso.date().optional(), end: z.iso.date().optional(), branch: z.union([z.literal("all"), z.uuid()]).default("all") });
export type BookingReportDetails = {appointments: Array<{id:string;starts_at:string;timezone:string;status:string;client:string;staff:string;products:string;total:number}>;payments:Array<{id:string;paid_at:string;timezone:string;method:string;status:string;amount:number}>;industry?: string};
export type OwnerReport = {bookingDetails?: BookingReportDetails;salonDetails?: BookingReportDetails; startDate:string;endDate:string;summary:{grossSalesCentavos:number;paymentsReceivedCentavos:number;outstandingCentavos:number;jobsCompleted:number;averageTicketCentavos:number;customersServed:number;repeatCustomers:number;newCustomers:number};daily:Array<{day:string;grossSalesCentavos:number;paymentsReceivedCentavos:number;jobsCompleted:number}>;services:Array<{service:string;category:string;revenueCentavos:number;quantity:number}>;categories:Array<{category:string;revenueCentavos:number}>;technicians:Array<{name:string;assignedJobs:number;completedJobs:number}>;branches:Array<{id:string;name:string;grossSalesCentavos:number;invoices:number}> };
export const reportAccessSchema = z.object({ features: z.object({ advanced_reports: z.boolean() }) });

export function resolveReportScope(filters: z.infer<typeof reportQuerySchema>, membership: { branchId: string; timezone: string; branches: readonly { id: string }[] }, advanced: boolean, now = new Date()) {
  let effectiveFilters = advanced ? filters : { ...filters, branch: membership.branchId };
  if (!advanced) {
    const requested = resolveReportRange(effectiveFilters, membership.timezone, now);
    const today = localIsoDate(now, membership.timezone);
    const earliest = new Date(`${today}T12:00:00Z`); earliest.setUTCDate(earliest.getUTCDate() - 30);
    if (requested.start < earliest.toISOString().slice(0, 10) || requested.end > today || requested.start > requested.end) effectiveFilters = reportQuerySchema.parse({ preset: "30d", branch: membership.branchId });
  }
  const branch = effectiveFilters.branch === "all" || membership.branches.some(({ id }) => id === effectiveFilters.branch)
    ? effectiveFilters.branch : membership.branchId;
  return { filters: effectiveFilters, branch, range: resolveReportRange(effectiveFilters, membership.timezone, now) };
}
function localIsoDate(date:Date,timeZone:string){return new Intl.DateTimeFormat("en-CA",{timeZone}).format(date)}
export function resolveReportRange(input:z.infer<typeof reportQuerySchema>,timeZone:string,now=new Date()){const today=localIsoDate(now,timeZone);if(input.preset==="custom"&&input.start&&input.end&&input.start<=input.end)return{start:input.start,end:input.end};if(input.preset==="today")return{start:today,end:today};const date=new Date(`${today}T12:00:00Z`);if(input.preset==="month")return{start:`${today.slice(0,7)}-01`,end:today};date.setUTCDate(date.getUTCDate()-(input.preset==="7d"?6:29));return{start:date.toISOString().slice(0,10),end:today}}
export function csvCell(value:string|number){const raw=String(value);const text=typeof value === "string" && /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw;return /[",\n\r]/.test(text)?`"${text.replaceAll('"','""')}"`:text}

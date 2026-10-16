import type { CatalogReport } from "@/modules/core/reporting/catalog-report";
import { bookingReportLabels } from "@/modules/core/reporting/booking-tables";
import { z } from "zod";
import { csvCell, type OwnerReport } from "@/lib/reporting";
import type { ClientPurchaseReport } from "@/modules/core/reporting/client-purchase-report";
import type { HospitalityWorkspace } from "@/modules/hospitality/contracts";

export const trialCreditsSchema = z.object({ initial: z.literal(100), remaining: z.number().int().min(0).max(100) });
export const creditReportPayloadSchema = z.object({
  maxCost: z.number().int().min(0).max(1).default(1),
  kind: z.enum(["clients", "overview", "hospitality", "catalog"]), action: z.enum(["advanced_report", "csv_export"]),
  start: z.iso.date(), end: z.iso.date(), branch: z.uuid().nullable(),
  client: z.string().trim().max(120).default(""), item: z.string().trim().max(120).default(""),
  purchaseKind: z.enum(["all", "service", "product", "other"]).default("all"),
  section: z.enum(["stays", "rooms", "collections", "outstanding", "inventory", "movements", "deposits", "promos"]).default("stays"),
}).refine(input => input.start <= input.end && Date.parse(input.end) - Date.parse(input.start) <= 731 * 86400000, "Choose dates in order, covering no more than 732 days.");
export const creditReportRequestSchema = z.object({ requestId: z.uuid(), payload: creditReportPayloadSchema });
export type CreditReportPayload = z.infer<typeof creditReportPayloadSchema>;
export type CreditSnapshot = { id: string; payload: CreditReportPayload; report: ClientPurchaseReport | OwnerReport | HospitalityWorkspace | CatalogReport; cost: number; remaining: number; createdAt: string };
export type CreditHistory = { id: string; kind: string; action: string; createdAt: string }[];
export type ReportSection = { title: string; columns: string[]; rows: (string | number)[][] };
/** The same data mapping is used for the snapshot tables and CSV. Amounts are explicitly centavos. */
export function creditReportSections(snapshot: CreditSnapshot): ReportSection[] {
  if (snapshot.payload.kind === "catalog") {
    const data=snapshot.report as CatalogReport;
    return [{title:data.category,columns:["Name","Branch","Status","Price / rates centavos","Bookings / bills","Total amount centavos","Revenue centavos"],rows:data.rows.map(r=>[r.name,r.branch,r.status,r.price??r.rates?.map(rate=>`${rate.label}: ${rate.priceCentavos}`).join("; ")??"",r.bookings??r.bills??0,r.amount,r.revenue])},{title:"Totals",columns:["Total amount centavos","Revenue centavos"],rows:[[data.summary.amount,data.summary.revenue]]}];
  }
  if (snapshot.payload.kind === "clients") {
    const data = snapshot.report as ClientPurchaseReport;
    return [{ title: "Totals", columns: ["Records", "Total centavos", "Paid centavos", "Balance centavos"], rows: [[data.summary.records, data.summary.total, data.summary.paid, data.summary.balance]] }, {
      title: "Client purchases", columns: ["Client", "Branches", "Staff", "Services / treatments", "Products", "Other charges", "Records", "Total centavos", "Paid centavos", "Balance centavos", "Last activity"],
      rows: data.rows.map(row => [row.name, row.branches.join("; "), row.staff.map(staff => staff.name).join("; "), ...(["service", "product", "other"] as const).map(kind => row.items.filter(item => item.kind === kind).map(item => `${item.name} × ${item.quantity}${item.unit ? ` ${item.unit}` : ""}${item.included ? " (promo inclusion)" : ""}`).join("; ")), row.records, row.total, row.paid, row.balance, row.lastActivity]),
    }];
  }
  if (snapshot.payload.kind === "hospitality") {
    const data = snapshot.report as HospitalityWorkspace;
    const keys = Object.keys(data.rows[0] ?? {}).filter(key => key !== "id" && !key.endsWith("_id"));
    const metrics: (string | number)[][] = [["Occupied rooms now", data.occupied], ["Available rooms now", data.vacant], ["Cleaning rooms now", data.cleaning], ["Inactive rooms now", data.inactive], ["Check-ins in period", data.checkIns], ["Checkouts in period", data.checkOuts], ["In-house stays now", data.inHouse]];
    if (data.finance) metrics.push(["Collected centavos", data.finance.collected], ["Outstanding centavos", data.finance.outstanding], ["Deposits held centavos", data.finance.depositsHeld], ["Deposits received centavos", data.finance.depositsReceived], ["Deposits returned centavos", data.finance.depositsReturned]);
    return [{ title: "Summary", columns: ["Metric", "Value"], rows: metrics }, { title: snapshot.payload.section, columns: keys.map(key => key.replaceAll("_", " ")), rows: data.rows.map(row => keys.map(key => String(row[key] ?? ""))) }];
  }
  const data = snapshot.report as OwnerReport;
  const details = data.bookingDetails ?? data.salonDetails;
  const labels = bookingReportLabels(details?.industry ?? "salon");
  return [
    { title: "Summary", columns: ["Metric", "Value"], rows: [["Gross sales centavos", data.summary.grossSalesCentavos], ["Payments received centavos", data.summary.paymentsReceivedCentavos], ["Outstanding centavos", data.summary.outstandingCentavos], ["Completed work", data.summary.jobsCompleted], ["Average ticket centavos", data.summary.averageTicketCentavos], ["Customers served", data.summary.customersServed], ["Repeat customers", data.summary.repeatCustomers], ["New customers", data.summary.newCustomers]] },
    { title: "Daily", columns: ["Day", "Gross sales centavos", "Payments received centavos", "Completed work"], rows: data.daily.map(row => [row.day, row.grossSalesCentavos, row.paymentsReceivedCentavos, row.jobsCompleted]) },
    { title: "Services", columns: ["Service", "Category", "Revenue centavos", "Quantity"], rows: data.services.map(row => [row.service, row.category, row.revenueCentavos, row.quantity]) },
    { title: "Categories", columns: ["Category", "Revenue centavos"], rows: data.categories.map(row => [row.category, row.revenueCentavos]) },
    { title: "Staff", columns: ["Name", "Assigned", "Completed"], rows: data.technicians.map(row => [row.name, row.assignedJobs, row.completedJobs]) },
    ...(details ? [
      {title:"Appointments",columns:[labels.date,labels.client,labels.staff,labels.products,"Total centavos","Status"],rows:details.appointments.map(row=>[row.starts_at,row.client,row.staff,row.products,row.total,row.status])},
      {title:"Payments",columns:["Received","Method","Status","Amount centavos"],rows:details.payments.map(row=>[row.paid_at,row.method,row.status,row.amount])},
    ] : []),
    { title: "Branches", columns: ["Branch", "Gross sales centavos", "Invoices"], rows: data.branches.map(row => [row.name, row.grossSalesCentavos, row.invoices]) },
  ];
}
export function creditReportCsv(snapshot: CreditSnapshot) {
  const rows: (string | number)[][] = [["Report", snapshot.payload.kind], ["Period", `${snapshot.payload.start} to ${snapshot.payload.end}`], ["Generated", snapshot.createdAt], ["Amounts", "Centavos; current payment and balance snapshots"], ...creditReportSections(snapshot).flatMap(section => [[], [section.title], section.columns, ...section.rows])];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`;
}
export function creditErrorMessage(code?: string) {
  if (code === "P0002") return "Your plan access changed. Refresh to review the credit cost before trying again.";
  if (code === "P0001") return "Your business has used its trial credits. Ask the owner to upgrade the plan to continue.";
  if (code === "42501") return "This report is not available with your current staff or branch permissions.";
  if (code === "54000") return "This report is too large. Choose a shorter period or a single branch.";
  if (code === "22023") return "Check the report filters, or start a new request if they have changed.";
  return "Could not complete this request. Retry the same request to avoid spending twice.";
}

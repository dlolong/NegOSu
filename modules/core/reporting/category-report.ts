import { staffReportSchema, staffReportTable, staffReportNote, type StaffReport } from "./staff-report";
import { catalogReportSchema, catalogReportTable, catalogReportNote } from "./catalog-report";
import { hospitalityReportTable } from "./hospitality-table";
import type { HospitalityWorkspace } from "@/modules/hospitality/contracts";
import { loadBusinessReport } from "./report-reader";
import { bookingReportTable } from "./booking-tables";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationMembership } from "@/lib/auth/context";
import { appointmentAgendaRange, formatMoney } from "@/lib/operations";
import { checkoutRoles } from "@/modules/core/checkout/contracts";
import { clientPurchaseReportSchema } from "./client-purchase-report";
import { reportActionError } from "@/lib/errors/action-error";

type Row = { id: string; cells: Record<string, string | number> };
export async function loadCategoryTableData({ db, member, category, start }: { db: SupabaseClient; member: OrganizationMembership; category: "bookings" | "payments" | "products" | "clients" | "services" | "staff" | "promos" | "rooms"; start: string }) {
  const finance = ["owner", "manager", "advisor", "cashier"].includes(member.role);
  if (category === "payments" && !finance || category === "products" && !checkoutRoles.includes(member.role)) return { denied: true as const };
  let staffReport: StaffReport | undefined;
  let note: string | undefined;
  let summary: {sales:number;revenue:number} | undefined;
  let rows: Row[] = [], total = 0, failed = false;
  const purchase = ["products", "clients", "services"].includes(category);
  let columns = purchase ? [{key:"date",label:"Last activity date"},{key:"name",label:"Client"}, {key:"details",label:category === "products" ? "Products availed" : category === "services" ? "Services / treatments" : "Purchases"}, {key:"total",label:"Total amount"},{key:"paid",label:"Revenue collected"}] : category === "payments" ? [{key:"date",label:"Received"},{key:"method",label:"Method"},{key:"status",label:"Status"},{key:"amount",label:"Amount"}] : [{key:"date",label:"Date"},{key:"name",label:member.industry === "hospitality" ? "Guest / room" : "Client"},{key:"status",label:"Status"}];
  const date = (value: string) => new Intl.DateTimeFormat("en-PH", { timeZone: member.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  try {
    const endDate = new Date(`${start}T12:00:00Z`); endDate.setUTCDate(endDate.getUTCDate()+6);
    if (category === "staff") {
      const {data,error}=await db.rpc("get_staff_transaction_report",{p_org:member.organizationId,p_branch:member.branchId,p_start:start,p_end:endDate.toISOString().slice(0,10)});
      if(error) throw error;
      staffReport=staffReportSchema.parse(data);
      const table=staffReportTable(staffReport,member.currency);
      columns=table.columns;rows=table.rows;total=rows.length;note=staffReportNote;
    } else if (category === "promos" || category === "rooms") {
      const {data,error}=await db.rpc("get_catalog_financial_report",{p_org:member.organizationId,p_branch:member.branchId,p_start:start,p_end:endDate.toISOString().slice(0,10),p_category:category});
      if(error) throw error;
      const report=catalogReportSchema.parse(data),table=catalogReportTable(report,member.currency);
      columns=table.columns;rows=table.rows.slice(0,50);total=report.count;summary={sales:report.summary.amount,revenue:report.summary.revenue};note=catalogReportNote(category);
    } else if (member.industry === "hospitality" && (category === "bookings" || category === "payments")) {
      const {data,error}=await db.rpc("get_hospitality_workspace",{p_org:member.organizationId,p_branch:member.branchId,p_start:start,p_end:endDate.toISOString().slice(0,10),p_section:category === "payments"?"collections":"stays",p_page:1,p_mode:"report"});
      if(error || !data) throw error??new Error("Report unavailable");
      const report=data as HospitalityWorkspace,table=hospitalityReportTable(report,category === "payments"?"collections":"stays",member.currency);
      columns=table.columns;rows=table.rows;total=report.rowCount;
      if(report.reportTotals) summary={sales:report.reportTotals.amount,revenue:report.reportTotals.revenue};
      note="Amount: bills issued in this period. Revenue: paid receipts in this period. Stay rows show current bill totals.";
    } else if ((["salon","pet_care","automotive"].includes(member.industry) && (category === "bookings" || category === "payments"))) {
      const range = appointmentAgendaRange(start, 7, member.timezone);
      if (!range) throw new Error("Invalid report dates");
      const end = new Date(`${start}T12:00:00Z`); end.setUTCDate(end.getUTCDate()+6);
      const report = await loadBusinessReport(db,{organizationId:member.organizationId,branchId:member.branchId,start,end:end.toISOString().slice(0,10),basis:member.industry === "automotive" ? "invoice" : "appointment",advanced:false});
      const table = bookingReportTable(report,category,member.currency,member.industry);
      columns=table.columns; total=table.rows.length; rows=table.rows.slice(0,50);
      summary={sales:report.summary.grossSalesCentavos,revenue:report.summary.paymentsReceivedCentavos};
    } else if (purchase) {
      const kind = category === "products" ? "product" : category === "services" ? "service" : "all";
      const {data,error} = await db.rpc("get_recent_client_purchases", {p_org:member.organizationId,p_branch:member.branchId,p_kind:kind,p_page:1});
      if (error) throw error;
      const report = clientPurchaseReportSchema.parse(data);
      rows = report.rows.map(row => ({id:row.key,cells:{date:row.lastActivity || "—",name:row.name, details:row.items.filter(item=>kind === "all" || item.kind === kind).map(item=>`${item.name} × ${item.quantity}${item.unit ? ` ${item.unit}` : ""}${item.included ? " (included)" : ""}`).join(", ") || "—",total:formatMoney(row.total,member.currency),paid:formatMoney(row.paid,member.currency)}}));
      total = report.count; summary={sales:report.summary.total,revenue:report.summary.paid};note="Totals cover whole matching appointments/bills across all clients, not an item-price allocation. Revenue is paid to date on those records.";
    } else {
      const range = appointmentAgendaRange(start, 7, member.timezone);
      if (!range) throw new Error("Invalid report dates");
      if (category === "payments") {
        const result = await db.from("payments").select("id,paid_at,method,status,amount_centavos", { count: "exact" }).eq("organization_id", member.organizationId).eq("branch_id", member.branchId).gte("paid_at", range.start.toISOString()).lt("paid_at", range.end.toISOString()).order("paid_at", { ascending: false }).order("id").limit(50);
        if (result.error) throw result.error;
        total = result.count ?? 0; rows = (result.data ?? []).map(row => ({ id: row.id, cells: { date: date(row.paid_at), method: row.method.replaceAll("_", " "), status: row.status.replaceAll("_", " "), amount: formatMoney(row.amount_centavos, member.currency) } }));
      } else if (member.industry === "hospitality") {
        const result = await db.from("hospitality_stays").select("id,checked_in_at,checked_out_at,guest_name_snapshot,room_name_snapshot", { count: "exact" }).eq("organization_id", member.organizationId).eq("branch_id", member.branchId).gte("checked_in_at", range.start.toISOString()).lt("checked_in_at", range.end.toISOString()).order("checked_in_at", { ascending: false }).order("id").limit(50);
        if (result.error) throw result.error;
        total = result.count ?? 0; rows = (result.data ?? []).map(row => ({ id: row.id, cells: { date: date(row.checked_in_at), name: `${row.guest_name_snapshot} · ${row.room_name_snapshot}`, status: row.checked_out_at ? "Checked out" : "In house" } }));
      } else {
        const result = await db.from("appointments").select("id,starts_at,status,customers(full_name)", { count: "exact" }).eq("organization_id", member.organizationId).eq("branch_id", member.branchId).gte("starts_at", range.start.toISOString()).lt("starts_at", range.end.toISOString()).order("starts_at", { ascending: false }).order("id").limit(50);
        if (result.error) throw result.error;
        total = result.count ?? 0; rows = (result.data ?? []).map(row => ({ id: row.id, cells: { date: date(row.starts_at), name: (Array.isArray(row.customers) ? row.customers[0]?.full_name : (row.customers as {full_name?:string} | null)?.full_name) ?? "Client", status: row.status.replaceAll("_", " ") } }));
      }
    }
  } catch (error) { failed = true; reportActionError(`reports.category.${category}`, error, "Report unavailable."); }
  return { denied: false as const, failed, rows, total, columns, summary, note, staffReport };
}

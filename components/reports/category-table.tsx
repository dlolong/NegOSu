import { reportListColumns } from "@/modules/core/reporting/table-columns";
import { StaffTransactions } from "./staff-transactions";
import { PaymentTotals } from "./payment-totals";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationMembership } from "@/lib/auth/context";
import { RecordTable } from "@/components/record-table";
import { loadCategoryTableData } from "@/modules/core/reporting/category-report";

export async function CategoryTable({ db, member, category, start }: { db: SupabaseClient; member: OrganizationMembership; category: "bookings" | "payments" | "products" | "clients" | "services" | "staff" | "promos" | "rooms"; start: string }) {
  const result = await loadCategoryTableData({db, member, category, start});
  if (result.denied) return <p className="text-sm">You do not have access to this report.</p>;
  const {failed, rows, total, columns} = result;
  if (failed) return <p role="alert" className="text-sm">This table could not be loaded. Refresh to try again.</p>;
  if (result.staffReport) return <section className="space-y-3"><p className="text-sm text-admin-text-secondary">{member.branchName} · Last 7 days</p><StaffTransactions report={result.staffReport} currency={member.currency}/></section>;
  return <section className="space-y-3"><p className="text-sm text-admin-text-secondary">{member.branchName} · Last 7 days</p>{!result.summary && result.note ? <p className="text-xs text-admin-text-secondary">{result.note}</p> : null}{result.summary ? <PaymentTotals {...result.summary} currency={member.currency} note={result.note}/> : null}<RecordTable reportSearch id={`reports-${category}-table`} caption={category} columns={reportListColumns(columns)} rows={rows} empty="No records in this scope."/>{member.industry === "automotive" && category === "bookings" ? <p className="text-xs text-admin-text-secondary">Total billed includes posted job and product invoices. Bookings without posted invoices show zero.</p> : null}<p className="text-xs text-admin-text-secondary">Showing {rows.length}{` of ${total}`} records.{category === "payments" ? " Voided and refunded entries are shown for history." : ""}</p>{["bookings", "payments"].includes(category) ? <Link id={`reports-${category}-register`} className="inline-flex min-h-11 items-center text-sm underline" href={category === "payments" ? "/dashboard/payments" : member.industry === "hospitality" ? "/dashboard/hospitality/bookings" : "/dashboard/appointments"}>View full {`${category} register`}</Link> : null}</section>;
}

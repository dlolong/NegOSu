import { notFound } from "next/navigation";
import { z } from "zod";
import { hospitalityContext } from "@/modules/hospitality/runtime";
import { canHospitality } from "@/modules/hospitality/contracts";
import { checkInReceiptAmounts } from "@/modules/hospitality/check-in-receipt";
import { CheckInReceipt } from "@/components/hospitality/check-in-receipt";
import { LoadError, dateLabel } from "@/components/hospitality/shared";

export default async function CustomerReceipt({ params }: { params: Promise<{ stayId: string }> }) {
  const [{ stayId }, { db, activeMembership: m }] = await Promise.all([params, hospitalityContext()]);
  if (!canHospitality(m.role, "financeRead") || !z.uuid().safeParse(stayId).success) notFound();
  // User-session client preserves RLS and assigned branch restrictions for every read.
  const stay = await db.from("hospitality_stays").select("branch_id,guest_name_snapshot,room_name_snapshot,checked_in_at,request_key").eq("organization_id", m.organizationId).eq("id", stayId).single();
  if (!stay.data) notFound();
  const link = await db.from("hospitality_stay_bills").select("invoice_id,rate_snapshot,check_in_request").eq("organization_id", m.organizationId).eq("branch_id", stay.data.branch_id).eq("stay_id", stayId).single();
  if (!link.data) return <LoadError>Check-in receipt is unavailable. View the stay statement for this booking.</LoadError>;
  const amounts = checkInReceiptAmounts(link.data.rate_snapshot, link.data.check_in_request);
  if (!amounts) return <LoadError>The original check-in amounts are unavailable. View the stay statement for this booking.</LoadError>;
  const [bill, branch, staff, payment] = await Promise.all([
    db.from("invoices").select("invoice_number,status").eq("organization_id", m.organizationId).eq("branch_id", stay.data.branch_id).eq("id", link.data.invoice_id).single(),
    db.from("branches").select("name,timezone").eq("organization_id", m.organizationId).eq("id", stay.data.branch_id).single(),
    db.from("hospitality_stay_staff_events").select("cashier_name").eq("organization_id", m.organizationId).eq("branch_id", stay.data.branch_id).eq("stay_id", stayId).eq("phase", "check_in").maybeSingle(),
    db.from("payments").select("receipt_number,status,amount_centavos").eq("organization_id", m.organizationId).eq("branch_id", stay.data.branch_id).eq("invoice_id", link.data.invoice_id).eq("invoice_idempotency_key", stay.data.request_key).maybeSingle(),
  ]);
  if (bill.error || branch.error || staff.error || payment.error || !bill.data || !branch.data || (amounts.payment > 0 && (!payment.data || payment.data.amount_centavos !== amounts.payment))) return <LoadError>Receipt information could not be verified. Please try again.</LoadError>;
  const periodEnd = new Date(new Date(stay.data.checked_in_at).getTime() + amounts.durationMinutes * 60000).toISOString();
  return <CheckInReceipt stayId={stayId} organization={m.organizationName} branch={branch.data.name} guest={stay.data.guest_name_snapshot} room={stay.data.room_name_snapshot} checkIn={dateLabel(stay.data.checked_in_at, branch.data.timezone)} periodEnd={dateLabel(periodEnd, branch.data.timezone)} number={payment.data?.receipt_number || bill.data.invoice_number} cashier={staff.data?.cashier_name ?? null} amounts={amounts} warning={bill.data.status === "void" ? "VOID — original transaction" : payment.data && payment.data.status !== "paid" ? `Payment ${payment.data.status} — original transaction` : undefined}/>;
}

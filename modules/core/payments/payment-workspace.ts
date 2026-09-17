import type { SupabaseClient } from "@supabase/supabase-js";

export type LedgerPayment = { id: string; invoice_id: string | null; appointment_id: string | null; amount_centavos: number; currency?: string; method: string; status: string; reference: string | null; paid_at: string | null };
export type PaymentDocument = { id: string; kind: "invoice" | "appointment"; label: string; customer: string; date: string | null; total: number; balance: number };
type Invoice = { id: string; invoice_number: string; customer_name_snapshot: string; issued_at: string | null; total_centavos: number; balance_centavos: number; status: string };
type Appointment = { id: string; starts_at: string; expected_total_centavos: number; status: string; customers: { full_name: string } | null };

/** Read every page, failing closed rather than presenting partial financial totals. */
export async function readAllFinancialRows<T>(fetch: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await fetch(from, from + 999);
    if (page.error || !Array.isArray(page.data)) throw new Error("Unable to load payment records.", { cause: page.error });
    result.push(...page.data as T[]);
    if (page.data.length < 1000) return result;
  }
}

export async function loadPaymentWorkspace(db: SupabaseClient, organizationId: string, branchId: string, kind: PaymentDocument["kind"]) {
  const [payments, invoices, appointments] = await Promise.all([
    readAllFinancialRows<LedgerPayment>((from, to) => db.from("payments").select("id,invoice_id,appointment_id,amount_centavos,currency,method,status,reference,paid_at").eq("organization_id", organizationId).eq("branch_id", branchId).order("id").range(from, to)),
    kind === "invoice" ? readAllFinancialRows<Invoice>((from, to) => db.from("invoices").select("id,invoice_number,customer_name_snapshot,issued_at,total_centavos,balance_centavos,status").eq("organization_id", organizationId).eq("branch_id", branchId).order("id").range(from, to)) : Promise.resolve([]),
    kind === "appointment" ? readAllFinancialRows<Appointment>((from, to) => db.from("appointments").select("id,starts_at,expected_total_centavos,status,customers(full_name)").eq("organization_id", organizationId).eq("branch_id", branchId).order("id").range(from, to)) : Promise.resolve([]),
  ]);
  const paid = new Map<string, number>();
  for (const payment of payments) if (payment.status === "paid" && payment.appointment_id) paid.set(payment.appointment_id, (paid.get(payment.appointment_id) ?? 0) + Number(payment.amount_centavos));
  const documents: PaymentDocument[] = [
    ...invoices.filter(row => row.status !== "void").map(row => ({ id: row.id, kind: "invoice" as const, label: row.invoice_number, customer: row.customer_name_snapshot, date: row.issued_at, total: Number(row.total_centavos), balance: Number(row.balance_centavos) })),
    ...appointments.filter(row => !["cancelled", "no_show"].includes(row.status)).map(row => ({ id: row.id, kind: "appointment" as const, label: "Appointment", customer: row.customers?.full_name ?? "Customer", date: row.starts_at, total: Number(row.expected_total_centavos), balance: Math.max(0, Number(row.expected_total_centavos) - (paid.get(row.id) ?? 0)) })),
  ];
  return { payments, documents };
}

export function summarizePayments(payments: LedgerPayment[], documents: PaymentDocument[], timezone: string, now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  const today = date.format(now);
  const collected = payments.filter(row => row.status === "paid" && row.paid_at && date.format(new Date(row.paid_at)) === today);
  const byMethod = new Map<string, number>();
  for (const payment of collected) byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + Number(payment.amount_centavos));
  return { collected: collected.reduce((sum, row) => sum + Number(row.amount_centavos), 0), count: collected.length, outstanding: documents.reduce((sum, row) => sum + row.balance, 0), byMethod: [...byMethod] };
}

/** Historical receipts retain their recorded denomination; never add different currencies. */
export function collectionsByCurrency(payments: LedgerPayment[], timezone: string, fallbackCurrency: string, now = new Date()) {
  const groups = new Map<string, LedgerPayment[]>();
  for (const payment of payments) {
    const currency = payment.currency ?? fallbackCurrency;
    const rows = groups.get(currency) ?? [];
    rows.push(payment);
    groups.set(currency, rows);
  }
  if (!groups.size) groups.set(fallbackCurrency, []);
  return [...groups].map(([currency, rows]) => ({ currency, ...summarizePayments(rows, [], timezone, now) }));
}

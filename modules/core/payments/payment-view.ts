import type { LedgerPayment, PaymentDocument } from "./payment-workspace";

export type PaymentQuery = { tab?: string | string[]; q?: string | string[]; page?: string | string[]; outstandingPage?: string | string[] };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
export type PaymentTab = "outstanding" | "history";
export const paymentPageSize = 25;

export function paymentView(payments: LedgerPayment[], documents: PaymentDocument[], query: PaymentQuery) {
  const selectedTab = first(query.tab);
  const requestedPage = first(query.page);
  const outstandingPage = first(query.outstandingPage);
  const tab: PaymentTab = selectedTab === "history" || (!selectedTab && requestedPage && !outstandingPage) ? "history" : "outstanding";
  const search = (first(query.q) ?? "").trim().slice(0, 120);
  const needle = search.toLocaleLowerCase();
  const documentById = new Map(documents.map(document => [document.id, document]));
  const matches = (...values: (string | null | undefined)[]) => values.some(value => value?.toLocaleLowerCase().includes(needle));
  const outstanding = documents.filter(row => row.balance > 0);
  const outstandingRows = outstanding.filter(row => !needle || matches(row.customer, row.label, row.date)).sort((a,b) => (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id));
  const historyRows = payments.filter(row => {
    const document = documentById.get(row.invoice_id ?? row.appointment_id ?? "");
    return !needle || matches(document?.customer, document?.label, row.reference, row.method.replaceAll("_", " "), row.status);
  }).sort((a,b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? "") || a.id.localeCompare(b.id));
  const count = tab === "history" ? historyRows.length : outstandingRows.length;
  const requested = Number.parseInt(tab === "outstanding" ? outstandingPage ?? requestedPage ?? "1" : requestedPage ?? "1", 10);
  const pages = Math.max(1, Math.ceil(count/paymentPageSize));
  const page = Math.max(1, Math.min(pages, requested || 1));
  const offset = (page-1)*paymentPageSize;
  return { tab, search, page, pages, count, offset, outstandingCount: outstanding.length, historyCount: payments.length, documentById, outstanding: outstandingRows.slice(offset,offset+paymentPageSize), history: historyRows.slice(offset,offset+paymentPageSize) };
}

export function paymentViewHref(base: string, tab: PaymentTab, search = "", page = 1) {
  const query = new URLSearchParams({tab});
  if (search) query.set("q",search);
  if (page > 1) query.set("page",String(page));
  return `${base}?${query}`;
}

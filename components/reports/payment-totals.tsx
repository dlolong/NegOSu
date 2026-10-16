import { formatMoney } from "@/lib/operations";
export function PaymentTotals({sales,currency,note}:{sales:number;revenue:number;currency:string;note?:string}) {
 return <div id="reports-payment-totals" className="space-y-2"><dl className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-xl border border-admin-border bg-admin-surface p-4"><dt className="text-sm text-admin-text-secondary">Total amount</dt><dd id="reports-total-sales" className="mt-1 text-xl font-semibold">{formatMoney(sales,currency)}</dd></div></dl><p className="text-xs text-admin-text-secondary">{note??"Total amount covers completed services and posted bills in the selected period."}</p></div>;
}

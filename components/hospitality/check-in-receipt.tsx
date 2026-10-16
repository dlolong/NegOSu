"use client";
import { useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/operations";
import type { CheckInReceiptAmounts } from "@/modules/hospitality/check-in-receipt";

export function CheckInReceipt({ stayId, organization, branch, guest, room, checkIn, periodEnd, number, cashier, amounts, warning }: {
  stayId: string; organization: string; branch: string; guest: string; room: string; checkIn: string; periodEnd: string; number: string; cashier: string | null; amounts: CheckInReceiptAmounts; warning?: string;
}) {
  const [width, setWidth] = useState("80");
  const money = (amount: number) => formatMoney(amount, amounts.currency);
  return <main id="hospitality-check-in-receipt" className="mx-auto max-w-xl space-y-4">
    <div className="space-y-3 print:hidden">
      <h1 className="text-2xl font-semibold">Check-in receipt</h1>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="hospitality-receipt-paper" className="text-sm">Paper width</label>
        <select id="hospitality-receipt-paper" value={width} onChange={e => setWidth(e.target.value)} className="min-h-11 rounded-lg border px-3"><option value="80">80 mm</option><option value="58">58 mm</option></select>
        <Button id="hospitality-print-customer-receipt" onClick={() => window.print()}><Printer size={16}/>Print customer copy</Button>
        <Button asChild variant="secondary"><Link id="hospitality-receipt-back-stay" href={`/dashboard/hospitality/stays/${stayId}`}>View stay</Link></Button>
      </div>
      <p className="text-sm text-slate-500">Select your thermal printer and matching paper size in the print dialog. Use 100% scale and turn off headers and footers.</p>
    </div>
    <style>{`@media print { @page { size: auto; margin: 0; } #hospitality-check-in-receipt { margin: 0 !important; } }`}</style>
    <article id="hospitality-customer-copy" style={{ width: `${Number(width) - 8}mm` }} className="mx-auto max-w-full break-words bg-white p-2 font-mono text-xs leading-relaxed text-black print:mx-0">
      <header className="border-b border-dashed border-black pb-3 text-center"><h2 className="text-base font-bold">{organization}</h2><p>{branch}</p><p className="mt-2 font-bold">CHECK-IN RECEIPT</p><p>Customer copy</p><p className="mt-1 break-all">{number}</p></header>
      {warning ? <p role="alert" className="border-b border-dashed border-black py-2 font-bold">{warning}</p> : null}
      <div className="space-y-1 border-b border-dashed border-black py-3"><p>Guest: {guest}</p><p>Room: {room}</p><p>Check-in: {checkIn}</p><p>Stay period: {amounts.label}</p><p>Original paid period ends: {periodEnd}</p>{cashier ? <p>Cashier: {cashier}</p> : null}</div>
      <dl className="space-y-2 border-b border-dashed border-black py-3">
        {[["Room payment", amounts.payment], ["Refundable deposit", amounts.deposit], ["Total received", amounts.total], [amounts.method === "cash" ? "Cash tendered" : "Amount tendered", amounts.tendered], ["Change", amounts.change]].map(([label, amount]) => <div key={label} className="flex flex-wrap justify-between gap-x-2"><dt>{label}</dt><dd className="ml-auto text-right font-bold">{money(Number(amount))}</dd></div>)}
      </dl>
      <div className="space-y-1 py-3"><p>Method: {amounts.method.replaceAll("_", " ")}</p>{amounts.reference ? <p>Reference: {amounts.reference}</p> : null}{amounts.receipt ? <p>Paper receipt: {amounts.receipt}</p> : null}</div>
      <footer className="text-center"><p>Deposit is refundable and is separate from room payment.</p><p className="mt-2">Original check-in transaction only.</p><p className="mt-2">Thank you for staying with us!</p></footer>
    </article>
  </main>;
}

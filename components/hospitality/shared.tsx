import Link from "next/link";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { FormActions } from "@/components/form-actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
export const fieldClass = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal";
export function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) { return <label className={`block min-w-0 text-sm ${full ? "sm:col-span-2" : ""}`}>{label}{children}</label>; }
export function SaveActions({ id, label, closeHref }: { id: string; label: string; closeHref: string }) { return <FormActions id={`${id}-actions`} cancelHref={closeHref}><SubmitButton id={`${id}-submit`} pendingText="Saving…"><Save size={16} aria-hidden="true"/>{label}</SubmitButton></FormActions>; }
export function PageLinks({ page, count, href }: { page: number; count: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(count / 50));
  return <nav aria-label="Record pages" className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{count} records · Page {page} of {pages}</span><div className="flex gap-2">{page > 1 ? <Button asChild variant="secondary" size="sm"><Link href={href(page - 1)}><ArrowLeft size={16}/>Previous</Link></Button> : null}{page < pages ? <Button asChild variant="secondary" size="sm"><Link href={href(page + 1)}><ArrowRight size={16}/>Next</Link></Button> : null}</div></nav>;
}
export function dateLabel(value: string | null, timeZone: string) { return value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value)) : "In house"; }
export function pageNumber(value?: string) { return Math.max(1, Math.min(100000, Math.trunc(Number(value) || 1))); }
export function LoadError({ children = "Unable to load these records. Refresh to try again." }: { children?: ReactNode }) { return <p role="alert" className="my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{children}</p>; }

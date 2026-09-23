"use client";

import { useActionState } from "react";
import Link from "next/link";
import { mutatePlatformRecord } from "@/app/admin/actions";
import { FormDialog } from "@/components/management-ui";
import { SubmitButton } from "@/components/submit-button";
import type { AdminRow, AdminSection } from "@/modules/platform/admin-reader";

export function PlatformAdminForm({ section, row, plans, requestId, closeHref }: {
  section: AdminSection; row: AdminRow; plans: { id: string; name: string }[]; requestId: string; closeHref: string;
}) {
  const [state, action] = useActionState(mutatePlatformRecord, {});
  const deleting = section === "signups" || section === "businesses";
  const target = String(section === "subscriptions" ? row.organization_id : row.id);
  const operation = section === "signups" ? "delete_user" : section === "businesses" ? "delete_business" : section === "plans" ? "update_plan" : "update_subscription";
  const title = section === "signups" ? "Delete user" : section === "businesses" ? "Delete business" : section === "plans" ? "Edit plan" : "Update subscription";
  const field = "mt-1 block min-h-11 w-full rounded-lg border border-admin-border bg-admin-surface px-3 py-2 text-sm";
  const price = (value: unknown) => value == null ? "" : (Number(value) / 100).toFixed(2);
  return <FormDialog id="platform-admin-edit-dialog" title={title} closeHref={closeHref} size="md">
    {state.success ? <div id="platform-admin-save-success" role="status"><p className="text-sm">{deleting ? "Record deleted." : "Changes saved."}</p><Link id="platform-admin-save-close" href={closeHref} className="mt-4 inline-block rounded-lg bg-brand-primary px-4 py-2 text-sm text-white">Back to directory</Link></div> : <form id="platform-admin-edit-form" action={action} className="space-y-4">
      <input type="hidden" name="action" value={operation}/><input type="hidden" name="target" value={target}/><input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="expected" value={String(section === "plans" ? row.admin_revision : row.updated_at ?? "")}/>
      <p className="break-words text-sm font-medium">{String(row.name ?? row.email ?? target)}</p>
      {state.error ? <p id="platform-admin-edit-error" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
      {deleting ? <><p className="text-sm text-admin-text-secondary">{section === "businesses" ? "This permanently deletes the business and its dependent workspace data. User login accounts remain. Businesses with billing, invoice, payment, or stay records cannot be deleted here." : "This permanently deletes the login account and its memberships. The last active owner of a business cannot be deleted. Referenced business or storage history may also prevent deletion."}</p><label className="block text-sm">Type <strong className="break-all">DELETE {target}</strong><input id="admin-delete-confirmation" name="confirmation" className={field} required autoComplete="off"/></label></> : null}
      {section === "plans" ? <><label className="block text-sm">Plan name<input id="admin-plan-name" name="name" className={field} defaultValue={String(row.name)} minLength={2} maxLength={80} required/></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Monthly price · PHP<input id="admin-plan-monthly" name="monthly" type="number" min="0" max="10000000" step="0.01" className={field} defaultValue={price(row.monthly_price_centavos)} required/></label><label className="block text-sm">Yearly price · PHP<input id="admin-plan-yearly" name="yearly" type="number" min="0" max="10000000" step="0.01" className={field} defaultValue={price(row.yearly_price_centavos)}/></label></div><p className="text-xs text-admin-text-secondary">Leave yearly blank if unavailable. Free must remain zero. New checkouts use the new price; existing orders retain their quoted amount. Stripe-linked price changes must be made through Stripe.</p></> : null}
      {section === "subscriptions" ? <><label className="block text-sm">Plan<select id="admin-subscription-plan" name="planId" className={field} defaultValue={String(row.plan_id)} required>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><label className="block text-sm">Access status<select id="admin-subscription-status" name="status" className={field} defaultValue={["free", "active", "paused", "cancelled"].includes(String(row.status)) ? String(row.status) : "paused"}><option value="free">Free</option><option value="active">Active paid/custom access</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option></select></label><label className="block text-sm">Access expires · UTC<input id="admin-subscription-expiry" name="expiresAt" type="datetime-local" className={field} defaultValue={row.current_period_end ? new Date(String(row.current_period_end)).toISOString().slice(0,16) : ""}/></label><p className="text-xs text-admin-text-secondary">Active access requires a future expiry. This changes access without charging or refunding money. Existing prepaid payment value is preserved. Open/review payments must be resolved first. Stripe subscriptions must be managed through Stripe. Manual grants cannot be renewed through PayMongo until they expire.</p></> : null}
      <label className="block text-sm">Reason<textarea id="admin-change-reason" name="reason" className={field} minLength={5} maxLength={500} required rows={2}/></label>
      <div className="flex flex-wrap justify-end gap-3"><Link id="admin-change-cancel" href={closeHref} className="px-3 py-2 text-sm underline">Cancel</Link><SubmitButton id="admin-change-submit" pendingText="Saving…" variant={deleting ? "destructive" : "primary"}>{deleting ? "Permanently delete" : "Save changes"}</SubmitButton></div>
    </form>}
  </FormDialog>;
}

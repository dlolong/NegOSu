import { PlanUpgradeNotice } from "@/components/plan-upgrade";
import { planErrorCapability } from "@/lib/billing/plan-errors";

export function FormMessage({ error, message, id }: { error?: string; message?: string; id?: string }) {
  if (!error && !message) return null;
  const capability = error ? planErrorCapability(error) : undefined;
  return <div id={id} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"} className={`mt-4 rounded-ui-md border px-4 py-3 text-sm ${error ? "border-red-200 bg-status-danger-tint text-status-danger" : "border-emerald-200 bg-status-success-tint text-status-success"}`}>{error ?? message}{capability ? <div className="mt-3"><PlanUpgradeNotice id={`${id ?? "form"}-plan-upgrade`} capability={capability} limitReached/></div> : null}</div>;
}

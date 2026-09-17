import type { UpgradeCapability } from "@/modules/platform/plan-upgrades";

// Exact allowlist: never turn arbitrary database or authorization errors into upsells.
const planErrors: Record<string, { capability: UpgradeCapability; message: string }> = {
  "Branch limit reached": { capability: "branches", message: "Your plan’s active branch limit has been reached." },
  "Staff limit reached": { capability: "staff", message: "Your plan’s staff login limit has been reached." },
  "Monthly job limit reached": { capability: "monthly_jobs", message: "Your plan’s monthly job limit has been reached." },
  "Public page requires an eligible plan": { capability: "public_page", message: "Publishing your public website requires a higher plan." },
  "Reminders require an eligible plan": { capability: "reminders", message: "Maintenance reminders require a higher plan." },
};

export function planErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("message" in error) || typeof error.message !== "string") return undefined;
  return Object.hasOwn(planErrors, error.message) ? planErrors[error.message].message : undefined;
}

export function planErrorCapability(message: string): UpgradeCapability | undefined {
  return Object.values(planErrors).find(error => error.message === message)?.capability;
}

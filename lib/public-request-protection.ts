import { createHash } from "node:crypto";

// Headers must be overwritten by the deployment's trusted reverse proxy.
// Do not include user-agent: changing browser details must not reset a limit.
export function publicRequestRateKey(forwardedFor: string | null) {
  return createHash("sha256").update(forwardedFor?.split(",")[0]?.trim() || "unknown-client").digest("hex");
}

export function publicBookingProtectionError(error: { code?: string; message?: string }) {
  if (error.code === "P0409" || error.message === "A similar booking request is already pending") {
    return "A similar booking request is already pending. Please wait for confirmation or contact the business to make changes.";
  }
  if (error.code === "54000" || error.message === "Too many booking requests") {
    return "Too many requests. Please try again later or contact the business.";
  }
  return null;
}

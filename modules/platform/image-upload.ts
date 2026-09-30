export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export function imageFileType(bytes: Uint8Array): { extension: string; mime: string } | null {
  if (bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES) return null;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: "jpg", mime: "image/jpeg" };
  if ([137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value)) return { extension: "png", mime: "image/png" };
  if (String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return { extension: "webp", mime: "image/webp" };
  return null;
}
export function imageUploadAllowed(entitlements: unknown) {
  const ent = entitlements as { features?: { image_uploads?: boolean }; limits?: { storage_mb?: number } } | null;
  return ent?.features?.image_uploads === true && typeof ent.limits?.storage_mb === "number" && Number.isSafeInteger(ent.limits.storage_mb) && (ent.limits.storage_mb === -1 || ent.limits.storage_mb > 0);
}

export const IMAGE_UPLOAD_UNAVAILABLE = "Image uploads are not configured for this business yet. Contact support to enable them; you do not need to purchase another plan.";

/** Only an effective Free plan should be directed to upgrade. Missing paid-plan
 * configuration fails closed and must be repaired in the database. */
export function imageUploadAccess(entitlements: unknown): "allowed" | "upgrade" | "unavailable" {
  const ent = entitlements as { planId?: string } | null;
  if (ent?.planId === "free") return "upgrade";
  if (imageUploadAllowed(entitlements)) return "allowed";
  return "unavailable";
}

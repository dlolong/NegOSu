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
  return ent?.features?.image_uploads === true && typeof ent.limits?.storage_mb === "number" && (ent.limits.storage_mb === -1 || ent.limits.storage_mb > 0);
}

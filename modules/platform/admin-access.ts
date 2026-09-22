import { z } from "zod";

/** Deployment-controlled IDs only; never use editable user metadata or tenant roles. */
export function isPlatformAdmin(userId: string | undefined, configuredIds: string | undefined): boolean {
  if (!userId || !z.uuid().safeParse(userId).success) return false;
  const ids = (configuredIds ?? "").split(",").map(value => value.trim()).filter(Boolean);
  if (!ids.length || ids.some(id => !z.uuid().safeParse(id).success)) return false;
  return ids.some(id => id.toLowerCase() === userId.toLowerCase());
}

export function adminPageNumber(value: unknown): number {
  return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
}

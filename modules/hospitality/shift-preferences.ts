import { z } from "zod";

export type ShiftPreferenceScope = { userId: string; organizationId: string; branchId: string };
export type ShiftPreferences = { cashierStaffId: string; housekeeperStaffId: string };
export function shiftPreferenceKey(scope: ShiftPreferenceScope) {
  return `negosu:shift-staff:v1:${scope.userId}:${scope.organizationId}:${scope.branchId}`;
}
export function availableShiftPreferences(raw: string, availableIds: readonly string[]): ShiftPreferences {
  const empty = { cashierStaffId: "", housekeeperStaffId: "" };
  try {
    const data: unknown = JSON.parse(raw);
    const parsed = z.object({ cashierStaffId: z.string(), housekeeperStaffId: z.string() }).safeParse(data);
    if (!parsed.success) return empty;
    const allowed = new Set(availableIds);
    const valid = (id: string) => z.uuid().safeParse(id).success && allowed.has(id) ? id : "";
    return { cashierStaffId: valid(parsed.data.cashierStaffId), housekeeperStaffId: valid(parsed.data.housekeeperStaffId) };
  } catch { return empty; }
}

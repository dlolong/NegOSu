import { reportQuerySchema, resolveReportScope } from "@/lib/reporting";

/** Hospitality Free filters expose only rolling presets; paid plans unlock custom dates. */
export function resolveHospitalityReportScope(
  filters: Parameters<typeof resolveReportScope>[0],
  membership: Parameters<typeof resolveReportScope>[1],
  advanced: boolean,
  mode: "report" | "payments" | "history",
  now = new Date(),
) {
  const preset = filters.preset === "month" || (!advanced && filters.preset === "custom") ? "30d" : filters.preset;
  const effective = reportQuerySchema.parse({
    ...filters, preset,
    ...(!advanced ? { start: undefined, end: undefined } : {}),
    branch: advanced && mode === "report" ? filters.branch : membership.branchId,
  });
  return resolveReportScope(effective, membership, true, now);
}

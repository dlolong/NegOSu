import { reportQuerySchema, resolveReportScope } from "@/lib/reporting";

/** Recent dates remain available on Free; database authorization bounds the period. */
export function resolveHospitalityReportScope(
  filters: Parameters<typeof resolveReportScope>[0],
  membership: Parameters<typeof resolveReportScope>[1],
  advanced: boolean,
  mode: "report" | "payments" | "history",
  now = new Date(),
) {

  const effective = reportQuerySchema.parse({
    ...filters,
    branch: advanced && mode === "report" ? filters.branch : membership.branchId,
  });
  return resolveReportScope(effective, membership, advanced, now);
}

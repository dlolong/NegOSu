type ErrorLike = {
  name?: string;
  code?: string;
  message?: string;
  cause?: unknown;
};

const controlledDomainErrors = new Set([
  "AutomotiveJobPartsError",
  "AutomotiveSchedulingError",
  "AutomotiveWorkExecutionError",
  "AutomotiveWorkTrackingError",
  "EstimateApprovalError",
  "IndustryAccessError",
  "InventoryReservationError",
  "SchedulingError",
  "StaffProfileError",
]);

const unsafeMessagePatterns = [
  /\bselect\b.+\bfrom\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\b.+\bset\b/i,
  /\bdelete\s+from\b/i,
  /\bpostgres(?:ql)?\b/i,
  /\bpostgrest\b/i,
  /\bsupabase\b/i,
  /\brow-level security\b/i,
  /\bschema cache\b/i,
  /\b(?:PGRST|SQLSTATE)\d+/i,
  /\bpublic\.[a-z_]+/i,
  /\b(?:function|column|relation)\s+["'][^"']+["']/i,
];

function errorLike(error: unknown): ErrorLike {
  return typeof error === "object" && error !== null ? error as ErrorLike : {};
}

function diagnosticCode(error: unknown) {
  const direct = errorLike(error);
  if (typeof direct.code === "string") return direct.code;
  const cause = errorLike(direct.cause);
  return typeof cause.code === "string" ? cause.code : undefined;
}

/** Only SQL identifier diagnostics are allowed; never log error detail/failing rows. */
function schemaDiagnostic(error: unknown) {
  const direct = errorLike(error), database = direct.code ? direct : errorLike(direct.cause);
  if (database.code !== "42703" || typeof database.message !== "string") return undefined;
  const column = database.message.match(/^column ([a-zA-Z0-9_."]+) (?:of relation "[a-zA-Z0-9_]+" )?does not exist$/);
  if (column) return `missing column ${column[1]}`;
  const field = database.message.match(/^record "([a-zA-Z0-9_]+)" has no field "([a-zA-Z0-9_]+)"$/);
  return field ? `missing field ${field[1]}.${field[2]}` : "missing database column";
}

export function isControlledUserFacingError(error: unknown): error is Error {
  return error instanceof Error
    && controlledDomainErrors.has(error.name)
    && error.message.length > 0
    && error.message.length <= 300
    && !unsafeMessagePatterns.some((pattern) => pattern.test(error.message));
}

export function normalizeActionError(error: unknown, fallback: string) {
  return isControlledUserFacingError(error) ? error.message : fallback;
}

/** Logs searchable, non-sensitive context and returns a customer-safe message. */
export function reportActionError(operation: string, error: unknown, fallback: string) {
  const details = errorLike(error);
  console.error("server_action.failure", JSON.stringify({
    operation,
    category: typeof details.name === "string" ? details.name : "UnknownError",
    code: diagnosticCode(error),
    schema: schemaDiagnostic(error),
    validation: isControlledUserFacingError(error) && error.name === "SchedulingError" ? (
      /operating hours|outside branch hours/i.test(error.message) ? "branch_hours" :
      /overlap|already booked|busy|fully booked|capacity/i.test(error.message) ? "schedule_conflict" :
      /UUID|valid.*id/i.test(error.message) ? "invalid_selection" :
      /branch/i.test(error.message) ? "branch_access_or_availability" :
      /service/i.test(error.message) ? "service_availability" :
      /customer|owner|pet/i.test(error.message) ? "customer_or_pet_availability" : "scheduling_validation"
    ) : undefined,
  }));
  return normalizeActionError(error, fallback);
}


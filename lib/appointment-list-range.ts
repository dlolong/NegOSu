import { appointmentAgendaRange } from "@/lib/operations";
import { listingDate } from "@/lib/listing-query";

/** Calendar dates are interpreted in the branch timezone, including DST. */
export function appointmentListRange(query: { from?: string; to?: string; date?: string; view?: string }, timezone: string, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const previous = new Date(`${today}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 30);
  const view = query.view === "day" || query.view === "week" ? query.view : "recent";
  const legacy = !query.from && !query.to && (view !== "recent" || Boolean(query.date));
  const from = query.from || (legacy ? query.date || today : previous.toISOString().slice(0,10));
  const legacyRange = legacy ? appointmentAgendaRange(query.date || today, view === "week" ? 7 : 1, timezone) : null;
  const to = query.to || (legacyRange ? new Intl.DateTimeFormat("en-CA", {timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(legacyRange.end.getTime()-1)) : "");
  if (!listingDate(from) || (to && (!listingDate(to) || to < from))) return null;
  const start = appointmentAgendaRange(from, 1, timezone)?.start;
  const end = to ? appointmentAgendaRange(to, 1, timezone)?.end : legacyRange?.end;
  return start ? { from, to, start, end, view } : null;
}

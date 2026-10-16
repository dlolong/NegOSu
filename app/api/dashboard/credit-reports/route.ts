import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { creditErrorMessage, creditReportCsv, creditReportRequestSchema, type CreditSnapshot } from "@/modules/platform/trial-credits";

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: Request) {
  const { activeMembership: member } = await getDashboardContext();
  const db = await createClient();
  const params = new URL(request.url).searchParams;
  const id = z.uuid().safeParse(params.get("id"));
  if (!id.success) return reply({ error: "Choose a saved report." }, 400);
  const { data, error } = await db.rpc("read_credit_report", { p_org: member.organizationId, p_request: id.data });
  if (error || !data) return reply({ error: creditErrorMessage(error?.code) }, 403);
  const snapshot = data as CreditSnapshot;
  if (params.get("download") === "1") {
    const entitlement = await db.rpc("get_org_entitlements", { p_organization_id: member.organizationId });
    if (entitlement.error || entitlement.data?.features?.advanced_reports !== true) return reply({error:"CSV export requires an eligible plan.",code:"FEATURE_NOT_ENTITLED"},403);
    if (snapshot.payload.action !== "csv_export") return reply({ error: "Use Export CSV to prepare a download." }, 403);
    return new Response(creditReportCsv(snapshot), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="negosu-${snapshot.payload.kind}-${snapshot.payload.start}-${snapshot.payload.end}.csv"`, "Cache-Control": "private, no-store" } });
  }
  return reply(snapshot);
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid request origin." }, 403);
  // Bound streamed JSON rather than trusting Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Invalid report request." }, 400);
  let text = ""; let bytes = 0; const decoder = new TextDecoder();
  while (true) {
    const next = await reader.read(); if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > 4096) { await reader.cancel(); return reply({ error: "Report filters are too large." }, 413); }
    text += decoder.decode(next.value, { stream: true });
  }
  text += decoder.decode();
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return reply({ error: "Invalid report request." }, 400); }
  const input = creditReportRequestSchema.safeParse(raw);
  if (!input.success) return reply({ error: "Choose valid filters and dates covering up to 732 days." }, 400);
  const { activeMembership: member } = await getDashboardContext();
  const db = await createClient();
  const { data, error } = await db.rpc("generate_credit_report", { p_org: member.organizationId, p_request: input.data.requestId, p_payload: input.data.payload });
  if (error || !data) return reply({ error: creditErrorMessage(error?.code) }, error?.code === "42501" ? 403 : 400);
  if (data.code === "INSUFFICIENT_CREDITS") return reply({error:"Not enough business credits to prepare this report. See notifications for plan options.",code:"INSUFFICIENT_CREDITS"},402);
  if (data.code === "FEATURE_NOT_ENTITLED") return reply({error:"Advanced reports require a plan that includes this feature.",code:"FEATURE_NOT_ENTITLED"},403);
  return reply(data);
}

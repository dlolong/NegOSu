import "server-only";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import type { HospitalityWorkspace } from "./contracts";
export async function hospitalityContext() {
  const context = await getDashboardContext();
  if (context.activeMembership.industry !== "hospitality") notFound();
  return { ...context, db: await createClient() };
}
export async function loadHospitalityWorkspace(input: { branch: string | null; start: string; end: string; section: string; page?: number; mode: "report" | "overview" | "payments" | "history" }) {
  const { db, activeMembership } = await hospitalityContext();
  const { data, error } = await db.rpc("get_hospitality_workspace", { p_org: activeMembership.organizationId, p_branch: input.branch, p_start: input.start, p_end: input.end, p_section: input.section, p_page: input.page ?? 1, p_mode: input.mode });
  if (error) throw new Error("Unable to load hospitality workspace", { cause: error });
  return data as HospitalityWorkspace;
}

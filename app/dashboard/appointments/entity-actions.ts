"use server";

import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createVisitCustomer, createVisitVehicle } from "@/lib/visit-entities";

export async function createAppointmentCustomer(input: unknown) {
  const { activeMembership } = await getDashboardContext();
  return createVisitCustomer(input, activeMembership, await createClient());
}

export async function createAppointmentVehicle(input: unknown) {
  const { activeMembership } = await getDashboardContext();
  return createVisitVehicle(input, activeMembership, await createClient());
}

export async function lookupRecords(input: unknown) {
  const { activeMembership } = await getDashboardContext();
  const { searchRecords } = await import("@/lib/record-lookup");
  return searchRecords(input, activeMembership, await createClient());
}
export async function createAppointmentCategory(input: unknown) {
  const { activeMembership } = await getDashboardContext();
  const { createQuickCategory } = await import("@/lib/quick-catalog");
  return createQuickCategory(input, activeMembership, await createClient());
}
export async function createAppointmentService(input: unknown) {
  const { activeMembership } = await getDashboardContext();
  const { createQuickService } = await import("@/lib/quick-catalog");
  return createQuickService(input, activeMembership, await createClient());
}

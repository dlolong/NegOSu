import { getDashboardContext } from "@/lib/auth/context";
import type { PaymentQuery } from "@/modules/core/payments/payment-view";
import { PaymentWorkspace } from "@/components/payment-workspace";
export default async function Page({searchParams}:{searchParams:Promise<PaymentQuery>}) {
  const { activeMembership } = await getDashboardContext();
  if (activeMembership.industry === "hospitality") { const { HospitalityReport } = await import("@/components/hospitality/report"); return <HospitalityReport query={Object.fromEntries(Object.entries(await searchParams).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []))} mode="payments"/>; }
  return <PaymentWorkspace query={await searchParams}/>;
}

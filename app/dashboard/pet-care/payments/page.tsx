import type { PaymentQuery } from "@/modules/core/payments/payment-view";
import { PaymentWorkspace } from "@/components/payment-workspace";
export default async function Page({searchParams}:{searchParams:Promise<PaymentQuery>}) {
  return <PaymentWorkspace query={await searchParams} legacyPet/>;
}

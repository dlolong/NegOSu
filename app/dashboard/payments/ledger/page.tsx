import {PaymentWorkspace} from "@/components/payment-workspace";
import type {PaymentQuery} from "@/modules/core/payments/payment-view";
export default async function Page({searchParams}:{searchParams:Promise<PaymentQuery>}){return <PaymentWorkspace query={await searchParams} allBills/>;}

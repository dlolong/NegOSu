import { loadPaymentWorkspace, summarizePayments } from "@/modules/core/payments/payment-workspace";
import Link from "next/link";
import { Calendar, PawPrint, ArrowRight, Plus } from "lucide-react";
import { petContext } from "@/modules/pet-care/runtime";
import { PageHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { groomingStatus } from "@/modules/pet-care/pets";
import { zonedDateTimeToUtc, formatMoney } from "@/lib/operations";
export default async function Page() {
 const { db, activeMembership, enabled, branchTimezone }=await petContext();
 const day=new Intl.DateTimeFormat("en-CA",{timeZone:branchTimezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const start=zonedDateTimeToUtc(`${day}T00:00`,branchTimezone)!;
 const nextDay=new Date(`${day}T12:00:00Z`); nextDay.setUTCDate(nextDay.getUTCDate()+1);
 const end=zonedDateTimeToUtc(`${nextDay.toISOString().slice(0,10)}T00:00`,branchTimezone)!;
 const branchQuery=()=>db.from("appointments").select("id",{count:"exact",head:true}).eq("organization_id",activeMembership.organizationId).eq("branch_id",activeMembership.branchId);
 const [appointments,checkedIn,inProgress,ready]=await Promise.all([
  db.from("appointments").select("id,starts_at,status,customers(full_name),pet_appointment_details!inner(pet_name_snapshot,pickup_status)",{count:"exact"}).eq("organization_id",activeMembership.organizationId).eq("branch_id",activeMembership.branchId).gte("starts_at",start.toISOString()).lt("starts_at",end.toISOString()).order("starts_at").limit(100),
  branchQuery().eq("status","checked_in"),branchQuery().eq("status","in_service"),
  db.from("pet_appointment_details").select("appointment_id,appointments!inner(branch_id)",{count:"exact",head:true}).eq("organization_id",activeMembership.organizationId).eq("appointments.branch_id",activeMembership.branchId).eq("pickup_status","ready"),
 ]);
 const canViewFinance=["owner","manager","cashier"].includes(activeMembership.role);
 let finance: ReturnType<typeof summarizePayments> | null = null;
 if(canViewFinance) {
  try { const records=await loadPaymentWorkspace(db,activeMembership.organizationId,activeMembership.branchId,"appointment"); finance=summarizePayments(records.payments,records.documents,branchTimezone); } catch { /* Render a controlled finance error below. */ }
 }
 const error=[appointments,checkedIn,inProgress,ready].some(result=>result.error);
 const related=(value:unknown,key:string)=>{const row=Array.isArray(value)?value[0]:value;return (row as Record<string,string>|null)?.[key]??"";};
 return <main id="pet-care-dashboard" className="mx-auto min-w-0 max-w-6xl"><PageHeader id="pet-care-dashboard-header" eyebrow="Pet Care · Grooming" title={activeMembership.organizationName} description={activeMembership.branchName} action={enabled&&["owner","manager","advisor"].includes(activeMembership.role)?<div className="flex flex-wrap gap-2"><Button asChild variant="secondary"><Link id="pet-dashboard-walk-in-button" href="/dashboard/pet-care/appointments?dialog=walk-in"><Plus size={16} aria-hidden="true"/>Add walk-in</Link></Button><Button asChild><Link id="pet-dashboard-book-button" href="/dashboard/pet-care/appointments?dialog=create"><Calendar size={16} aria-hidden="true"/>Book appointment</Link></Button></div>:undefined}/>{error?<p role="alert" className="mt-4">Unable to load grooming activity.</p>:<><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Today's appointments",appointments.count],["Checked in",checkedIn.count],["Grooming in progress",inProgress.count],["Ready for pickup",ready.count]].map(([label,count])=><Card key={label} className="p-4"><p className="text-sm text-admin-text-secondary">{label}</p><p className="mt-2 text-2xl">{count??0}</p></Card>)}</div>{canViewFinance?<section id="pet-care-finance" className="mt-3 grid gap-3 sm:grid-cols-2">{!finance?<p role="alert" className="text-sm">Unable to load appointment balances.</p>:[ ["Outstanding appointment balances",finance.outstanding],["Payments Collected Today",finance.collected] ].map(([label,amount])=><Card key={label} className="p-4"><p className="text-sm text-admin-text-secondary">{label}</p><p className="mt-2 text-xl">{formatMoney(Number(amount??0), activeMembership.currency)}</p></Card>)}</section>:null}<section id="pet-care-today" className="mt-5"><h2 className="text-base font-medium">Today’s appointments</h2><div className="mt-3 grid gap-2">{appointments.data?.map(a=><Link id={`pet-today-${a.id}`} key={a.id} href={`/dashboard/pet-care/appointments/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-4 text-sm"><span>{related(a.pet_appointment_details,"pet_name_snapshot")} · {related(a.customers,"full_name")}</span><span>{new Intl.DateTimeFormat("en-PH",{timeZone:branchTimezone,timeStyle:"short"}).format(new Date(a.starts_at))} · {groomingStatus(a.status,related(a.pet_appointment_details,"pickup_status"))}</span></Link>)}{!appointments.data?.length?<p className="text-sm text-admin-text-secondary">No grooming appointments today.</p>:null}{(appointments.count??0)>100?<p className="text-sm">Showing the first 100 appointments.</p>:null}</div></section></>}<div className="mt-5 flex flex-wrap gap-3"><Button asChild variant="secondary"><Link id="pet-dashboard-pets-link" href="/dashboard/pet-care/pets"><PawPrint size={16} aria-hidden="true"/>Pets</Link></Button><Button asChild variant="secondary"><Link id="pet-dashboard-setup-link" href="/onboarding/setup"><ArrowRight size={16} aria-hidden="true"/>Setup checklist</Link></Button></div></main>;
}

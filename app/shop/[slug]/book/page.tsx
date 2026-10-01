import { promoServiceIds } from "@/modules/core/commerce/appointment-promos";
import Link from "next/link";
import {notFound} from "next/navigation";
import {ChevronLeft,ChevronRight,X} from "lucide-react";
import {BusinessIdentity} from "@/components/business-identity";
import {PoweredBy} from "@/components/powered-by";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {PublicBookingProgress} from "@/components/public-booking-progress";
import {BookingForm} from "./booking-form";
import {BookingSelection} from "./booking-selection";
import {buildPublicBookingCalendar,selectPublicBookingDate} from "@/lib/public-booking-calendar";
import {publicBookingDate} from "@/lib/public-booking";
import {publicBookingHref,publicBookingSelection,publicPromoAppliesOn} from "@/lib/public-promos";
import {loadPublicPromos} from "@/lib/public-promos.runtime";
import {loadPublicBusiness} from "@/lib/public-business";
import {createClient} from "@/lib/supabase/server";
import {reportActionError} from "@/lib/errors/action-error";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AvailabilityDate = { available_date: string; slot_count: number };

function missingRpc(error: { code?: string } | null) {
  return error?.code === "PGRST202" || error?.code === "42883";
}

async function loadAvailabilityDates(supabase: SupabaseClient, input: { slug: string; branchId: string; serviceIds: string[]; start: string; end: string; dates: string[] }) {
  const range = await supabase.rpc("get_public_availability_dates_for_services", {
    p_slug: input.slug,
    p_branch_id: input.branchId,
    p_service_ids: input.serviceIds,
    p_start_date: input.start,
    p_end_date: input.end,
  });

  if (!range.error) {
    return { dates: ((range.data ?? []) as AvailabilityDate[]).map(row => row.available_date), error: false, upgradeRequired: false };
  }

  if (!missingRpc(range.error)) {
    reportActionError("public_booking.availability_dates", range.error, "Availability could not be loaded.");
    return { dates: [], error: true, upgradeRequired: false };
  }
  // Existing single-service storefronts remain available during migration rollout.
  if (input.serviceIds.length !== 1) return { dates: [], error: true, upgradeRequired: true };
  const legacyRange = await supabase.rpc("get_public_availability_dates", {
    p_slug: input.slug,
    p_branch_id: input.branchId,
    p_service_id: input.serviceIds[0],
    p_start_date: input.start,
    p_end_date: input.end,
  });
  if (!legacyRange.error) return { dates: ((legacyRange.data ?? []) as AvailabilityDate[]).map(row => row.available_date), error: false, upgradeRequired: false };
  if (!missingRpc(legacyRange.error)) {
    reportActionError("public_booking.legacy_availability_dates", legacyRange.error, "Availability could not be loaded.");
    return { dates: [], error: true, upgradeRequired: false };
  }
  const daily = await Promise.all(input.dates.map(async date => {
    const result = await supabase.rpc("get_public_availability", {
      p_slug: input.slug,
      p_branch_id: input.branchId,
      p_service_id: input.serviceIds[0],
      p_date: date,
    });
    if (result.error) reportActionError("public_booking.daily_availability", result.error, "Availability could not be loaded.");
    return { date, available: !result.error && Boolean(result.data?.length), error: Boolean(result.error) };
  }));
  return { dates: daily.filter(day => day.available).map(day => day.date), error: daily.some(day => day.error), upgradeRequired: false };
}

async function loadSlots(supabase: SupabaseClient, input: { slug: string; branchId: string; serviceIds: string[]; date: string }) {
  const result = await supabase.rpc("get_public_availability_for_services", {
    p_slug: input.slug,
    p_branch_id: input.branchId,
    p_service_ids: input.serviceIds,
    p_date: input.date,
  });
  if (!result.error) return { slots: (result.data ?? []) as Array<{ slot_at: string }>, error: false, upgradeRequired: false };
  if (!missingRpc(result.error)) reportActionError("public_booking.availability_slots", result.error, "Availability could not be loaded.");
  if (!missingRpc(result.error) || input.serviceIds.length !== 1) return { slots: [], error: true, upgradeRequired: missingRpc(result.error) };
  const legacy = await supabase.rpc("get_public_availability", {
    p_slug: input.slug,
    p_branch_id: input.branchId,
    p_service_id: input.serviceIds[0],
    p_date: input.date,
  });
  if (legacy.error) reportActionError("public_booking.legacy_availability_slots", legacy.error, "Availability could not be loaded.");
  return { slots: (legacy.data ?? []) as Array<{ slot_at: string }>, error: Boolean(legacy.error), upgradeRequired: false };
}

type Query={branch?:string;service?:string;services?:string|string[];promo?:string;promos?:string|string[];selection?:string;step?:string;month?:string;date?:string};
const list=(value:string|string[]|undefined)=>Array.isArray(value)?value:value?[value]:[];
export default async function Page({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Query>}){
 const [{slug},query,db]=await Promise.all([params,searchParams,createClient()]);
 const [shop,promoResult]=await Promise.all([loadPublicBusiness(slug),loadPublicPromos(slug)]);
 if(!shop)notFound();
 const branch=shop.branches.find(b=>b.id===query.branch&&b.acceptsBookings)??shop.branches.find(b=>b.acceptsBookings);
 const selected=publicBookingSelection(shop.services,promoResult.promos,branch?.id??"",list(query.services??query.service),list(query.promos??query.promo));
 const serviceIds=selected.services.map(s=>s.id),promoIds=selected.promos.map(p=>p.id);
 const invalidPromo=list(query.promos??query.promo).some(id=>!promoIds.includes(id));
 let step=query.step==="2"?2:query.step==="3"?3:1;
 if(!branch||!serviceIds.length||serviceIds.length>10||invalidPromo)step=1;
 const {today,maxDate}=publicBookingDate(undefined,branch?.timezone??"Asia/Manila");
 const calendar=buildPublicBookingCalendar(query.month??query.date?.slice(0,7),today,maxDate);
 let availableDates:string[]=[],availabilityError=false,upgradeRequired=false,slots:Array<{slot_at:string}>=[];
 if(step>1&&branch){
  const result=await loadAvailabilityDates(db,{slug,branchId:branch.id,serviceIds,start:calendar.queryStart,end:calendar.queryEnd,dates:calendar.days.filter(d=>d.inMonth&&d.inBookingWindow).map(d=>d.date)});
  availabilityError=result.error;upgradeRequired=result.upgradeRequired;
  availableDates=result.dates.filter(date=>selected.promos.every(p=>publicPromoAppliesOn(p,date)));
 }
 const selectedDate=selectPublicBookingDate(query.date,availableDates);
 if(step===3&&branch&&selectedDate&&!availabilityError){const result=await loadSlots(db,{slug,branchId:branch.id,serviceIds,date:selectedDate});slots=result.slots;availabilityError=result.error;upgradeRequired=result.upgradeRequired;}
 if(step===3&&(!selectedDate||!slots.length||availabilityError))step=2;
 const href=(values:{step?:number;month?:string;date?:string})=>publicBookingHref(slug,branch?.id??"",serviceIds,promoIds,values);
 const dates=new Intl.DateTimeFormat("en-PH",{dateStyle:"full",timeZone:"UTC"});
 return <main id="public-booking-page" className="min-h-dvh min-w-0 bg-admin-canvas text-admin-text [overflow-wrap:anywhere]"><header className="border-b border-admin-border bg-white"><div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4"><div className="min-w-0"><BusinessIdentity name={shop.name} logoUrl={shop.logoUrl}/></div><Button asChild variant="ghost" size="icon" className="shrink-0 rounded-full"><Link id="public-booking-close" href={`/shop/${encodeURIComponent(slug)}`} aria-label="Close booking" title="Close booking"><X size={20} aria-hidden="true"/></Link></Button></div></header><div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
 <h1 className="mb-5 text-2xl font-medium">Book with {shop.name}</h1>
 {step<3?<PublicBookingProgress step={step}/>:null}
 {step===1?<Card id="public-booking-service-section" elevation="none" className="p-4 sm:p-6"><h2 className="text-xl font-medium">Choose your location and services</h2>{invalidPromo?<p role="alert" className="mt-3 text-sm text-status-danger">The selected promo is no longer available here. Choose another offer or service.</p>:null}{promoResult.unavailable?<p role="status" className="mt-3 text-sm text-admin-text-secondary">Promos are temporarily unavailable. You can still request a regular service.</p>:null}{!shop.services.length||!branch?<p id="public-booking-no-services" className="mt-4 text-sm">Online booking is unavailable. Please contact the business directly.</p>:<BookingSelection shop={shop} promos={promoResult.promos} branchId={branch.id} serviceIds={serviceIds.filter(id=>!selected.promos.some(p=>promoServiceIds(p).includes(id)))} promoIds={promoIds}/>}</Card>:null}
 {step===2?<Card id="public-booking-calendar-section" elevation="none" className="p-4 sm:p-6"><h2 className="text-xl font-medium">Choose an available date</h2><p className="mt-2 text-sm text-admin-text-secondary">{branch?.name} · {selected.durationMinutes} min. Highlighted dates match your services and promo dates.</p><div className="mt-4 flex items-center justify-between">{calendar.previousMonth?<Button asChild variant="ghost" size="icon"><Link id="public-booking-previous-month" aria-label="Previous month" prefetch={false} href={href({month:calendar.previousMonth})}><ChevronLeft/></Link></Button>:<span className="size-11"/>}<h3 id="public-booking-calendar-month" className="font-medium">{calendar.label}</h3>{calendar.nextMonth?<Button asChild variant="ghost" size="icon"><Link id="public-booking-next-month" aria-label="Next month" prefetch={false} href={href({month:calendar.nextMonth})}><ChevronRight/></Link></Button>:<span className="size-11"/>}</div>
 <div id="public-booking-calendar" className="mt-3 grid grid-cols-7 gap-1" aria-labelledby="public-booking-calendar-month">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><span className="py-2 text-center text-xs" key={d}>{d}</span>)}{calendar.days.map(day=>!day.inMonth?<span key={day.date} className="aspect-square"/>:availableDates.includes(day.date)?<Link id={`public-booking-date-${day.date}`} key={day.date} prefetch={false} aria-label={`${dates.format(new Date(`${day.date}T12:00:00Z`))}, available`} href={href({step:3,month:calendar.month,date:day.date})} className="grid aspect-square min-h-10 place-items-center rounded-ui-md bg-brand-tint text-sm font-medium text-brand-primary-strong focus-visible:ring-2 focus-visible:ring-brand-primary">{day.dayNumber}</Link>:<span key={day.date} id={`public-booking-date-${day.date}`} aria-disabled="true" className="grid aspect-square min-h-10 place-items-center text-sm text-admin-text-muted">{day.dayNumber}</span>)}</div>
 {availabilityError?<p role="alert" id="public-booking-availability-error" className="mt-4 text-sm">{upgradeRequired?"Multi-service availability is being updated. Try one service or contact the business.":"Availability could not be loaded. Refresh or try again later."}</p>:!availableDates.length?<p id="public-booking-no-openings" className="mt-4 text-sm">No matching openings in {calendar.label}. Try another month or change your selection.</p>:null}<Button asChild variant="secondary" className="mt-5"><Link id="public-booking-back-services" href={href({step:1})}>Back to services</Link></Button></Card>:null}
 {step===3&&branch&&selectedDate?<Card id="public-booking-details-section" elevation="none" className="p-4 sm:p-6"><BookingForm key={`${branch.id}-${serviceIds.join("-")}-${promoIds.join("-")}-${selectedDate}`} slug={slug} industry={shop.industry??"automotive"} branch={branch} services={selected.services} promos={selected.promos} selectedDate={selectedDate} slots={slots} backHref={href({step:2,month:calendar.month,date:selectedDate})}/></Card>:null}
 <p className="mt-5 text-sm text-admin-text-secondary">Your booking is a request until the business confirms it.</p><div className="mt-6"><PoweredBy id="public-booking-powered-by"/></div></div></main>;
}

"use client";
import { PageBack } from "@/components/page-back";
import { ArrowLeft } from "lucide-react";

import { promoServiceIds } from "@/modules/core/commerce/appointment-promos";
import Link from "next/link";
import { PublicBookingProgress } from "@/components/public-booking-progress";
import { formatMoney } from "@/lib/operations";
import type { PublicPromo } from "@/lib/public-promos";

import { Send as SendIcon } from "lucide-react";

import { startTransition, useActionState, useState, useEffect, useRef, type ChangeEvent } from "react";

import { customerChat } from "@/app/shop/[slug]/chat-actions";
import { chatStorageKey, chatTokenSchema, chatBookingNote } from "@/modules/core/chat/contracts";
import { submitBooking } from "@/app/shop/[slug]/actions";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicBranch, PublicService, PublicShop, PublicBookingState } from "@/lib/public-booking";

export function BookingForm({ slug, industry, branch, services, selectedDate, slots, promos = [], backHref }: { promos?: PublicPromo[];backHref?:string;slug: string; industry: PublicShop["industry"]; branch: PublicBranch; services: PublicService[]; selectedDate: string; slots: Array<{ slot_at: string }> }) {
  const submitting = useRef(false);
  const [state, action, pending] = useActionState(async (previous: PublicBookingState, data: FormData) => {
    try { return await submitBooking(previous, data); } finally { submitting.current = false; }
  }, {});
  const [step,setStep]=useState(3);
  const formRef=useRef<HTMLFormElement>(null);
  const titleRef=useRef<HTMLHeadingElement>(null);
  const draftKey=`booking-draft:${slug}:${branch.id}`;
  useEffect(()=>{titleRef.current?.focus();},[step]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(()=>{
    const timer=setTimeout(()=>{try{const cached=JSON.parse(sessionStorage.getItem(draftKey)??"null") as {at:number;values:Record<string,string>}|null;if(cached&&Date.now()-cached.at<30*60*1000&&cached.values){const restored=Object.fromEntries(Object.entries(cached.values).filter(([key,value])=>key!=="preferredAt"&&typeof value==="string"));setDraft(previous=>({...restored,...previous}));}}catch{/* Optional draft storage. */}},0);
    return ()=>clearTimeout(timer);
  },[draftKey]);
  useEffect(()=>{if(state.error){try{sessionStorage.setItem(draftKey,JSON.stringify({at:Date.now(),values:{...state.values,...draft}}));}catch{/* Optional draft storage. */}}},[state.error,state.values,draftKey,draft]);
  useEffect(() => {
    let cancelled = false;
    try {
      const token = sessionStorage.getItem(chatStorageKey(slug));
      if (chatTokenSchema.safeParse(token).success) {
        void customerChat({ operation: "read", slug, token }).then(result => {
          if (cancelled || !result.data || result.data.branchId !== branch.id) return;
          const context = result.data;
          setDraft(previous => ({ customerName: context.customerName, customerNote: chatBookingNote(context), ...previous }));
        }).catch(() => { /* Booking remains available without chat context. */ });
      }
    } catch { /* Browser storage is optional. */ }
    return () => { cancelled = true; };
  }, [slug, branch.id]);
  const requestedTime=draft.preferredAt??state.values?.preferredAt??"";
  const selectedTime=slots.some(slot=>slot.slot_at===requestedTime)?requestedTime:"";
  const fieldValue = (name: string) => draft[name] ?? state.values?.[name] ?? "";
  const updateDraft = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.currentTarget;
    setDraft(previous => {const next={...previous,[name]:value};try{sessionStorage.setItem(draftKey,JSON.stringify({at:Date.now(),values:next}));}catch{/* Optional draft storage. */}return next;});
  };
  const timeFormatter = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: branch.timezone ?? "Asia/Manila" });
  const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" });

  function advance(){
    if(step===3&&!selectedTime){formRef.current?.querySelector<HTMLInputElement>('input[name="preferredAt"]')?.reportValidity();return;}
    if(step===4){const fields=formRef.current?.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('[data-booking-details] input,[data-booking-details] select,[data-booking-details] textarea');for(const field of fields??[]){if(!field.reportValidity())return;}}
    setStep(current=>Math.min(5,current+1));
  }
  const regularServices=services.filter(s=>!promos.some(p=>promoServiceIds(p).includes(s.id)));
  const total=regularServices.reduce((sum,s)=>sum+s.priceCentavos,0)+promos.reduce((sum,p)=>sum+p.priceCentavos,0);
  return <form ref={formRef} id="public-booking-request-form" action={action} noValidate onSubmit={event => {
    event.preventDefault();
    if(pending || submitting.current)return;
    if(step<5){advance();return;}
    submitting.current = true;
    const data = new FormData(event.currentTarget);
    try{sessionStorage.removeItem(draftKey);}catch{/* Storage is optional. */}
    startTransition(() => action(data));
  }} aria-busy={pending}>
    <PageBack decorate={false}>{step===3?<Button asChild variant="secondary" disabled={pending}><Link id="public-booking-back-date" href={backHref??`/shop/${encodeURIComponent(slug)}/book`}><ArrowLeft aria-hidden="true" size={20}/>Back to date</Link></Button>:<Button id="public-booking-previous-step" type="button" variant="secondary" disabled={pending} onClick={()=>setStep(current=>current-1)}><ArrowLeft aria-hidden="true" size={20}/>Back</Button>}</PageBack>
    <PublicBookingProgress step={step}/>
    <div className="mb-4 flex min-w-0 flex-col items-start gap-3"><h2 ref={titleRef} tabIndex={-1} className="min-w-0 text-xl font-medium outline-none">{step===3?"Choose a time":step===4?"Tell us about your visit":"Review your request"}</h2></div>
    <fieldset disabled={pending}>
      <FormMessage error={state.error}/>
      <input type="hidden" name="slug" value={slug}/>
      <input type="hidden" name="branchId" value={branch.id}/>
      <input type="hidden" name="promoSelections" value={JSON.stringify(promos.map(p=>({id:p.id,version:p.version})))}/>
      {services.map(service => <input key={service.id} type="hidden" name="serviceIds" value={service.id}/>)}

      <section hidden={step!==3} id="public-booking-time-section" aria-labelledby="public-booking-time-title">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 id="public-booking-time-title" className="font-medium">Available times</h3><p className="mt-1 text-sm text-admin-text-muted">{dateFormatter.format(new Date(`${selectedDate}T12:00:00Z`))} · {branch.name} · {services.length} {services.length === 1 ? (industry === "salon" ? "treatment" : "service") : (industry === "salon" ? "treatments" : "services")}</p></div><span className="text-xs text-admin-text-muted">{branch.timezone.replaceAll("_", " ")}</span></div>
        <div id="public-booking-time-options" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {slots.map((slot, index) => <label id={`public-booking-time-option-${index}`} key={slot.slot_at} className="cursor-pointer rounded-ui-md border border-admin-border bg-white text-center transition-colors has-[:checked]:border-brand-primary has-[:checked]:bg-brand-tint has-[:checked]:text-brand-primary-strong has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-primary has-[:focus-visible]:ring-offset-2">
            <input id={`public-booking-time-${index}`} className="sr-only" required type="radio" name="preferredAt" value={slot.slot_at} checked={selectedTime === slot.slot_at} onChange={updateDraft}/>
            <span className="flex min-h-11 items-center justify-center px-2 py-2 text-sm font-medium">{timeFormatter.format(new Date(slot.slot_at))}</span>
          </label>)}
        </div>
      </section>

      <section hidden={step!==4} data-booking-details id="public-booking-customer-section" className="mt-7 border-t border-admin-border pt-5" aria-labelledby="public-booking-customer-title">
        <h3 id="public-booking-customer-title" className="font-medium">Your contact details</h3>
        <p className="mt-1 text-sm text-admin-text-muted">The business will use these details to confirm your request.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Full name<Input id="public-booking-name-input" required name="customerName" minLength={2} maxLength={120} value={fieldValue("customerName")} onChange={updateDraft} autoComplete="name" className="mt-2"/></label>
          <label className="text-sm font-medium">Mobile number<Input id="public-booking-phone-input" required name="phone" minLength={7} maxLength={30} value={fieldValue("phone")} onChange={updateDraft} autoComplete="tel" inputMode="tel" className="mt-2"/></label>
          <label className="text-sm font-medium sm:col-span-2">Email <span className="font-normal text-admin-text-muted">(optional)</span><Input id="public-booking-email-input" name="email" value={fieldValue("email")} onChange={updateDraft} type="email" autoComplete="email" className="mt-2"/></label>
        </div>
      </section>

      {industry === "pet_care" ? <section hidden={step!==4} data-booking-details id="public-booking-pet-section" className="mt-7 border-t border-admin-border pt-5"><h3 className="font-medium">Your pet</h3><p className="mt-1 text-sm text-admin-text-muted">One pet per grooming request.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Pet name<Input id="public-booking-pet-name" name="petName" required maxLength={120} value={fieldValue("petName")} onChange={updateDraft} className="mt-2"/></label>
        <label className="text-sm">Species<select id="public-booking-pet-species" name="species" required value={fieldValue("species")} onChange={updateDraft} className="mt-2 min-h-11 w-full rounded-xl border px-3"><option value="" disabled>Select species</option><option value="dog">Dog</option><option value="cat">Cat</option><option value="other">Other</option></select></label>
        <label className="text-sm sm:col-span-2">Breed (optional)<Input id="public-booking-pet-breed" name="breed" maxLength={120} value={fieldValue("breed")} onChange={updateDraft} className="mt-2"/></label>
      </div></section> : null}
      {industry === "automotive" ? <section hidden={step!==4} data-booking-details id="public-booking-vehicle-section" className="mt-7 border-t border-admin-border pt-5" aria-labelledby="public-booking-vehicle-title">
        <h3 id="public-booking-vehicle-title" className="font-medium">Vehicle details</h3>
        <p className="mt-1 text-sm text-admin-text-muted">Tell the shop which vehicle needs service.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Vehicle make<Input id="public-booking-vehicle-make-input" required name="vehicleMake" value={fieldValue("vehicleMake")} onChange={updateDraft} placeholder="Toyota" autoComplete="off" className="mt-2"/></label>
          <label className="text-sm font-medium">Vehicle model<Input id="public-booking-vehicle-model-input" required name="vehicleModel" value={fieldValue("vehicleModel")} onChange={updateDraft} placeholder="Fortuner" autoComplete="off" className="mt-2"/></label>
          <label className="text-sm font-medium">Model year <span className="font-normal text-admin-text-muted">(optional)</span><Input id="public-booking-vehicle-year-input" name="vehicleYear" value={fieldValue("vehicleYear")} onChange={updateDraft} type="number" inputMode="numeric" min="1900" max={new Date().getFullYear() + 1} className="mt-2"/></label>
          <label className="text-sm font-medium">Vehicle type <span className="font-normal text-admin-text-muted">(optional)</span><Input id="public-booking-vehicle-type-input" name="vehicleType" value={fieldValue("vehicleType")} onChange={updateDraft} placeholder="SUV" autoComplete="off" className="mt-2"/></label>
          <label className="text-sm font-medium sm:col-span-2">Plate number <span className="font-normal text-admin-text-muted">(optional)</span><Input id="public-booking-plate-input" name="plateNumber" value={fieldValue("plateNumber")} onChange={updateDraft} autoComplete="off" className="mt-2"/></label>
        </div>
      </section> : null}

      <section hidden={step!==4} data-booking-details id="public-booking-notes-section" className="mt-7 border-t border-admin-border pt-5">
        <label className="text-sm font-medium">Notes or preferred staff? <span className="font-normal text-admin-text-muted">(optional)</span><textarea id="public-booking-notes-input" name="customerNote" placeholder="You can request a staff member by name. The business will confirm availability or suggest an alternative." value={fieldValue("customerNote")} onChange={updateDraft} maxLength={1000} className="mt-2 min-h-24 w-full rounded-ui-md border border-admin-border bg-white p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary"/></label>
      </section>

      <label className="absolute -left-[9999px]" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
      {step===5?<section id="public-booking-review" className="space-y-4 text-sm"><div className="rounded-ui-lg border border-admin-border p-4"><p className="font-medium">{branch.name}</p><p>{dateFormatter.format(new Date(`${selectedDate}T12:00:00Z`))} · {selectedTime?timeFormatter.format(new Date(selectedTime)):"Select a time"}</p></div><div className="rounded-ui-lg border border-admin-border p-4"><h3 className="font-medium">Services and promos</h3><ul className="mt-2 space-y-3">{services.filter(s=>!promos.some(p=>promoServiceIds(p).includes(s.id)) || promos.some(p=>promoServiceIds(p)[0]===s.id)).map(s=>{const p=promos.find(p=>promoServiceIds(p).includes(s.id));return <li key={s.id}><p className="flex justify-between gap-3"><span>{p?`Promo · ${p.name}`:s.name}</span><strong>{formatMoney(p?.priceCentavos??s.priceCentavos,p?.currency??s.currency)}</strong></p>{p?<ul className="mt-1 list-inside list-disc text-admin-text-secondary">{promoServiceIds(p).map(id=><li key={id}>{services.find(service=>service.id===id)?.name}</li>)}{p.inclusions.map((item,index)=><li key={index}>{item.name} · {item.quantity} {item.unit}</li>)}</ul>:null}</li>;})}</ul><p className="mt-3 flex justify-between border-t border-admin-border pt-3 font-medium"><span>{regularServices.length===0?"Total":"Estimated total"}</span><span>{formatMoney(total,promos[0]?.currency??services[0]?.currency)}</span></p></div><div className="rounded-ui-lg border border-admin-border p-4"><h3 className="font-medium">Contact details</h3><p className="mt-2">{fieldValue("customerName")} · {fieldValue("phone")}</p>{fieldValue("email")?<p>{fieldValue("email")}</p>:null}{industry==="pet_care"?<p className="mt-2">Pet: {fieldValue("petName")} · {fieldValue("species")}</p>:industry==="automotive"?<p className="mt-2">Vehicle: {fieldValue("vehicleMake")} {fieldValue("vehicleModel")} {fieldValue("plateNumber")}</p>:null}{fieldValue("customerNote")?<p className="mt-2 whitespace-pre-wrap">{fieldValue("customerNote")}</p>:null}</div><p className="text-admin-text-secondary">Check your details before sending. The business will review and confirm your requested time.</p></section>:null}
      <div id="public-booking-request-actions" className="mt-6 flex flex-wrap justify-end gap-3">{step<5?<Button key="continue" id="public-booking-next-step" type="button" disabled={pending||(step===3&&!selectedTime)} onClick={event=>{event.preventDefault();advance();}}>Continue</Button>:<Button key="submit" id="public-booking-submit-button" type="submit" disabled={pending} aria-busy={pending}><SendIcon aria-hidden="true" size={16}/>{pending?"Submitting request…":"Submit booking request"}</Button>}</div>
    </fieldset>
  </form>;
}

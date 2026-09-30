"use client";
import {useActionState} from "react";
import {respondToAlternative} from "@/app/booking/[token]/actions";
import {Button} from "@/components/ui/button";
export type BookingAlternative = {version:number;startsAt:string;staffName:string|null;message:string;status:string};
export function BookingAlternativeResponse({token,offer,timezone}:{token:string;offer:BookingAlternative;timezone:string}){
 const [state,action,pending]=useActionState(respondToAlternative,{});
 if(!["pending","accepted"].includes(offer.status))return null;
 return <section id="booking-alternative" className="mt-5 rounded-ui-md border border-brand-border bg-brand-tint p-4">
  <h3 className="font-medium">{offer.status==="accepted"?"Alternative accepted":"The business suggested an alternative"}</h3>
  <p className="mt-2 text-sm font-medium">{new Intl.DateTimeFormat("en-PH",{dateStyle:"full",timeStyle:"short",timeZone:timezone}).format(new Date(offer.startsAt))}</p>
  {offer.staffName?<p className="mt-2 text-sm">Staff: {offer.staffName}</p>:null}
  {offer.message?<p className="mt-2 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{offer.message}</p>:null}
  <p className="mt-3 text-sm">{offer.status==="accepted"?"The business will check availability and give final confirmation. Your appointment is not confirmed yet.":"Accept to send this choice back to the business for final confirmation, or cancel your booking request. This time is not reserved yet."}</p>
  <form id="booking-alternative-response-form" action={action} className="mt-4 flex flex-wrap gap-2">
   <input type="hidden" name="token" value={token}/><input type="hidden" name="version" value={offer.version}/>
   {offer.status==="pending"?<Button type="submit" disabled={pending} id="booking-alternative-accept" name="action" value="accept">{pending?"Sending…":"Accept alternative"}</Button>:null}
   <Button type="submit" disabled={pending} id="booking-alternative-cancel" name="action" value="cancel" variant="secondary">{pending?"Sending…":"Cancel booking"}</Button>
   {state.error?<p role="alert" className="basis-full text-sm text-status-danger">{state.error}</p>:null}
  </form>
 </section>;
}

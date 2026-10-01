import {randomUUID} from "node:crypto";
import {openCheckout} from "@/app/dashboard/checkout/actions";
import {SubmitButton} from "@/components/submit-button";
export function CheckoutEntry({appointmentId,invoiceId,id="open-checkout",label="Checkout"}:{appointmentId?:string;invoiceId?:string;id?:string;label?:string}){
 return <form action={openCheckout}><input type="hidden" name="appointmentId" value={appointmentId??""}/><input type="hidden" name="invoiceId" value={invoiceId??""}/><input type="hidden" name="request" value={randomUUID()}/><SubmitButton id={id} pendingText="Opening…">{label}</SubmitButton></form>;
}

import { Globe, Mail, MapPin, Phone, ExternalLink } from "lucide-react";
import type { PublicShop } from "@/lib/public-booking";
import { safeMapLink } from "@/lib/location-map";
import { Card } from "@/components/ui/card";

export function PublicContact({ shop }: { shop: PublicShop }) {
  const channels = [
    {label:"Website",value:shop.website}, {label:"Facebook",value:shop.facebook}, {label:"Instagram",value:shop.instagram},
  ].flatMap(item=>{const href=safeMapLink(item.value);return href?[{...item,href}]:[];});
  const contacts = [
    {id:"business",name:shop.name,phone:shop.phone,email:shop.email,address:[] as (string|null)[]},
    ...shop.branches.filter(branch=>branch.phone||branch.email).map(branch=>({...branch})),
  ];
  return <section id="public-shop-contact" className="scroll-mt-[calc(6rem+env(safe-area-inset-top))] sm:scroll-mt-5" aria-labelledby="public-shop-contact-title">
    <p className="text-sm font-semibold text-brand-primary-strong">Get in touch</p>
    <h2 id="public-shop-contact-title" className="mt-1 text-3xl font-semibold tracking-tight text-brand-ink">Contact us</h2>
    <p className="mt-3 text-sm leading-6 text-admin-text-secondary">Have a question about a service or your visit? Contact {shop.name} or your preferred location.</p>
    <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">{contacts.map(contact=><Card id={`public-contact-card-${contact.id}`} key={contact.id} elevation="none" className="min-w-0 p-5">
      <h3 className="font-semibold">{contact.name}</h3>
      <dl className="mt-3 space-y-3 text-sm">
        {contact.phone?<div><dt className="text-xs text-admin-text-muted">Phone</dt><dd><a id={`public-contact-phone-${contact.id}`} className="inline-flex min-h-11 max-w-full items-center gap-2 font-medium text-brand-primary-strong" href={`tel:${contact.phone.replace(/[^\d+]/g,"")}`}><Phone size={17} className="shrink-0" aria-hidden="true"/><span className="min-w-0 [overflow-wrap:anywhere]">{contact.phone}</span></a></dd></div>:null}
        {contact.email?<div><dt className="text-xs text-admin-text-muted">Email</dt><dd><a id={`public-contact-email-${contact.id}`} className="inline-flex min-h-11 max-w-full items-center gap-2 font-medium text-brand-primary-strong" href={`mailto:${encodeURIComponent(contact.email)}`}><Mail size={17} className="shrink-0" aria-hidden="true"/><span className="min-w-0 [overflow-wrap:anywhere]">{contact.email}</span></a></dd></div>:null}
        {contact.address.some(Boolean)?<div><dt className="text-xs text-admin-text-muted">Address</dt><dd className="mt-2 flex gap-2 leading-6"><MapPin size={17} aria-hidden="true" className="mt-0.5 shrink-0"/><span>{contact.address.filter(Boolean).join(", ")}</span></dd></div>:null}
      </dl>
      {contact.id==="business"&&channels.length?<nav id="public-contact-social-links" aria-label="Contact channels" className="mt-3 flex flex-wrap gap-2">{channels.map(channel=><a id={`public-contact-${channel.label.toLowerCase()}`} key={channel.label} href={channel.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-ui-md border border-admin-border px-3 text-sm font-medium text-brand-primary-strong"><Globe size={16} aria-hidden="true"/>{channel.label}<ExternalLink size={13} aria-hidden="true"/></a>)}</nav>:null}
      {!contact.phone&&!contact.email&&!channels.length?<p className="mt-3 text-sm text-admin-text-secondary">Business contact details have not been added yet. See our locations for visiting information.</p>:null}
    </Card>)}</div>
  </section>;
}

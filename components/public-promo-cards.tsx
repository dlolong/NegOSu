import { PublicCardRow } from "@/components/public-card-row";
import { promoServiceIds } from "@/modules/core/commerce/appointment-promos";
import Link from "next/link";
import { ServiceThumbnail } from "@/components/service-thumbnail";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/operations";
import type { PublicPromo } from "@/lib/public-promos";
export function PublicPromoCards({slug,promos,branches,services}:{services:Array<{id:string;name:string}>;slug:string;promos:PublicPromo[];branches:Array<{id:string;name:string}>}){
 if(!promos.length)return null;
 return <section id="public-shop-promos" className="scroll-mt-24" aria-labelledby="public-shop-promos-title"><p className="text-sm font-medium text-brand-primary-strong">Special offers</p><h2 id="public-shop-promos-title" className="mt-1 text-3xl font-medium text-brand-ink">Promos</h2><div className="mt-4"><PublicCardRow id="public-shop-promos-row" label="promos">{promos.map(p=><Card id={`public-promo-${p.id}`} key={p.id} elevation="none" className="flex min-w-0 flex-col p-4 sm:p-5"><ServiceThumbnail id={`public-promo-image-${p.id}`} url={p.imageUrl} name={p.name}/><p className="mt-3 text-sm text-admin-text-secondary">{branches.find(b=>b.id===p.branchId)?.name}</p><h3 className="mt-1 text-xl font-medium">{p.name}</h3>{p.description?<p className="mt-2 text-sm text-admin-text-secondary">{p.description}</p>:null}<ul className="mt-3 list-inside list-disc text-sm">{promoServiceIds(p).map(id=><li key={id}>{services.find(s=>s.id===id)?.name??"Included service"}</li>)}{p.inclusions.map((item,index)=><li key={index}>{item.name} · {item.quantity} {item.unit}</li>)}</ul>{p.validFrom||p.validThrough?<p className="mt-3 text-sm text-admin-text-secondary">{p.validFrom?`From ${p.validFrom}`:"Available now"}{p.validThrough?` · Through ${p.validThrough}`:""}</p>:null}<div className="mt-auto flex items-center justify-between gap-3 pt-4"><strong>{formatMoney(p.priceCentavos,p.currency)}</strong><span className="text-sm">{p.durationMinutes} min</span></div><Button asChild className="mt-4"><Link id={`public-promo-book-${p.id}`} href={`/shop/${encodeURIComponent(slug)}/book?branch=${encodeURIComponent(p.branchId)}&promo=${encodeURIComponent(p.id)}`}>Book this promo</Link></Button></Card>)}</PublicCardRow></div></section>;
}

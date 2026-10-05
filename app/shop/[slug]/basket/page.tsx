import { BusinessIdentity } from "@/components/business-identity";
import { ArrowLeft, ShoppingBasket } from "lucide-react";
import {randomUUID} from "node:crypto";
import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import type {PublicShop} from "@/lib/public-booking";
import {PublicBasketForm} from "@/components/public-basket-form";
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params,db=await createClient();
 const {data,error}=await db.rpc("get_public_shop",{p_slug:slug});
 if(error)return <main className="mx-auto max-w-2xl p-6"><p role="alert">Unable to load your basket. Refresh and try again.</p></main>;
 const shop=data as PublicShop|null;
 if(!shop)notFound();
 return <main id="public-basket-page" className="min-h-dvh min-w-0 bg-admin-canvas pb-12 text-admin-text"><header className="border-b border-admin-border bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><Link id="basket-shop-home" className="min-w-0" href={`/shop/${encodeURIComponent(slug)}`}><BusinessIdentity name={shop.name} logoUrl={shop.logoUrl}/></Link><span className="flex shrink-0 items-center gap-2 text-sm text-admin-text-secondary"><ShoppingBasket size={18} aria-hidden="true"/>Basket</span></div></header><div className="mx-auto max-w-6xl px-4 sm:px-6"><Link id="public-basket-back" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-primary-strong hover:underline" href={`/shop/${encodeURIComponent(slug)}#public-shop-products`}><ArrowLeft size={16} aria-hidden="true"/>Continue shopping</Link><div className="mb-7 mt-3"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your basket</h1><p className="mt-2 max-w-xl text-sm leading-6 text-admin-text-secondary">Review your selection and leave your contact details. We’ll take care of confirming the rest.</p></div><PublicBasketForm slug={shop.slug} products={shop.products??[]} requestKey={randomUUID()}/></div></main>;
}

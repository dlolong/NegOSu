"use client";
import {useEffect,useState} from "react";
import { ShoppingBasket } from "lucide-react";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {readBasket,writeBasket} from "@/lib/public-basket";
import type {PublicProduct} from "@/lib/public-booking";
export function PublicBasketLink({slug,compact=false,id="public-basket-link"}:{slug:string;compact?:boolean;id?:string}){
 const [count,setCount]=useState(0);
 useEffect(()=>{const update=()=>setCount(readBasket(slug).length);update();window.addEventListener("negosu-basket-change",update);window.addEventListener("storage",update);return()=>{window.removeEventListener("negosu-basket-change",update);window.removeEventListener("storage",update);};},[slug]);
 return <Button asChild variant="secondary" size="sm" className="shrink-0 whitespace-nowrap"><Link id={id} aria-label={`View basket, ${count} ${count === 1 ? "product" : "products"}`} href={`/shop/${encodeURIComponent(slug)}/basket`}><ShoppingBasket size={20} aria-hidden="true" className="shrink-0"/>{compact ? <span aria-hidden="true" className="min-w-5 rounded-full bg-brand-tint px-1 text-xs font-semibold text-brand-primary-strong">{count}</span> : <span>View basket ({count})</span>}</Link></Button>;
}
export function AddToPublicBasket({slug,product}:{slug:string;product:PublicProduct}){
 const [message,setMessage]=useState("");
 return <div className="mt-3"><Button id={`public-product-add-${product.id}`} className="w-full" onClick={()=>{
  const basket=readBasket(slug);
  if(basket.some(item=>item.branchId!==product.branchId)){setMessage("Your basket uses another pickup branch. Review your basket before adding this product.");return;}
  if(basket.some(item=>item.productId===product.id)){setMessage("Already in your basket. Change quantities in the basket.");return;}
  if(basket.length>=20){setMessage("Your basket can hold up to 20 products.");return;}
  try{writeBasket(slug,[...basket,{productId:product.id,branchId:product.branchId,quantity:"1"}]);setMessage("Added to basket.");}catch{setMessage("Allow site storage to save your basket, then try again.");}
 }}><ShoppingBasket size={18} aria-hidden="true" className="shrink-0"/>Add to basket</Button>{message?<p role="status" className="mt-2 text-sm">{message} <Link className="underline" href={`/shop/${encodeURIComponent(slug)}/basket`}>View basket</Link></p>:null}</div>;
}

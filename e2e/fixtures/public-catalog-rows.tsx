import React from "react";
import { createRoot } from "react-dom/client";
import { PublicServiceCategories } from "@/components/public-service-categories";
import { PublicPromoCards } from "@/components/public-promo-cards";
const services = Array.from({length:8}, (_, index) => ({id:`service-${index}`,name:`Service ${index}`,description:"Choose a time that works for you.",durationMinutes:30,priceCentavos:10000,category:index<5?"Hair care":index<7?"Nails":null}));
const promos = Array.from({length:5}, (_, index) => ({id:`promo-${index}`,branchId:"main",serviceId:services[0].id,name:`Promo ${index}`,description:"A special offer",imageUrl:null,version:1,priceCentavos:15000,currency:"PHP",durationMinutes:30,validFrom:null,validThrough:null,inclusions:[]}));
createRoot(document.getElementById("root")!).render(<><PublicPromoCards slug="salon" promos={promos} branches={[{id:"main",name:"Main"}]} services={services}/><PublicServiceCategories services={services} shopName="Salon" bookingHref="/shop/salon/book" currency="PHP" serviceLabel="service"/></>);

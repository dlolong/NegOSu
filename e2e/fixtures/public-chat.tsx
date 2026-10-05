import React from "react";
import { createRoot } from "react-dom/client";
import { PublicChat } from "@/components/public-chat";
import type { PublicShop } from "@/lib/public-booking";
const shop: PublicShop = {
 slug:"test",name:"Test Salon",industry:"salon",description:null,logoUrl:null,coverUrl:null,phone:null,email:null,website:null,facebook:null,instagram:null,gallery:[],
 branches:[{id:"10000000-0000-4000-8000-000000000001",name:"Main",timezone:"Asia/Manila",description:null,phone:null,email:null,address:["123 Main Street"],mapUrl:null,hours:{monday:{open:"09:00",close:"17:00"}},acceptsBookings:true}],
 services:[{id:"10000000-0000-4000-8000-000000000002",name:"Haircut",description:null,priceCentavos:10000,currency:"PHP",durationMinutes:30,category:null}],
};
createRoot(document.getElementById("root")!).render(<PublicChat shop={shop}/>);

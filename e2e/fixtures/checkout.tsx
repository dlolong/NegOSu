import React from "react";
import {createRoot} from "react-dom/client";
import {CheckoutWorkspace} from "@/components/checkout-workspace";
import {CheckoutPayment} from "@/components/checkout-payment";
import type {Checkout} from "@/modules/core/checkout/contracts";
const checkout:Checkout={id:"checkout",customer:"Example customer",customerId:null,appointmentId:null,sourceInvoiceId:null,currency:"PHP",timezone:"Asia/Manila",createdAt:"2026-10-01",total:12500,paid:5000,balance:7500,tax:0,discount:0,hasDraft:true,draftTotal:2500,baseLines:[{name:"Facial bundle",quantity:1,unitPrice:10000,amount:10000}],products:[{id:"line",inventory_item_id:"product",name:"Shampoo",unit:"bottle",quantity:1,unit_price_centavos:2500,line_total_centavos:2500,stock_tracked:true,reservation_id:null,reserved:1,invoice_id:null,invoiceStatus:null,included_key:null,promo_name:null,handed_over:0,returned:0,version:1}],promos:[],invoices:[],payments:[]};
const q=Object.fromEntries(new URLSearchParams(location.search));
const products=[{id:"product",name:"Shampoo",sku:"CARE-01",category:"Care",unit:"bottle",price:2500,stock_tracked:true,available:3},{id:"empty",name:"Unavailable product",sku:null,category:null,unit:"piece",price:1000,stock_tracked:true,available:0}];
createRoot(document.getElementById("root")!).render(q.payment?<CheckoutPayment checkout={{...checkout,hasDraft:false}} timezone="Asia/Manila" error={q.error}/>:<CheckoutWorkspace checkout={checkout} branchName="Main branch" industry="salon" query={q} products={products}/>);

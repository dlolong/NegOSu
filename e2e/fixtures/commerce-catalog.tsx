import React from "react";
import { createRoot } from "react-dom/client";
import { ProductCatalogForm, PromoCatalogForm } from "@/components/commerce-catalog-forms";

const product = { id: "22222222-2222-4222-8222-222222222222", name: "Take-home shampoo", sku: null, description: null, category: "Retail", unit: "piece", sell_price_centavos: 50000, product_purpose: "both", stock_tracked: true, is_active: true };
const requestKey = "33333333-3333-4333-8333-333333333333";
const query = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(query.has("promo") ? <PromoCatalogForm requestKey={requestKey} currency="PHP" hospitality={query.has("stay")} products={[product]} services={[{ id: "11111111-1111-4111-8111-111111111111", name: "Facial" }, {id:"44444444-4444-4444-8444-444444444444",name:"Massage"}]}/> : <ProductCatalogForm requestKey={requestKey} product={product} currency="PHP"/>);

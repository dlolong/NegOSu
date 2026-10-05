import React from "react";
import { createRoot } from "react-dom/client";
import { PublicProductCards } from "@/components/public-product-cards";
const multiple = new URLSearchParams(location.search).has("multiple");
const empty = new URLSearchParams(location.search).has("empty");
createRoot(document.getElementById("root")!).render(<PublicProductCards slug="test-shop" products={empty ? [] : [{ id: "product-example", name: "Take-home shampoo", thumbnailUrl: "https://images.example.test/product.png", description: "For daily care", category: "Hair care", unit: "bottle", priceCentavos: 12500, currency: "PHP", branchId: "branch-example", branchName: "Main location" }, ...(multiple ? Array.from({length:5},(_,index)=>({id:`extra-${index}`,name:`Product ${index}`,description:null,category:index===4?null:"Hair care",unit:"bottle",priceCentavos:10000,currency:"PHP",branchId:"branch-example",branchName:"Main location"})) : [])]}/>);

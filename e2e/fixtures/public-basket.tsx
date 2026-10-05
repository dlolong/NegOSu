import React from "react";
import {createRoot} from "react-dom/client";
import {AddToPublicBasket,PublicBasketLink} from "@/components/public-basket-button";
import {PublicBasketForm} from "@/components/public-basket-form";
const products=[1,2].map(n=>({id:`10000000-0000-4000-8000-00000000000${n}`,name:`Product ${n}`,description:null,category:"Care",unit:"bottle",priceCentavos:n*10000,currency:"PHP",branchId:"20000000-0000-4000-8000-000000000001",branchName:"Main Branch"}));
createRoot(document.getElementById("root")!).render(location.pathname.endsWith("/basket")?<PublicBasketForm slug="test-shop" products={products} requestKey="30000000-0000-4000-8000-000000000001"/>:<><PublicBasketLink slug="test-shop"/>{products.map(product=><AddToPublicBasket key={product.id} slug="test-shop" product={product}/>)}</>);

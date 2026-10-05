import React from "react";
import { createRoot } from "react-dom/client";
import { PublicProductOrderForm } from "@/components/public-product-order-form";
import { RecordRow, RecordLink } from "@/components/record-item";
createRoot(document.getElementById("root")!).render(<>
<table><tbody><RecordRow id="product-list-row"><td><RecordLink id="product-open" href="https://forms.test/products/example">Shampoo</RecordLink></td><td id="product-list-price">125.00</td><td><a id="product-edit" href="https://forms.test/products?dialog=edit&id=example">Edit</a></td></RecordRow></tbody></table>
<PublicProductOrderForm slug="test-shop" requestKey="10000000-0000-4000-8000-000000000002" product={{ id: "10000000-0000-4000-8000-000000000001", name: "Shampoo", description: null, category: "Care", unit: "bottle", priceCentavos: 12500, currency: "PHP", branchId: "branch", branchName: "Main location" }}/>
</>);

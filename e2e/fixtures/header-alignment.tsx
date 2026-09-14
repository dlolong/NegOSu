import React from "react";
import { createRoot } from "react-dom/client";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/page-patterns";
import { FormDialog } from "@/components/management-ui";
import { ServiceCategoryList } from "@/components/service-catalog";
import { Button } from "@/components/ui/button";
const query = new URLSearchParams(location.search);
const long = query.has("long");
const actions = <><Button id="header-secondary" asChild variant="outline" size="sm"><Link href="/export"><Download size={16} aria-hidden="true"/>Export</Link></Button><Button id="header-primary" asChild><Link href="/create"><Plus size={16} aria-hidden="true"/>{long ? "Add a new product to this branch" : "Add product"}</Link></Button></>;
const root = document.getElementById("root")!;
root.className = "mx-auto max-w-7xl space-y-8 p-4";
createRoot(root).render(query.has("dialog") ? <FormDialog id="alignment-dialog" title="Edit product details" description="Update the product information for this branch. Review the name, category and stock unit before saving your changes." closeHref="/fixture" size="md"><p>Product form</p></FormDialog> : query.has("category") ? <ServiceCategoryList categories={[]} canManage salon={false}/> : <>
  <PageHeader id="alignment-page-header" eyebrow="Main branch" title={long ? "LongInventoryHeader".repeat(5) : "Inventory"} description={long ? "Manage product quantities, review stock availability, and track movements across your business. Use the filters below to find products in this branch." : "Manage products and track stock."} action={query.has("nested") ? <div className="flex gap-2">{actions}</div> : actions}/>
  <SectionHeader id="alignment-section-header" title="Recent activity" description="Review the latest changes to inventory in this branch." action={<Button id="section-action" asChild variant="secondary"><Link href="/create"><Plus size={16} aria-hidden="true"/>Add movement</Link></Button>}/>
</>);

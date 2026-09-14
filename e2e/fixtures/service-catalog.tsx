import React from "react";
import { createRoot } from "react-dom/client";
import { ServiceCategoryList, ServiceCatalogList } from "@/components/service-catalog";
import { ServiceCategoryForm } from "@/components/service-category-form";
import { FormDialog } from "@/components/management-ui";
import { DashboardBackLink } from "@/components/dashboard-back-link";

const query = new URLSearchParams(location.search);
const categories = [{ id: "72000000-0000-4000-8000-000000000001", name: "Hair and Beauty", sort_order: 0, is_active: true, serviceCount: 2 }, { id: "72000000-0000-4000-8000-000000000002", name: "LongCategory".repeat(8), sort_order: 10, is_active: false, serviceCount: 0 }];
const mode = query.get("dialog")?.replace("category-", "") as "create" | "edit" | "delete" | undefined;
const selected = categories.find(category => category.id === query.get("categoryId"));
const prefix = "service-category";
const services = [{ id: "82000000-0000-4000-8000-000000000001", name: "LongServiceName".repeat(10), short_description: "DescriptionWithoutSpaces".repeat(8), duration_minutes: 180, base_price_centavos: 999999999, is_active: true, is_add_on: true, service_categories: { name: categories[1].name }, service_branch_availability: [{ is_available: true, branches: { name: "LongBranchName".repeat(8) } }] }];
createRoot(document.getElementById("root")!).render(query.has("pathname") ? <DashboardBackLink salon={query.get("industry") === "salon"}/> : query.get("view") === "services" ? <ServiceCatalogList services={services} salon={query.get("industry") === "salon"}/> : <>
  <ServiceCategoryList categories={query.has("empty") ? [] : categories} canManage={!query.has("readonly")} salon={false}/>
  {mode ? <FormDialog id={`${prefix}-${mode}-dialog`} title={`${mode} category`} closeHref="/dashboard/services?tab=categories" size="md"><ServiceCategoryForm mode={mode} category={selected} prefix={prefix}/></FormDialog> : null}
</>);

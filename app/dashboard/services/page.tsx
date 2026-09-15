import { addStarterServices } from "@/app/dashboard/operations-actions";
import { starterServices, hasStarterCatalog } from "@/modules/core/catalog/starter-services";
import { SubmitButton } from "@/components/submit-button";
import { FormActions } from "@/components/form-actions";
import { RecordTable } from "@/components/record-table";
import { formatMoney } from "@/lib/operations";
import { Plus, Search, ListPlus } from "lucide-react";
import Link from "next/link";
import { Tabs } from "@/components/ui/tabs";
import { notFound } from "next/navigation";
import { FormMessage } from "@/components/form-message";
import { FormDialog } from "@/components/management-ui";
import { FilterBar, PageHeader } from "@/components/page-patterns";
import { ServiceCatalogList, ServiceCategoryList, type CatalogService } from "@/components/service-catalog";
import { ServiceCategoryForm, type CategoryRecord } from "@/components/service-category-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { servicesCatalogHref } from "@/lib/service-categories";
import { createClient } from "@/lib/supabase/server";
import { resolveIndustryConfig } from "@/modules/platform/industry";

type CatalogParams = { q?: string; category?: string; tab?: string; dialog?: string; categoryId?: string; message?: string; error?: string };

export default async function Page({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const search = params.q?.trim().replace(/[,%()]/g, " ").slice(0, 100);
  const config = resolveIndustryConfig(activeMembership.industry), salon = config.key === "salon";
  const categoryTab = params.tab === "categories";
  const prefix = salon ? "salon-treatment-category" : "service-category";
  const canManage = ["owner", "manager"].includes(activeMembership.role);
  let serviceQuery = supabase.from("services").select("id,name,short_description,duration_minutes,base_price_centavos,is_active,is_add_on,service_categories(name),service_branch_availability(is_available,branches(name))").eq("organization_id", activeMembership.organizationId).order("name");
  if (search) serviceQuery = serviceQuery.ilike("name", `%${search}%`);
  // Only canonical UUID filters reach the database; malformed queries never become raw SQL errors.
  const safeFilter = new URL(servicesCatalogHref({ category: params.category }), "https://catalog.invalid").searchParams.get("category");
  if (safeFilter) serviceQuery = serviceQuery.eq("category_id", safeFilter);
  const [serviceResult, categoryResult] = await Promise.all([serviceQuery, supabase.from("service_categories").select("id,name,sort_order,is_active,services(count)").eq("organization_id", activeMembership.organizationId).order("sort_order").order("name")]);
  const services = (serviceResult.data ?? []) as unknown as CatalogService[];
  const categories: CategoryRecord[] = (categoryResult.data ?? []).map(category => ({ ...category, serviceCount: category.services?.[0]?.count ?? 0 }));
  const mode = params.dialog === "category-create" ? "create" : params.dialog === "category-edit" ? "edit" : params.dialog === "category-delete" ? "delete" : null;
  const selected = categories.find(category => category.id === params.categoryId);
  if (mode && !categoryResult.error && (!canManage || (mode !== "create" && !selected))) notFound();
  const closeHref = servicesCatalogHref({ q: params.q, category: params.category, tab: "categories" });
  return <main id={salon ? "salon-treatments-page" : "services-page"} className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id={salon ? "salon-treatments-page-header" : "services-page-header"} eyebrow="Catalog and pricing" title={`${config.terminology.service}s`} description="Manage your offerings, pricing, and categories in one place." action={canManage ? <div className="flex flex-wrap justify-end gap-2">{hasStarterCatalog(activeMembership.industry) ? <Button asChild variant="secondary"><Link id="starter-services-open-button" href="/dashboard/services?dialog=starter-services"><ListPlus size={16} aria-hidden="true"/>Starter services</Link></Button> : null}<Button asChild><Link id={salon ? "salon-treatment-create-button" : "service-create-button"} href="/dashboard/services/new"><Plus aria-hidden="true" size={16} className="shrink-0"/>Add {config.terminology.service.toLowerCase()}</Link></Button></div> : undefined}/>
    <FormMessage message={params.message} error={params.error ?? (categoryResult.error ? "Unable to load categories. Please refresh and try again." : serviceResult.error ? "Unable to load the catalog. Please refresh and try again." : undefined)}/>
    <Tabs id="service-catalog-sections" className="mt-5" ariaLabel="Catalog sections" items={[
      {id:"service-catalog-services-tab",label:`${config.terminology.service}s`,href:servicesCatalogHref({q:params.q,category:params.category}),active:!categoryTab},
      {id:"service-catalog-categories-tab",label:"Categories",href:closeHref,active:categoryTab,count:categories.length},
    ]}/>
    {categoryTab ? <div className="mt-4"><ServiceCategoryList categories={categories} canManage={canManage && !categoryResult.error} salon={salon} q={params.q} category={params.category}/></div> : <>
      <FilterBar id={salon ? "salon-treatments-filter-bar" : "services-filter-bar"}><form id={salon ? "salon-treatments-filter-form" : "services-filter-form"} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto]">
        <Input id={salon ? "salon-treatments-search-input" : "services-search-input"} aria-label={`Search ${config.terminology.service.toLowerCase()}s`} name="q" defaultValue={params.q} placeholder={`Search ${config.terminology.service.toLowerCase()} name`}/>
        <select id={salon ? "salon-treatments-category-filter" : "services-category-filter"} aria-label="Category" className="min-h-11 min-w-0 max-w-full rounded-ui-md border border-admin-border bg-white px-3" name="category" defaultValue={safeFilter ?? ""}><option value="">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <Button id={salon ? "salon-treatments-filter-button" : "services-filter-button"} type="submit" variant="secondary"><Search aria-hidden="true" size={16} className="shrink-0"/>Search</Button>
      </form></FilterBar>
      <div className="mt-4"><ServiceCatalogList services={services} salon={salon} canManage={canManage}/></div>
    </>}
    {params.dialog === "starter-services" && canManage && hasStarterCatalog(activeMembership.industry) ? <FormDialog id="starter-services-dialog" title="Add starter services" closeHref="/dashboard/services" size="lg">
      <p className="mb-4 text-sm text-admin-text-muted">Add these 10 services with editable sample prices. Existing services and prices are preserved. New services stay hidden from public booking until you publish them.</p>
      <RecordTable id="starter-services-preview" caption="Starter services" columns={[{key:"name",label:"Service"},{key:"duration",label:"Minutes",secondary:true},{key:"price",label:"Sample price",align:"right"}]} rows={starterServices[activeMembership.industry].map((service,index)=>({id:`starter-service-${index}`,cells:{name:service.name,duration:service.durationMinutes,price:formatMoney(service.priceCentavos)},mobile:<span>{service.durationMinutes} minutes</span>}))}/>
      <form id="starter-services-form" action={addStarterServices} className="mt-4"><FormActions id="starter-services-actions" cancelHref="/dashboard/services"><SubmitButton id="starter-services-add-button" pendingText="Adding services…"><ListPlus size={16} aria-hidden="true"/>Add starter services</SubmitButton></FormActions></form>
    </FormDialog> : null}
    {mode && canManage && !categoryResult.error ? <FormDialog id={`${prefix}-${mode}-dialog`} title={mode === "create" ? "Add category" : mode === "edit" ? "Edit category" : "Delete category"} closeHref={closeHref} size="md"><ServiceCategoryForm key={`${mode}-${selected?.id ?? "new"}`} mode={mode} category={selected} prefix={prefix} q={params.q} filterCategory={params.category} nextOrder={Math.min(9999, Math.max(-1, ...categories.map(category => category.sort_order)) + 1)}/></FormDialog> : null}
  </main>;
}


import { RecordLink } from "@/components/record-item";
import Link from "next/link";
import { RecordTable } from "@/components/record-table";
import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/page-patterns";
import { formatDuration, formatMoney } from "@/lib/operations";
import { servicesCatalogHref } from "@/lib/service-categories";
import type { CategoryRecord } from "@/components/service-category-form";

export type CatalogService = {
  currency?: string; id: string; name: string; short_description: string | null; duration_minutes: number; base_price_centavos: number; is_active: boolean; is_add_on: boolean;
  service_categories: { name: string } | { name: string }[] | null;
  service_branch_availability?: Array<{ is_available: boolean; branches: { name: string } | { name: string }[] | null }>;
};
function categoryName(service: CatalogService) { const category = Array.isArray(service.service_categories) ? service.service_categories[0] : service.service_categories; return category?.name ?? "Uncategorized"; }
function availabilityLabel(service: CatalogService) {
  const names = (service.service_branch_availability ?? []).filter(row => row.is_available).map(row => (Array.isArray(row.branches) ? row.branches[0] : row.branches)?.name).filter(Boolean);
  return names.length ? names.join(", ") : "All active branches";
}

export function ServiceCatalogList({ services, salon, canManage = false, currency = "PHP" }: { currency?: string; services: CatalogService[]; salon: boolean; canManage?: boolean }) {
  const prefix = salon ? "salon-treatment" : "service";
  if (!services.length) return <Card id={salon ? "salon-treatments-empty-state" : "services-empty-state"} elevation="none" className="p-8 text-center"><FolderOpen aria-hidden="true" className="mx-auto text-admin-text-muted"/><h2 className="mt-3 font-medium">No {salon ? "treatments" : "services"} found</h2><p className="mt-1 text-sm text-admin-text-muted">Add one using the button above, or change the current filters.</p></Card>;
  return <RecordTable id={salon ? "salon-treatments-table" : "services-table"} caption={salon ? "Treatments" : "Services"} columns={[
    {key:"service",label:salon?"Treatment":"Service"},{key:"category",label:"Category",secondary:true},...(canManage?[{key:"price",label:"Price / duration",secondary:true}]:[]),{key:"status",label:"Status",secondary:true},
    {key:"actions",label:canManage?"Actions":"Price",align:"right"},
  ]} rows={services.map(service => ({id:`${prefix}-row-${service.id}`,cells:{
    service:<><RecordLink id={`${prefix}-link-${service.id}`} href={`/dashboard/services/${service.id}`}>{service.name}</RecordLink>{service.short_description && <p className="mt-1 line-clamp-2 text-xs text-admin-text-muted">{service.short_description}</p>}<p className="mt-1 text-xs text-admin-text-muted">{availabilityLabel(service)}</p></>,
    category:categoryName(service),price:<><strong>{formatMoney(service.base_price_centavos, service.currency ?? currency)}</strong><p className="mt-1 text-xs">{formatDuration(service.duration_minutes)}</p></>,status:<StatusPill active={service.is_active}/>,
    actions:canManage?<Button asChild size="sm" variant="secondary"><Link id={`${prefix}-edit-${service.id}`} href={`/dashboard/services/${service.id}/edit`}><Pencil size={16} aria-hidden="true"/>Edit</Link></Button>:formatMoney(service.base_price_centavos, service.currency ?? currency),
  },mobile:<><p>{categoryName(service)}{service.is_add_on?" · Add-on":""}</p><p>{formatMoney(service.base_price_centavos, service.currency ?? currency)} · {formatDuration(service.duration_minutes)}</p><StatusPill active={service.is_active}/></>}))}/>;
}

export function ServiceCategoryList({ categories, canManage, salon, q, category: filterCategory }: { categories: CategoryRecord[]; canManage: boolean; salon: boolean; q?: string; category?: string }) {
  const prefix = salon ? "salon-treatment-category" : "service-category";
  const href = (dialog: string, categoryId?: string) => servicesCatalogHref({ tab: "categories", q, category: filterCategory, dialog, categoryId });
  return <Card id={`${prefix}-panel`} elevation="none" className="min-w-0 p-4 sm:p-5">
    <header id={`${prefix}-header`} className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div id={`${prefix}-header-content`} className="min-w-0 flex-1 basis-full sm:basis-64"><h2 className="font-medium">Categories <span className="font-normal text-admin-text-muted">({categories.length})</span></h2><p className="mt-1 text-sm text-admin-text-muted">Organize your catalog into clear, easy-to-find groups.</p></div>{canManage ? <Button id={`${prefix}-add-button`} className="ml-auto" asChild><Link href={href("category-create")}><Plus aria-hidden="true" size={16} className="shrink-0"/>Add category</Link></Button> : null}</header>
    <div id={`${prefix}-list`} className="mt-4"><RecordTable id={`${prefix}-table`} caption="Service categories" columns={[{key:"name",label:"Category"},{key:"count",label:salon?"Treatments":"Services",secondary:true},{key:"status",label:"Status",secondary:true},{key:"actions",label:canManage?"Actions":"Order",align:"right"}]} rows={categories.map(category=>({id:`${prefix}-${category.id}`,cells:{
      name:<RecordLink id={`${prefix}-link-${category.id}`} href={canManage?href("category-edit",category.id):servicesCatalogHref({category:category.id})}>{category.name}</RecordLink>,count:category.serviceCount,status:<StatusPill active={category.is_active}/>,
      actions:canManage?<div className="flex flex-wrap justify-end gap-2"><Button id={`${prefix}-edit-${category.id}`} asChild size="sm" variant="secondary"><Link href={href("category-edit",category.id)}><Pencil size={16} aria-hidden="true"/>Edit</Link></Button><Button id={`${prefix}-delete-${category.id}`} asChild size="sm" variant="outline" className="text-status-danger"><Link href={href("category-delete",category.id)}><Trash2 size={16} aria-hidden="true"/>Delete</Link></Button></div>:category.sort_order,
    },mobile:<><p>{category.serviceCount} {salon?"treatments":"services"} · Order {category.sort_order}</p><StatusPill active={category.is_active}/></>}))}/></div>
    {!categories.length ? <p id={`${prefix}-empty`} className="py-8 text-center text-sm text-admin-text-muted">No categories yet. {canManage ? "Add your first category using the button above." : "Your manager can add categories here."}</p> : null}
  </Card>;
}

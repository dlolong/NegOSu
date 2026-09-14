
import { RecordRow, RecordCard, RecordItem, RecordLink } from "@/components/record-item";
import Link from "next/link";
import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/page-patterns";
import { formatDuration, formatMoney } from "@/lib/operations";
import { servicesCatalogHref } from "@/lib/service-categories";
import type { CategoryRecord } from "@/components/service-category-form";

export type CatalogService = {
  id: string; name: string; short_description: string | null; duration_minutes: number; base_price_centavos: number; is_active: boolean; is_add_on: boolean;
  service_categories: { name: string } | { name: string }[] | null;
  service_branch_availability?: Array<{ is_available: boolean; branches: { name: string } | { name: string }[] | null }>;
};
function categoryName(service: CatalogService) { const category = Array.isArray(service.service_categories) ? service.service_categories[0] : service.service_categories; return category?.name ?? "Uncategorized"; }
function availabilityLabel(service: CatalogService) {
  const names = (service.service_branch_availability ?? []).filter(row => row.is_available).map(row => (Array.isArray(row.branches) ? row.branches[0] : row.branches)?.name).filter(Boolean);
  return names.length ? names.join(", ") : "All active branches";
}

export function ServiceCatalogList({ services, salon, canManage = false }: { services: CatalogService[]; salon: boolean; canManage?: boolean }) {
  const prefix = salon ? "salon-treatment" : "service";
  if (!services.length) return <Card id={salon ? "salon-treatments-empty-state" : "services-empty-state"} elevation="none" className="p-8 text-center"><FolderOpen aria-hidden="true" className="mx-auto text-admin-text-muted"/><h2 className="mt-3 font-semibold">No {salon ? "treatments" : "services"} found</h2><p className="mt-1 text-sm text-admin-text-muted">Add one using the button above, or change the current filters.</p></Card>;
  return <div className="min-w-0">
    <div id={salon ? "salon-treatments-table-container" : "services-table-container"} className="hidden min-w-0 rounded-ui-lg border border-admin-border bg-white xl:block">
      <table id={salon ? "salon-treatments-table" : "services-table"} className="w-full table-fixed text-left text-sm">
        <thead className="border-b border-admin-border text-xs text-admin-text-muted"><tr><th className="w-[34%] px-4 py-3">{salon ? "Treatment" : "Service"}</th><th className="w-[19%] px-3 py-3">Category</th><th className="w-[17%] px-3 py-3">Price / duration</th><th className="w-[15%] px-3 py-3">Status</th>{canManage ? <th className="w-[15%] px-4 py-3 text-right">Actions</th> : null}</tr></thead>
        <tbody className="divide-y divide-admin-border">{services.map(service => <RecordRow id={`${prefix}-row-${service.id}`} key={service.id}>
          <td className="px-4 py-4 [overflow-wrap:anywhere]"><RecordLink id={`${prefix}-link-${service.id}`} href={`/dashboard/services/${service.id}`}>{service.name}</RecordLink>{service.short_description ? <p className="mt-1 line-clamp-2 text-xs text-admin-text-muted">{service.short_description}</p> : null}<p className="mt-1 text-xs text-admin-text-muted">{availabilityLabel(service)}</p></td>
          <td className="px-3 py-4 [overflow-wrap:anywhere]">{categoryName(service)}</td>
          <td className="px-3 py-4 [overflow-wrap:anywhere]"><strong className="font-semibold">{formatMoney(service.base_price_centavos)}</strong><p className="mt-1 text-xs text-admin-text-muted">{formatDuration(service.duration_minutes)}</p></td>
          <td className="px-3 py-4"><StatusPill active={service.is_active}/>{service.is_add_on ? <p className="mt-2 text-xs text-admin-text-muted">Add-on</p> : null}</td>
          
          {canManage ? <td className="px-4 py-4 text-right"><Button asChild size="sm" variant="secondary"><Link id={`${prefix}-edit-${service.id}`} href={`/dashboard/services/${service.id}/edit`}><Pencil size={16} aria-hidden="true"/>Edit</Link></Button></td> : null}
        </RecordRow>)}</tbody>
      </table>
    </div>
    <div id={salon ? "salon-treatments-mobile-list" : "services-mobile-list"} className="grid min-w-0 gap-3 xl:hidden">{services.map(service => <RecordCard id={`${prefix}-card-${service.id}`} key={service.id} elevation="none" className="min-w-0 p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]"><RecordLink id={`${prefix}-link-mobile-${service.id}`} href={`/dashboard/services/${service.id}`}>{service.name}</RecordLink></h2><StatusPill active={service.is_active}/></div>
      <p className="mt-1 text-sm text-admin-text-muted [overflow-wrap:anywhere]">{categoryName(service)}{service.is_add_on ? " · Add-on" : ""}</p>
      {service.short_description ? <p className="mt-2 text-sm text-admin-text-secondary [overflow-wrap:anywhere]">{service.short_description}</p> : null}
      <p className="mt-2 text-xs text-admin-text-muted [overflow-wrap:anywhere]">{availabilityLabel(service)}</p>
      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-admin-border pt-3"><div className="min-w-0 [overflow-wrap:anywhere]"><strong>{formatMoney(service.base_price_centavos)}</strong><p className="text-xs text-admin-text-muted">{formatDuration(service.duration_minutes)}</p></div>{canManage ? <Button asChild size="sm" variant="secondary" className="ml-auto"><Link id={`${prefix}-edit-mobile-${service.id}`} href={`/dashboard/services/${service.id}/edit`}><Pencil size={16} aria-hidden="true"/>Edit</Link></Button> : null}</div>
    </RecordCard>)}</div>
  </div>;
}

export function ServiceCategoryList({ categories, canManage, salon, q, category: filterCategory }: { categories: CategoryRecord[]; canManage: boolean; salon: boolean; q?: string; category?: string }) {
  const prefix = salon ? "salon-treatment-category" : "service-category";
  const href = (dialog: string, categoryId?: string) => servicesCatalogHref({ tab: "categories", q, category: filterCategory, dialog, categoryId });
  return <Card id={`${prefix}-panel`} elevation="none" className="min-w-0 p-4 sm:p-5">
    <header id={`${prefix}-header`} className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div id={`${prefix}-header-content`} className="min-w-0 flex-1 basis-full sm:basis-64"><h2 className="font-semibold">Categories <span className="font-normal text-admin-text-muted">({categories.length})</span></h2><p className="mt-1 text-sm text-admin-text-muted">Organize your catalog into clear, easy-to-find groups.</p></div>{canManage ? <Button id={`${prefix}-add-button`} className="ml-auto" asChild><Link href={href("category-create")}><Plus aria-hidden="true" size={16} className="shrink-0"/>Add category</Link></Button> : null}</header>
    <ul id={`${prefix}-list`} className="mt-4 min-w-0 divide-y divide-admin-border">{categories.map(category => <RecordItem as="li" id={`${prefix}-${category.id}`} key={category.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-0"><h3 className="font-semibold [overflow-wrap:anywhere]"><RecordLink id={`${prefix}-link-${category.id}`} href={canManage ? href("category-edit", category.id) : servicesCatalogHref({ category: category.id })}>{category.name}</RecordLink></h3><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-admin-text-muted"><span>{category.serviceCount} {salon ? "treatments" : "services"}</span><span aria-hidden="true">·</span><span>Order {category.sort_order}</span><StatusPill active={category.is_active}/></div></div>
      {canManage ? <div className="ml-auto flex max-w-full flex-wrap justify-end gap-2"><Button id={`${prefix}-edit-${category.id}`} asChild size="sm" variant="secondary"><Link href={href("category-edit", category.id)}><Pencil aria-hidden="true" size={16} className="shrink-0"/>Edit</Link></Button><Button id={`${prefix}-delete-${category.id}`} asChild size="sm" variant="outline" className="text-status-danger"><Link href={href("category-delete", category.id)}><Trash2 aria-hidden="true" size={16} className="shrink-0"/>Delete</Link></Button></div> : null}
    </RecordItem>)}</ul>
    {!categories.length ? <p id={`${prefix}-empty`} className="py-8 text-center text-sm text-admin-text-muted">No categories yet. {canManage ? "Add your first category using the button above." : "Your manager can add categories here."}</p> : null}
  </Card>;
}

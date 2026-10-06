import { z } from "zod";
import { CatalogHistory } from "@/components/catalog-history";
import { PageHeader } from "@/components/page-patterns";
import { ServiceThumbnail } from "@/components/service-thumbnail";

import { Pencil as PencilIcon, Power as PowerIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { toggleService } from "@/app/dashboard/operations-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { formatDuration, formatMoney } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{
    q?: string; from?: string; to?: string; tab?: string;
    page?: string;
    message?: string;
    error?: string;
  }>;
}) {
  const [
    { serviceId },
    messageParams,
    { activeMembership },
    supabase,
  ] = await Promise.all([
    params,
    searchParams,
    getDashboardContext(),
    createClient(),
  ]);

  if (!z.uuid().safeParse(serviceId).success) notFound();
  const isSalon = activeMembership.industry === "salon";
  const canManage = ["owner", "manager"].includes(activeMembership.role);

  const [
    { data: service, error: serviceError },
    priceResult,
    { data: availability, error: availabilityError },
  ] = await Promise.all([
    supabase
      .from("services")
      .select(
        `
          id,
          name,
          description,
          thumbnail_url,
          duration_minutes,
          base_price_centavos,currency,
          is_active,
          is_public,
          is_add_on,
          code,
          service_categories(name)
        `,
      )
      .eq("id", serviceId)
      .eq("organization_id", activeMembership.organizationId)
      .maybeSingle(),

    activeMembership.industry !== "automotive"
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("service_prices")
          .select("vehicle_class, price_centavos, branches(name)")
          .eq("service_id", serviceId),

    supabase
      .from("service_branch_availability")
      .select("branches(name)")
      .eq("service_id", serviceId)
      .eq("is_available", true),
  ]);

  if (serviceError) return <main className="mx-auto min-w-0 max-w-5xl"><PageHeader id="service-detail-error-header" title={isSalon ? "Treatment details" : "Service details"}/><p role="alert" className="mt-4">Details could not be loaded. Please try again.</p></main>;

  if (!service) {
    notFound();
  }

  const category = Array.isArray(service.service_categories)
    ? service.service_categories[0]
    : service.service_categories;

  const { data: historyBranch } = await supabase.from("branches").select("timezone").eq("organization_id", activeMembership.organizationId).eq("id", activeMembership.branchId).maybeSingle();
  const prices = priceResult.data;
  const serviceLabel = isSalon ? "treatment" : "service";

  const availableBranches =
    availability
      ?.map((item) => {
        const branch = Array.isArray(item.branches)
          ? item.branches[0]
          : item.branches;

        return branch?.name;
      })
      .filter(Boolean)
      .join(", ") || "All active branches";

  return <main id={isSalon ? "salon-treatment-detail-page" : "service-detail-page"} className="mx-auto min-w-0 max-w-5xl [overflow-wrap:anywhere]">
    <PageHeader id="service-detail-header" title={service.name} description={`${category?.name ?? "Uncategorized"}`}
      action={canManage ? <Button id={isSalon ? "salon-treatment-edit-button" : "service-detail-edit-button"} asChild variant="secondary"><Link href={`/dashboard/services/${service.id}/edit`}><PencilIcon aria-hidden="true" size={16}/>Edit {serviceLabel}</Link></Button> : undefined}/>
    <FormMessage {...messageParams}/>
    <Card id="service-details" className="mt-4 grid min-w-0 gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:p-5">
      <div className="min-w-0"><ServiceThumbnail id="service-detail-photo" url={service.thumbnail_url} name={service.name}/></div>
      <div className="min-w-0">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">{[
          ["Base price", formatMoney(service.base_price_centavos, service.currency)],
          ["Duration", formatDuration(service.duration_minutes)],
          ["Type", service.is_add_on ? "Add-on" : isSalon ? "Treatment" : "Service"],
          ["Code", service.code || "Not set"],
          ["Status", service.is_active ? "Active" : "Inactive"],
          ["Website", service.is_public && service.is_active ? "Public" : "Private"],
        ].map(([label,value]) => <div key={label}><dt className="text-admin-text-secondary">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>
        <p className="mt-4 whitespace-pre-wrap text-sm">{service.description || "No description."}</p>
      </div>
    </Card>
    <Card id="service-availability" className="mt-4 p-4 sm:p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="font-medium">Availability</h2><p className="mt-2 text-sm text-admin-text-secondary" role={availabilityError ? "alert" : undefined}>{availabilityError ? "Availability could not be loaded." : availableBranches}</p></div>
        {canManage ? <form action={toggleService}>
          <input type="hidden" name="id" value={service.id}/><input type="hidden" name="active" value={String(!service.is_active)}/>
          <SubmitButton id="service-detail-toggle-button" variant={service.is_active ? "destructive" : "secondary"} pendingText="Updating…"><PowerIcon aria-hidden="true" size={16}/>{service.is_active ? `Deactivate ${serviceLabel}` : `Activate ${serviceLabel}`}</SubmitButton>
        </form> : null}
      </div>
    </Card>
    {activeMembership.industry === "automotive" ? <Card id="service-vehicle-pricing" className="mt-4 p-4 sm:p-5">
      <h2 className="font-medium">Vehicle pricing</h2>
      {priceResult.error ? <p role="alert" className="mt-3 text-sm">Vehicle pricing could not be loaded.</p> : <dl className="mt-3 space-y-3 text-sm">{prices?.map((price,index) => {
        const branch = Array.isArray(price.branches) ? price.branches[0] : price.branches;
        return <div key={index} className="flex flex-wrap justify-between gap-2"><dt>{price.vehicle_class?.replaceAll("_"," ") || "Branch base"}{branch ? ` · ${branch.name}` : ""}</dt><dd className="font-medium">{formatMoney(price.price_centavos,service.currency)}</dd></div>;
      })}{!prices?.length ? <div><dt className="text-admin-text-secondary">Every vehicle</dt><dd>Uses the base price.</dd></div> : null}</dl>}
    </Card> : null}
    <CatalogHistory db={supabase} scope={activeMembership} kind="service" recordId={serviceId} query={messageParams} timezone={historyBranch?.timezone ?? activeMembership.timezone}/>
  </main>;
}

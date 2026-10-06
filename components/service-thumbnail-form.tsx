"use client";

import { saveServiceThumbnail } from "@/app/dashboard/settings/public-page/actions";
import { CatalogPhotoField } from "@/components/catalog-photo-field";
import { SubmitButton } from "@/components/submit-button";

export function ServiceThumbnailForm({ service }: { service: { id: string; name: string; thumbnail_url: string | null } }) {
  return <form id={`service-thumbnail-form-${service.id}`} action={saveServiceThumbnail} className="min-w-0 space-y-3 pb-5">
    <input type="hidden" name="serviceId" value={service.id}/>
    <CatalogPhotoField idPrefix={`service-thumbnail-${service.id}`} initialUrl={service.thumbnail_url} name={service.name}/>
    <SubmitButton id={`service-thumbnail-save-${service.id}`} pendingText="Saving…">Save photo</SubmitButton>
  </form>;
}

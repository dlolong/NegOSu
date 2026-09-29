"use client";

import { ImageUploadButton } from "@/components/image-upload-field";
import { useState } from "react";
import { saveServiceThumbnail } from "@/app/dashboard/settings/public-page/actions";
import { ServiceThumbnail } from "@/components/service-thumbnail";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";

export function ServiceThumbnailForm({ service }: { service: { id: string; name: string; thumbnail_url: string | null } }) {
  const [url, setUrl] = useState(service.thumbnail_url ?? "");
  return <form id={`service-thumbnail-form-${service.id}`} action={saveServiceThumbnail} className="grid min-w-0 gap-4 pb-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
    <input type="hidden" name="serviceId" value={service.id}/>
    <ServiceThumbnail id={`service-thumbnail-preview-${service.id}`} url={url} name={service.name}/>
    <div className="min-w-0"><label htmlFor={`service-thumbnail-url-${service.id}`} className="text-sm font-medium">Thumbnail photo URL</label><input id={`service-thumbnail-url-${service.id}`} name="thumbnailUrl" type="url" maxLength={2048} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/service-photo.jpg" className="mt-2 min-h-11 w-full rounded-xl border border-admin-border bg-white px-3 text-sm"/>
      <p className="mt-2 text-xs text-admin-text-muted">Use a public image link. Landscape photos work best. Leave blank to remove the photo.</p>
      <ImageUploadButton id={`service-thumbnail-upload-${service.id}`} onUploaded={setUrl}/>
      <div className="mt-3 flex flex-wrap gap-2"><Button id={`service-thumbnail-clear-${service.id}`} type="button" variant="secondary" onClick={() => setUrl("")} disabled={!url}>Clear photo</Button><SubmitButton id={`service-thumbnail-save-${service.id}`} pendingText="Saving…">Save photo</SubmitButton></div>
    </div>
  </form>;
}

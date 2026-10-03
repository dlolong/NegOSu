"use client";

import { useState } from "react";
import { ImageUploadButton } from "@/components/image-upload-field";
import { ServiceThumbnail } from "@/components/service-thumbnail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CatalogPhotoField({ idPrefix, initialUrl, name, subject = "service" }: { idPrefix: string; initialUrl?: string | null; name: string; subject?: "service" | "product" }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  return <div className="col-span-full grid min-w-0 gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
    <ServiceThumbnail id={`${idPrefix}-preview`} url={url} name={name} subject={subject}/>
    <div className="min-w-0"><label htmlFor={`${idPrefix}-url`} className="text-sm font-medium">Photo URL (optional)</label><Input id={`${idPrefix}-url`} name="thumbnailUrl" type="url" maxLength={2048} value={url} onChange={event => setUrl(event.target.value)} className="mt-2" placeholder="https://example.com/photo.jpg" aria-describedby={`${idPrefix}-help`}/>
      <p id={`${idPrefix}-help`} className="mt-2 text-xs text-admin-text-muted">Upload a photo or paste a public image URL. Landscape photos work best. Leave blank to remove the photo.</p>
      <ImageUploadButton id={`${idPrefix}-upload`} onUploaded={setUrl}/>
      <Button id={`${idPrefix}-clear`} type="button" variant="secondary" className="mt-3" disabled={!url} onClick={() => setUrl("")}>Clear photo</Button>
    </div>
  </div>;
}

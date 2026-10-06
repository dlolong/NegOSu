"use client";

import { useState } from "react";
import { CatalogPhotoEditor } from "@/components/catalog-photo-editor";

export function CatalogPhotoField({ idPrefix, initialUrl, name, subject = "service", fieldName = "thumbnailUrl" }: { idPrefix: string; initialUrl?: string | null; name: string; subject?: "service" | "product" | "promo"; fieldName?: string }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  return <div className="col-span-full min-w-0">
    <input type="hidden" name={fieldName} value={url}/>
    <div className="max-w-xs"><CatalogPhotoEditor id={idPrefix} url={url} name={name} subject={subject} onSave={setUrl}/></div>
    <p className="mt-2 text-xs text-admin-text-muted">Photo changes are applied when you save this form.</p>
  </div>;
}

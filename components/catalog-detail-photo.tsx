"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CatalogPhotoEditor } from "@/components/catalog-photo-editor";
import { saveCatalogPhoto } from "@/app/dashboard/catalog/actions";

export function CatalogDetailPhoto({ id, recordId, url, name, subject }: { id: string; recordId: string; url: string | null; name: string; subject: "product" | "promo" | "service" }) {
  const [current, setCurrent] = useState(url);
  const router = useRouter();
  return <CatalogPhotoEditor id={id} url={current} name={name} subject={subject} saveLabel="Save photo" onSave={async next => {
    const result = await saveCatalogPhoto({ kind: subject, id: recordId, url: next, previousUrl: current });
    if (result.error) return result;
    setCurrent(next || null);
    router.refresh();
  }}/>;
}

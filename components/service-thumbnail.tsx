"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { resolveBusinessLogoUrl } from "@/modules/platform/business-branding";

export function ServiceThumbnail({ url, name, id, subject = "service", compact = false }: { url?: string | null; name: string; id: string; compact?: boolean; subject?: "service" | "product" | "promo" }) {
  const source = resolveBusinessLogoUrl(url);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <div id={id} className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-gradient-to-br from-brand-tint to-admin-surface-muted">
    {source && source !== failedSource ? <Image unoptimized src={source} alt={`${name} ${subject}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" referrerPolicy="no-referrer" onError={() => setFailedSource(source)}/> : <div className="flex h-full flex-col items-center justify-center gap-2 text-brand-primary-strong"><ImageIcon size={30} strokeWidth={1.25} aria-hidden="true"/><span className={compact ? "sr-only" : "text-xs"}>{source ? "Photo unavailable" : subject === "product" ? "Product preview" : subject === "promo" ? "Promo preview" : "Service preview"}</span></div>}
  </div>;
}

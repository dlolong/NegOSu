"use client";

import Image from "next/image";
import { useState } from "react";
import { businessInitials, resolveBusinessLogoUrl } from "@/modules/platform/business-branding";

export function BusinessIdentity({ name, logoUrl, inverse = false, className = "", id }: {
  name: string; logoUrl?: string | null; inverse?: boolean; className?: string; id?: string;
}) {
  const source = resolveBusinessLogoUrl(logoUrl);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <span id={id} className={`flex min-w-0 items-center gap-2.5 ${className}`}>
    {source && source !== failedSource ? <Image
      src={source} alt={`${name} logo`} width={44} height={44} unoptimized
      referrerPolicy="no-referrer" onError={() => setFailedSource(source)}
      className="size-11 shrink-0 rounded-ui-md border border-admin-border bg-white object-contain p-1"
    /> : <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-ui-md border border-admin-border bg-white text-base font-medium text-slate-800">{businessInitials(name)}</span>}
    <span title={name} className={`line-clamp-2 min-w-0 break-words text-sm font-medium leading-snug [overflow-wrap:anywhere] ${inverse ? "text-white" : "text-admin-text"}`}>{name}</span>
  </span>;
}

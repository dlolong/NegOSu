"use client";

import Image from "next/image";
import { useState } from "react";
import { resolveBusinessLogoUrl } from "@/modules/platform/business-branding";
import { resolvePublicHeroPosition } from "@/modules/platform/public-page-style";

export function PublicHeroMedia({ name, coverUrl, position, preview = false }: { name: string; coverUrl: string | null; position?: string | null; preview?: boolean }) {
  const source = resolveBusinessLogoUrl(coverUrl);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <div className="public-style-hero-media" aria-hidden="true">
    {source && source !== failedSource ? <Image src={source} alt="" fill unoptimized loading={preview ? "lazy" : "eager"} sizes="100vw" referrerPolicy="no-referrer" onError={() => setFailedSource(source)} style={{ objectPosition: resolvePublicHeroPosition(position), width: "100%", height: "100%" }} className="object-cover"/> : <div className="public-style-hero-placeholder"><span>{name}</span></div>}
  </div>;
}

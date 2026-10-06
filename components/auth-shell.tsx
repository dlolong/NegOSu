import { PageBackProvider } from "@/components/page-back";
import { PageTitle } from "@/components/page-title";
import Link from "next/link";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { BrandWordmark } from "@/components/brand-wordmark";
import { productBrand, marketingBrands, type MarketingVerticalKey } from "@/modules/platform/brand";

export function AuthShell({ title, description, children, footer, back, closeHref, industry, id = "negosu-auth-page" }: { title: string; description: string; children: ReactNode; footer?: ReactNode; back?: ReactNode; closeHref?: string; industry?: MarketingVerticalKey; id?: string }) {
  const vertical = industry ? marketingBrands[industry] : null;
  const homeHref = vertical?.path ?? "/";
  return (
    <main id={id} className="grid min-h-dvh place-items-center bg-slate-50 px-4 py-8 sm:px-5 sm:py-10">
      <section id={`${id}-card`} className="w-full max-w-md rounded-ui-lg border border-brand-border bg-white p-5 shadow-ui-md sm:p-7">
        <PageBackProvider>
        <div className="flex items-start justify-between gap-3">
        <Link id={`${id}-home-link`} href={homeHref} className="inline-flex flex-col items-start gap-1" aria-label={`${vertical?.displayName ?? productBrand.name} home`}>
          <BrandWordmark className="w-32" />
          {vertical ? <span className="text-xs font-medium tracking-wide text-zinc-500">{vertical.shortName}</span> : null}
        </Link>
        {closeHref ? <Link id={`${id}-close-button`} href={closeHref} aria-label="Close and return to home" title="Back to home" className="grid size-11 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"><X size={20} aria-hidden="true"/></Link> : null}
        </div>
        <PageTitle back={back} id={`${id}-title`} className="mt-7 text-2xl font-medium">{title}</PageTitle>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        {children}
        {footer ? <div id={`${id}-footer`} className="mt-6 text-center text-sm text-zinc-600">{footer}</div> : null}
        </PageBackProvider>
      </section>
    </main>
  );
}

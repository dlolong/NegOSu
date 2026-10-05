import { PageTitle } from "@/components/page-title";

import { ArrowLeft as ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="negosu-not-found-page" className="grid min-h-dvh place-items-center bg-slate-50 px-5">
      <section id="negosu-not-found-content" className="max-w-lg text-center">
        <p className="text-sm font-medium normal-case tracking-widest text-brand-primary-strong">404</p>
        <PageTitle back={<Button id="negosu-not-found-dashboard-button" asChild className=""><Link href="/dashboard"><ArrowLeftIcon aria-hidden="true" size={16} className="shrink-0"/>Back to dashboard</Link></Button>} className="mt-3 text-4xl font-medium tracking-tight text-brand-ink">We couldn&apos;t find that page.</PageTitle>
        <p className="mt-4 text-zinc-600">The link may be outdated, or the page may not be available yet.</p>

      </section>
    </main>
  );
}

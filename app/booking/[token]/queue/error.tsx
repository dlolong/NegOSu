"use client";

import { RefreshCw as RefreshCwIcon } from "lucide-react";

export default function ReservationQueueError({ reset }: { reset: () => void }) {
  return <main id="reservation-queue-error" className="grid min-h-dvh place-items-center bg-slate-950 p-6 text-white">
    <section className="max-w-lg text-center"><h1 className="text-2xl font-bold">Unable to load your reservation queue</h1>
      <p className="mt-3 text-slate-300">Please try again or contact the business.</p>
      <button type="button" id="reservation-queue-retry" onClick={reset} className="inline-flex items-center justify-center gap-2 mt-6 min-h-11 rounded-xl bg-white px-5 font-semibold text-slate-950"><RefreshCwIcon aria-hidden="true" size={16} className="shrink-0"/>Try again</button>
    </section>
  </main>;
}

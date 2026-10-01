"use client";
import {useLinkStatus} from "next/link";
export function LinkPending(){
 const {pending}=useLinkStatus();
 return pending?<span data-navigation-pending role="status" className="pointer-events-none absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-admin-surface text-brand-primary shadow-sm"><span aria-hidden="true" className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent"/><span className="sr-only">Loading page…</span></span>:null;
}

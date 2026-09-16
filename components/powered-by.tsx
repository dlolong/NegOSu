import { BrandWordmark } from "@/components/brand-wordmark";

export function PoweredBy({ inverse = false, className = "", id }: { inverse?: boolean; className?: string; id?: string }) {
  return <span id={id} className={`block text-xs font-normal ${inverse ? "text-slate-400" : "text-admin-text-muted"} ${className}`}><span className="inline-flex items-center gap-1.5 align-middle"><span>Powered by</span><BrandWordmark inverse={inverse} className="max-w-14 shrink-0"/></span></span>;
}

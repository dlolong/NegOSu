import { productBrand } from "@/modules/platform/brand";

export function PoweredBy({ inverse = false, className = "", id }: { inverse?: boolean; className?: string; id?: string }) {
  return <span id={id} className={`block text-xs font-normal ${inverse ? "text-slate-400" : "text-admin-text-muted"} ${className}`}>Powered by {productBrand.name}</span>;
}

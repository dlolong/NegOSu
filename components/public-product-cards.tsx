import { ServiceThumbnail } from "@/components/service-thumbnail";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/operations";
import type { PublicProduct } from "@/lib/public-booking";

export function PublicProductCards({ products }: { products: PublicProduct[] }) {
  if (!products.length) return null;
  return <section id="public-shop-products" aria-labelledby="public-shop-products-title" className="scroll-mt-[calc(6rem+env(safe-area-inset-top))] sm:scroll-mt-5">
    <h2 id="public-shop-products-title" className="text-3xl font-medium tracking-tight text-brand-ink">Products</h2>
    <p className="mt-2 text-sm text-admin-text-secondary">Explore our products. Contact the listed location for availability and purchases.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map(product => <Card key={product.id} id={`public-product-${product.id}`} elevation="none" className="min-w-0 p-4 sm:p-6 [overflow-wrap:anywhere]">
      <div className="mb-4"><ServiceThumbnail id={`public-product-photo-${product.id}`} url={product.thumbnailUrl} name={product.name} subject="product"/></div>
      {product.category ? <p className="text-xs font-medium text-brand-primary-strong">{product.category}</p> : null}
      <h3 className="mt-1 text-lg font-medium">{product.name}</h3>
      {product.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-admin-text-secondary">{product.description}</p> : null}
      <p className="mt-4 font-medium">{formatMoney(product.priceCentavos, product.currency)} <span className="text-sm font-normal text-admin-text-secondary">/ {product.unit}</span></p>
      <a id={`public-product-location-${product.id}`} href={`#public-automotive-shop-branch-${product.branchId}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-brand-primary-strong underline">{product.branchName}</a>
    </Card>)}</div>
  </section>;
}

import { AddToPublicBasket, PublicBasketLink } from "@/components/public-basket-button";
import { PublicCardRow } from "@/components/public-card-row";
import { ServiceThumbnail } from "@/components/service-thumbnail";
import { RecordCard, RecordLink } from "@/components/record-item";
import { formatMoney } from "@/lib/operations";
import type { PublicProduct } from "@/lib/public-booking";

export function PublicProductCards({ products, slug }: { products: PublicProduct[]; slug: string }) {
  if (!products.length) return null;
  const groups = new Map<string | null, PublicProduct[]>();
  for (const product of products) {
    const category = product.category?.trim() || null;
    groups.set(category, [...(groups.get(category) ?? []), product]);
  }
  return <section id="public-shop-products" aria-labelledby="public-shop-products-title" className="scroll-mt-[calc(6rem+env(safe-area-inset-top))] sm:scroll-mt-5">
    <h2 id="public-shop-products-title" className="text-3xl font-medium tracking-tight text-brand-ink">Products</h2>
    <p className="mt-2 text-sm text-admin-text-secondary">Explore our products and submit an order. Staff will confirm availability and arrange payment.</p>
    <div className="mt-4"><PublicBasketLink slug={slug}/></div>
    <div className="mt-6 min-w-0 space-y-8">{[...groups].map(([category, items]) => {
      const label = category ?? "Other products";
      const id = `public-product-category-${category === null ? "uncategorized" : `named-${encodeURIComponent(category)}`}`;
      return <section key={id} aria-labelledby={`${id}-title`} className="min-w-0">
        <h3 id={`${id}-title`} className="mb-2 text-xl font-medium text-brand-ink">{label} <span className="text-sm font-normal text-admin-text-secondary">({items.length})</span></h3>
        <PublicCardRow id={`${id}-row`} label={label}>{items.map(product => <RecordCard key={product.id} id={`public-product-${product.id}`} elevation="none" className="flex min-w-0 flex-col p-4 sm:p-5 [overflow-wrap:anywhere]">
      <div className="mb-4"><ServiceThumbnail id={`public-product-photo-${product.id}`} url={product.thumbnailUrl} name={product.name} subject="product"/></div>
      {product.category ? <p className="text-xs font-medium text-brand-primary-strong">{product.category}</p> : null}
      <h4 className="mt-1 text-xl font-medium"><RecordLink id={`public-product-order-${product.id}`} href={`/shop/${encodeURIComponent(slug)}/products/${product.id}`}>{product.name}</RecordLink></h4>
      {product.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-admin-text-secondary">{product.description}</p> : null}
      <p className="mt-auto pt-4 font-medium">{formatMoney(product.priceCentavos, product.currency)} <span className="text-sm font-normal text-admin-text-secondary">/ {product.unit}</span></p>
      <a id={`public-product-location-${product.id}`} href={`#public-automotive-shop-branch-${product.branchId}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-brand-primary-strong underline">{product.branchName}</a>
      <AddToPublicBasket slug={slug} product={product}/>
    </RecordCard>)}</PublicCardRow>
      </section>;
    })}</div>
  </section>;
}

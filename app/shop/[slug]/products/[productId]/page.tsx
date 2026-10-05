import { PageTitle } from "@/components/page-title";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PublicShop } from "@/lib/public-booking";
import { formatMoney } from "@/lib/operations";
import { AddToPublicBasket, PublicBasketLink } from "@/components/public-basket-button";
import { ServiceThumbnail } from "@/components/service-thumbnail";
import { Card } from "@/components/ui/card";
export default async function Page({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params, db = await createClient();
  const { data, error } = await db.rpc("get_public_shop", { p_slug: slug });
  const shop = data as PublicShop | null;
  if (error) return <main className="mx-auto max-w-xl p-6"><p role="alert">Unable to load this product. Please refresh or contact the business.</p></main>;
  const product = shop?.products?.find(p => p.id === productId);
  if (!shop || !product) notFound();
  return <main id="public-product-order-page" className="mx-auto min-w-0 max-w-2xl p-4 sm:p-6">
    
    <PageTitle back={<Link id="public-product-order-back" href={`/shop/${encodeURIComponent(shop.slug)}#public-shop-products`} className="inline-flex min-h-11 items-center text-sm underline">Back to {shop.name}</Link>} className="text-2xl font-medium">{product.name}</PageTitle><Card className="mt-3 min-w-0 p-4 sm:p-6"><div className="mb-5 min-w-0 [overflow-wrap:anywhere]"><ServiceThumbnail id="public-product-order-photo" url={product.thumbnailUrl} name={product.name} subject="product"/><p className="mt-2">{formatMoney(product.priceCentavos, product.currency)} / {product.unit} · {product.branchName}</p>{product.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-admin-text-secondary">{product.description}</p> : null}</div><AddToPublicBasket slug={shop.slug} product={product}/><div className="mt-3"><PublicBasketLink slug={shop.slug}/></div></Card>
  </main>;
}

import { loadPublicBusiness } from "@/lib/public-business";
import { businessMetadata } from "@/modules/platform/business-branding";
import { resolvePublicPageTheme } from "@/modules/platform/public-page-theme";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const business = await loadPublicBusiness((await params).slug);
  return businessMetadata(business?.name ?? "Business unavailable", business?.logoUrl);
}

export default async function BusinessPageLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const business = await loadPublicBusiness((await params).slug);
  return <div id="public-business-theme" data-public-theme={resolvePublicPageTheme(business?.theme)} className="min-h-dvh bg-admin-canvas text-admin-text">{children}</div>;
}

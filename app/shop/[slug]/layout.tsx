import { loadPublicBusiness } from "@/lib/public-business";
import { businessMetadata } from "@/modules/platform/business-branding";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const business = await loadPublicBusiness((await params).slug);
  return businessMetadata(business?.name ?? "Business unavailable", business?.logoUrl);
}

export default function BusinessPageLayout({ children }: { children: React.ReactNode }) {
  return children;
}

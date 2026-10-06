import { ServiceThumbnail } from "@/components/service-thumbnail";

export function CatalogItemThumbnail({ id, url, name, subject = "service" }: { id: string; url?: string | null; name: string; subject?: "service" | "product" | "promo" }) {
  return <span className="block w-16 shrink-0"><ServiceThumbnail id={id} url={url} name={name} subject={subject} compact/></span>;
}

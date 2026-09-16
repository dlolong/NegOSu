import { MapPin, Navigation } from "lucide-react";
import { locationMapLinks } from "@/lib/location-map";
import { Button } from "@/components/ui/button";

export function LocationMap({ id, name, address, mapUrl, compact = false }: {
  id: string; name: string; address: readonly (string | null)[]; mapUrl?: string | null; compact?: boolean;
}) {
  const { embedUrl, directionsUrl } = locationMapLinks(mapUrl, name, address);
  if (!embedUrl && !directionsUrl) return null;
  return <div id={id} className="min-w-0">
    {embedUrl ? <iframe id={`${id}-frame`} src={embedUrl} title={`Location map for ${name}`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen
      className={`block w-full min-w-0 rounded-ui-lg border border-admin-border bg-admin-surface-muted ${compact?"h-56":"h-64 sm:h-72"}`} /> : null}
    {directionsUrl ? <div className={embedUrl?"mt-3 flex flex-wrap items-center justify-between gap-2":"flex flex-wrap gap-2"}>
      {embedUrl&&!compact?<span className="inline-flex items-center gap-1.5 text-xs text-admin-text-secondary"><MapPin size={14} aria-hidden="true"/>Explore the map or get directions</span>:null}
      <Button asChild variant="secondary" size="sm"><a id={`${id}-directions`} href={directionsUrl} target="_blank" rel="noopener noreferrer"><Navigation size={16} aria-hidden="true"/>Get directions</a></Button>
    </div>:null}
  </div>;
}

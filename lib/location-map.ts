/** Only the URL is retained from copied map HTML; markup is never rendered. */
export function normalizeMapInput(input: string): string | null {
  const value = input.trim();
  if (!value) return "";
  if (value.length > 8000) return null;
  if (!value.startsWith("<")) return mapEmbedUrl(value) ?? safeMapLink(value);
  const frame = value.match(/^<iframe\b[^>]*\s+src\s*=\s*(["'])(.*?)\1[^>]*>\s*<\/iframe>$/is);
  if (!frame) return null;
  const source = frame[2].replaceAll("&amp;", "&");
  return mapEmbedUrl(source);
}

export function safeMapLink(input?: string | null): string | null {
  if (!input || input.length > 8000) return null;
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

/** Only Google's consumer Share → Embed a map URL may become an iframe src. */
export function mapEmbedUrl(input?: string | null): string | null {
  const safe = safeMapLink(input);
  if (!safe) return null;
  const url = new URL(safe);
  if (url.protocol !== "https:" || url.port || !["www.google.com", "google.com", "maps.google.com"].includes(url.hostname)
    || url.pathname !== "/maps/embed" || !url.searchParams.get("pb")) return null;
  // Strip unrelated parameters/fragments; API keys and executable markup are not accepted.
  const embed = new URL("https://www.google.com/maps/embed");
  embed.searchParams.set("pb", url.searchParams.get("pb")!);
  return embed.href;
}

export function locationMapLinks(mapUrl: string | null | undefined, name: string, address: readonly (string | null)[]) {
  const embedUrl = mapEmbedUrl(mapUrl);
  const external = safeMapLink(mapUrl);
  const destination = address.filter(part => part?.trim()).join(", ");
  const directions = destination ? `https://www.google.com/maps/dir/?${new URLSearchParams({api:"1",destination:[name,destination].filter(Boolean).join(", ")})}` : null;
  return { embedUrl, directionsUrl: external && !embedUrl ? external : directions ?? external };
}

export const queueDisplayResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Cookie",
  "Referrer-Policy": "no-referrer",
} as const;

export function privateEstimateResponseHeaders(pathname:string){
  if (/^\/(?:api\/)?booking\/[^/]+\/queue(?:\/|$)/.test(pathname)) return queueDisplayResponseHeaders;
  if (/^\/shop\/[^/]+\/queue(?:\/|$)/.test(pathname) || pathname.startsWith("/api/public/queue/")) return queueDisplayResponseHeaders;
  if (pathname.startsWith("/display/queue/") || pathname.startsWith("/api/queue-display/")) return queueDisplayResponseHeaders;
  if(!pathname.startsWith("/estimate/"))return null;
  return{
    "Cache-Control":"private, no-store, max-age=0",
    Pragma:"no-cache",
    "X-Robots-Tag":"noindex, nofollow, noarchive",
  } as const;
}

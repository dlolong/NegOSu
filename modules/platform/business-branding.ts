import type { Metadata } from "next";
import { z } from "zod";

export function resolveBusinessLogoUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export const businessLogoUrlSchema = z.string().trim().max(2048).refine(
  value => value === "" || resolveBusinessLogoUrl(value) !== null,
  "Use a public HTTP or HTTPS image URL without embedded credentials.",
);

export function businessInitials(name: string): string {
  return name.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join("").toUpperCase() || "B";
}

export function businessMetadata(name: string, logoUrl?: string | null, page?: string): Metadata {
  const title = page ? `${page} | ${name}` : name;
  return {
    title: { absolute: title, template: `%s | ${name}` },
    applicationName: name,
    referrer: "no-referrer",
    description: `Welcome to ${name}.`,
    icons: { icon: resolveBusinessLogoUrl(logoUrl) ?? "/images/business-favicon.svg" },
    openGraph: { title, siteName: name, description: `Welcome to ${name}.`, images: [] },
    twitter: { card: "summary", title, description: `Welcome to ${name}.`, images: [] },
    keywords: [],
  };
}

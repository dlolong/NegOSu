import { dashboardThemeIds, dashboardThemes } from "./dashboard-theme";

export const publicPageThemeIds = ["classic", ...dashboardThemeIds, "crimson"] as const;
export type PublicPageThemeId = (typeof publicPageThemeIds)[number];

export const publicPageThemes = [
  { id: "classic", name: "Classic", description: "The original bright blue public page.", swatches: ["#071a45", "#0062dc", "#edf6ff"] },
  ...dashboardThemes,
  { id: "crimson", name: "Crimson", description: "Rich red accents and soft blush surfaces.", swatches: ["#310c13", "#b50924", "#fff1f2"] },
] as const;

export function isPublicPageTheme(value: unknown): value is PublicPageThemeId {
  return typeof value === "string" && publicPageThemeIds.includes(value as PublicPageThemeId);
}

export function resolvePublicPageTheme(value: unknown): PublicPageThemeId {
  return isPublicPageTheme(value) ? value : "classic";
}

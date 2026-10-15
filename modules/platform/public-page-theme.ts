import { dashboardThemeIds, dashboardThemes } from "./dashboard-theme";

export const publicPageThemeIds = ["classic", ...dashboardThemeIds] as const;
export type PublicPageThemeId = (typeof publicPageThemeIds)[number];

export const publicPageThemes = [
  { id: "classic", name: "Classic", description: "The original bright blue public page.", swatches: ["#071a45", "#0062dc", "#edf6ff"] },
  ...dashboardThemes,
] as const;

export function isPublicPageTheme(value: unknown): value is PublicPageThemeId {
  return typeof value === "string" && publicPageThemeIds.includes(value as PublicPageThemeId);
}

export function resolvePublicPageTheme(value: unknown): PublicPageThemeId {
  return isPublicPageTheme(value) ? value : "classic";
}

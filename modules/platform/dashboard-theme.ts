export const dashboardThemeIds = ["blue", "plum", "teal", "graphite", "indigo"] as const;

export type DashboardThemeId = (typeof dashboardThemeIds)[number];
export type DashboardThemeOption = {
  id: DashboardThemeId;
  name: string;
  description: string;
  swatches: readonly [string, string, string];
};

export const dashboardThemes: readonly DashboardThemeOption[] = [
  { id: "blue", name: "Steel Blue", description: "Cool blue accents with a dark slate base.", swatches: ["#172331", "#2459a9", "#edf3fb"] },
  { id: "plum", name: "Plum", description: "Rich plum accents with soft blush surfaces.", swatches: ["#352536", "#85466d", "#f8edf3"] },
  { id: "teal", name: "Teal", description: "Fresh teal accents with pale mint surfaces.", swatches: ["#173735", "#087d72", "#eaf7f2"] },
  { id: "graphite", name: "Graphite", description: "Neutral slate tones with subtle gray accents.", swatches: ["#172033", "#475569", "#f1f5f9"] },
  { id: "indigo", name: "Indigo", description: "Vivid indigo accents with a deep violet base.", swatches: ["#1e1b4b", "#4f46e5", "#eef2ff"] },
];

export function isDashboardTheme(value: unknown): value is DashboardThemeId {
  return typeof value === "string" && dashboardThemeIds.includes(value as DashboardThemeId);
}

export function resolveDashboardTheme(value: unknown): DashboardThemeId {
  if (isDashboardTheme(value)) return value;
  // Read old metadata without keeping retired themes in the save allowlist.
  switch (value) {
    case "salon": return "plum";
    case "pet_care":
    case "emerald": return "teal";
    // Former blue palettes and automatic preferences share the generic default.
    default: return "blue";
  }
}

import React from "react";
import { createRoot } from "react-dom/client";
import { PublicPageThemeForm } from "@/components/public-page-theme-form";
import { resolvePublicPageTheme, type PublicPageThemeId } from "@/modules/platform/public-page-theme";

const root = createRoot(document.getElementById("root")!);
function render(preference: PublicPageThemeId) {
  root.render(<div id="workspace" data-dashboard-theme="indigo"><PublicPageThemeForm key={preference} preference={preference}/></div>);
}
Object.assign(window, { recordFormAction: async (_action: string, entries: [string, string][]) => {
  const saved = resolvePublicPageTheme(new Map(entries).get("publicPageTheme"));
  document.body.dataset.savedTheme = saved;
  await new Promise(resolve => setTimeout(resolve, 250));
  // Simulate the refreshed server preference after a successful redirect.
  render(saved);
} });
render("classic");

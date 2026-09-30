import { createRoot } from "react-dom/client";
import { SettingsNavigation } from "@/components/settings-navigation";
import { BranchForm } from "@/components/crm-forms";
import { BusinessBrandingForm } from "@/components/business-branding-form";
import { WorkspaceThemeForm } from "@/components/workspace-theme-form";

const params = new URLSearchParams(location.search);
const mode = params.get("mode");
createRoot(document.getElementById("root")!).render(<div id="settings-workspace" className="space-y-6">
  <SettingsNavigation industry={params.get("industry") ?? "automotive"}/>
  {mode === "branch" ? <BranchForm/> : mode === "branding" ? <BusinessBrandingForm name="Example business" logoUrl={null}/> : mode === "theme" ? <WorkspaceThemeForm preference="blue"/> : null}
</div>);

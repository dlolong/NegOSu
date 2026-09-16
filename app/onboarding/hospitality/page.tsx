import { redirect } from "next/navigation";

// Preserve old setup bookmarks through the shared organization/branch workflow.
export default function HospitalitySetupRedirect() {
  redirect("/onboarding/business");
}

import { createRoot } from "react-dom/client";
import { FormDialog } from "@/components/management-ui";
import { PermissionMatrix, StaffAccessForm, StaffProfileForm, type StaffProfileRow } from "@/components/staff-management";

const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "grant";
const industry = params.get("industry") === "automotive" ? "automotive" : "salon";
const branches = [{ id: "branch-one", name: "Main branch" }, { id: "branch-two", name: "SecondBranch".repeat(6) }];
const profile: StaffProfileRow = {
  id: "staff-one", organizationId: "organization-one", fullName: "Ana Santos", jobFunction: null,
  specializations: [], isActive: true, branchIds: ["branch-one"], hasLogin: mode === "manage",
  membershipId: mode === "manage" ? "membership-one" : null, userId: null, email: "ana@example.test", mobile: null,
  systemAccessStatus: mode === "manage" ? "active" : mode === "replace" ? "pending" : "none",
  role: "viewer", accessBranchIds: ["branch-one"], createdAt: "2026-09-14T00:00:00Z",
};
createRoot(document.getElementById("root")!).render(
  mode === "permissions" ? <PermissionMatrix industry={industry} prefix="staff"/> : <FormDialog id="staff-dialog" title={mode === "profile" ? "Edit Staff profile" : `${mode === "manage" ? "Manage" : "Grant"} system access`} description="Set login permissions for Ana Santos without changing the Staff profile." closeHref="/dashboard/settings/staff" size={mode === "profile" ? "lg" : "md"}>
    {mode === "profile" ? <StaffProfileForm profile={profile} branches={branches} industry={industry} prefix="staff"/> : <StaffAccessForm profile={profile} branches={branches} industry={industry} prefix="staff"/>}
  </FormDialog>,
);

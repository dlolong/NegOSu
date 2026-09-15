import { createClient } from "@supabase/supabase-js";
import { installStarterServices } from "../modules/core/catalog/install-starter-services";
import { starterServices, hasStarterCatalog } from "../modules/core/catalog/starter-services";
import { assertQaSeedSafety, parseQaSeedMode } from "./qa-seed-safety";

async function main() {
  const args = process.argv.slice(2), mode = parseQaSeedMode(args);
  assertQaSeedSafety({ mode, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, nodeEnv: process.env.NODE_ENV, vercelEnv: process.env.VERCEL_ENV, qaSeedTarget: process.env.QA_SEED_TARGET, allowRemoteDevelopment: process.env.QA_SEED_ALLOW_REMOTE_DEVELOPMENT, confirmation: process.env.QA_SEED_CONFIRM });
  const ids = args.filter(arg => arg.startsWith("--organization=")).map(arg => arg.slice("--organization=".length));
  if (!args.includes("--all") && !ids.length) throw new Error("Select --all or --organization=<uuid>.");
  if (ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw new Error("Invalid organization ID.");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  let query = db.from("organizations").select("id,industry").eq("status", "active");
  if (ids.length) query = query.in("id", ids);
  const organizations = await query;
  if (organizations.error) throw new Error("Unable to read workspaces.");
  for (const org of organizations.data ?? []) {
    if (!hasStarterCatalog(org.industry)) continue;
    if (mode === "dry-run") { console.log(`${org.industry}: ${starterServices[org.industry].length} starter services available; no changes made.`); continue; }
    const result = await installStarterServices(db, { organizationId: org.id, role: "owner" });
    if (result.error) throw new Error(`${org.industry}: ${result.error}`);
    console.log(`${org.industry}: added ${result.added} services.`);
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Starter catalog installation failed."); process.exitCode = 1; });

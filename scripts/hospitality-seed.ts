/** Local-only, additive synthetic fixtures. Never reads .env.local implicitly. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (process.env.NODE_ENV === "production" || !["127.0.0.1", "localhost", "::1"].includes(new URL(url).hostname)) throw new Error("Hospitality fixtures require a local Supabase URL.");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const password = "NegOSu-Local-QA-2026!";
const id = (n: number) => `b9600000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function must<T>(call: PromiseLike<{ data: T; error: unknown }>): Promise<T> { const r = await call; if (r.error) throw r.error; return r.data; }
async function user(label: string) {
  const email = `qa.hospitality.${label}@negosu.local.test`;
  const list = await admin.auth.admin.listUsers({ perPage: 1000 }); if (list.error) throw list.error;
  let person = list.data.users.find(u => u.email === email);
  if (!person) { const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `QA Inn ${label}` } }); if (created.error) throw created.error; person = created.data.user; }
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await db.auth.signInWithPassword({ email, password }); if (login.error) throw login.error;
  return { id: person.id, db, email };
}
async function rpc(db: SupabaseClient, name: string, params: Record<string, unknown>) { return must(db.rpc(name, params)); }
async function main() {
  await user("setup");
  const cashier = await user("cashier");
  const housekeeper = await user("housekeeper");
  const owner = await user("owner"), other = await user("other"), viewer = await user("viewer"), frontDesk = await user("frontdesk");
  async function workspace(person: Awaited<ReturnType<typeof user>>, name: string, branchName: string, slug: string) {
    const existing = await must(admin.from("organizations").select("id").eq("created_by", person.id).eq("industry", "hospitality").eq("name", name).maybeSingle());
    const orgId = existing?.id ?? await rpc(person.db, "create_first_organization", { p_name: name, p_industry: "hospitality", p_business_type: "inn", p_slug_base: slug });
    const branches = await must(admin.from("branches").select("id").eq("organization_id", orgId).limit(1));
    if (!branches?.length) await rpc(person.db, "create_initial_branch", { p_organization_id: orgId, p_name: branchName, p_address_line: "Synthetic local fixture", p_city: "Test city", p_province: "Test province" });
    return orgId;
  }
  const org = await workspace(owner, "QA Apartelle & Inn", "Main branch", "qa-apartelle-inn");
  const otherOrg = await workspace(other, "QA Other Inn", "Other branch", "qa-other-inn");
  const branch = (await must(admin.from("branches").select("id").eq("organization_id", org).eq("is_primary", true).single()))!.id;
  await must(admin.from("organization_memberships").upsert({ organization_id: otherOrg, user_id: owner.id, role: "owner", is_active: true }, { onConflict: "organization_id,user_id" }));
  const otherBranch = (await must(admin.from("branches").select("id").eq("organization_id", otherOrg).eq("is_primary", true).single()))!.id;
  // Synthetic local paid fixture enables a second branch. Production catalog is untouched.
  await must(admin.from("organization_subscriptions").update({ plan_id: "multi_branch", status: "active" }).eq("organization_id", org));
  await must(admin.from("branches").upsert({ id: id(3), organization_id: org, name: "Annex", timezone: "Asia/Manila", is_primary: false }));
  for (const [person, role] of [[viewer, "viewer"], [frontDesk, "advisor"], [cashier, "cashier"], [housekeeper, "technician"]] as const) {
    await must(admin.from("organization_memberships").upsert({ organization_id: org, user_id: person.id, role, is_active: true }, { onConflict: "organization_id,user_id" }));
  }
  await must(admin.from("customers").upsert(Array.from({ length: 6 }, (_, i) => ({ id: id(10 + i), organization_id: org, full_name: ["Unpriced Guest", "Unpaid Guest", "Partial Guest", "Paid Guest", "Departed Guest", "Zero Charge Guest"][i], phone: null, email: null }))));
  await must(admin.from("customers").upsert({ id: id(19), organization_id: otherOrg, full_name: "Other tenant guest" }));
  await must(admin.from("hospitality_rooms").upsert(Array.from({ length: 9 }, (_, i) => ({ id: id(30 + i), organization_id: org, branch_id: branch, name: `Room ${101 + i}`, capacity: 2, is_active: i !== 8 }))));
  await must(admin.from("hospitality_rooms").upsert([{ id: id(39), organization_id: otherOrg, branch_id: otherBranch, name: "Other room", capacity: 2 }, { id: id(40), organization_id: org, branch_id: id(3), name: "Annex room", capacity: 2 }]));
  await must(admin.from("organization_staff_profiles").upsert([{ id: id(50), organization_id: org, full_name: "QA Caretaker", job_function: "Caretaker", mobile: null, email: null, is_active: true }, { id: id(51), organization_id: org, full_name: "QA Receptionist", job_function: "Receptionist", mobile: null, email: null, is_active: true }]));
  const stays: string[] = [];
  for (let i = 0; i < 6; i++) {
    // Retain explicit legacy unpriced/zero/partial fixtures for backward-compatibility checks.
    const existing = await must(admin.from("hospitality_stays").select("id").eq("organization_id", org).eq("request_key", id(60 + i)).maybeSingle());
    const stay = existing?.id ?? (await must(admin.from("hospitality_stays").insert({ organization_id: org, branch_id: branch, room_id: id(30 + i), guest_id: id(10 + i), occupants: 1, room_name_snapshot: `Room ${101 + i}`, guest_name_snapshot: ["Unpriced Guest", "Unpaid Guest", "Partial Guest", "Paid Guest", "Departed Guest", "Zero Charge Guest"][i], notes: "Local synthetic fixture", created_by: owner.id, request_key: id(60 + i) }).select("id").single()))!.id;
    if (i > 0) await rpc(owner.db, "add_hospitality_charge", { p_org: org, p_branch: branch, p_stay: stay, p_description: "Accommodation", p_quantity: 1, p_unit_centavos: i === 5 ? 0 : 100000, p_request: id(60 + i) });
    stays.push(stay);
    if (i === 2 || i === 3) { const bill = await must(owner.db.from("hospitality_stay_bills").select("invoice_id").eq("stay_id", stay).single()); await rpc(owner.db, "record_invoice_collection", { p_invoice_id: bill!.invoice_id, p_amount_centavos: i === 2 ? 40000 : 100000, p_method: "cash", p_request_key: id(70 + i) }); }
    if (i === 4) await rpc(owner.db, "check_out_hospitality", { p_org: org, p_branch: branch, p_stay: stay, p_acknowledge_debt: true });
  }
  for (let i = 0; i < 2; i++) {
    await must(admin.from("inventory_items").upsert({ id: id(80 + i), organization_id: org, branch_id: branch, name: i ? "Bottled water" : "Guest toiletries", sku: `QA-INN-${i}`, unit: "piece", reorder_level: 5, is_active: true }));
    const movements = await must(admin.from("inventory_movements").select("id").eq("inventory_item_id", id(80 + i)).limit(1));
    if (!movements?.length) await rpc(owner.db, "record_inventory_movement", { p_item_id: id(80 + i), p_type: "opening", p_quantity: i ? 2 : 30, p_note: "Local synthetic opening stock", p_idempotency_key: `hospitality-opening-${i}` });
  }
  for (const roomId of Array.from({ length: 11 }, (_, i) => id(30 + i))) {
    const r = await must(admin.from("hospitality_rooms").select("id,rates").eq("id", roomId).single());
    if (!r!.rates.length) await must(admin.from("hospitality_rooms").update({ rates_version: 1, rates: [180,360,720,1440,10080].map((durationMinutes, i) => ({ id: crypto.randomUUID(), label: ["3 hours", "6 hours", "12 hours", "Daily", "Weekly"][i], durationMinutes, priceCentavos: [100000,150000,200000,300000,1500000][i] })) }).eq("id", roomId));
  }
  const fixture = { org, branch, otherOrg, otherBranch, annex: id(3), owner: owner.id, viewer: viewer.id, frontDesk: frontDesk.id, cashier: cashier.id, housekeeper: housekeeper.id, other: other.id, stays };
  await writeFile("/private/tmp/negosu-hospitality-fixture.json", JSON.stringify(fixture));
  console.log("Local Hospitality fixtures ready. Login: qa.hospitality.owner@negosu.local.test. Fixture IDs: /private/tmp/negosu-hospitality-fixture.json");
}
main().catch(error => { console.error("Hospitality fixture failed:", error); process.exitCode = 1; });

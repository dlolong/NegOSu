import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { servicesCatalogHref, writeServiceCategory } from "../lib/service-categories";
import { dashboardBackDestination } from "../lib/dashboard-back-navigation";

const id = "72000000-0000-4000-8000-000000000001";
const actor = { organizationId: "22000000-0000-4000-8000-000000000001", role: "owner" };
function database(data: unknown = { id }, error: unknown = null) {
  const calls: Array<[string, ...unknown[]]> = [];
  const query: Record<string, (...args: unknown[]) => unknown> = Object.fromEntries(["from", "insert", "update", "delete", "eq", "select"].map(name => [name, (...args: unknown[]) => { calls.push([name, ...args]); return query; }]));
  query.maybeSingle = async () => ({ data, error });
  return { db: query as unknown as SupabaseClient, calls };
}

test("category creation validates values and uses the server-resolved organization", async () => {
  const { db, calls } = database();
  assert.deepEqual(await writeServiceCategory(db, actor, { id: "", name: " Hair care ", sortOrder: "2", isActive: true, organizationId: "foreign" }), {});
  assert.deepEqual(calls.find(([name]) => name === "insert"), ["insert", { organization_id: actor.organizationId, name: "Hair care", sort_order: 2, is_active: true }]);
});

test("category edits and deletion filter by both record and organization", async () => {
  for (const remove of [false, true]) {
    const { db, calls } = database();
    assert.deepEqual(await writeServiceCategory(db, { ...actor, role: "manager" }, { id, name: "Hair care", sortOrder: 0, isActive: false }, remove), {});
    assert.ok(calls.some(call => call[0] === (remove ? "delete" : "update")));
    assert.deepEqual(calls.filter(call => call[0] === "eq"), [["eq", "id", id], ["eq", "organization_id", actor.organizationId]]);
    assert.deepEqual(calls.filter(call => call[0] === "from"), [["from", "service_categories"]]);
  }
});

test("invalid category IDs and non-admin callers cannot reach persistence", async () => {
  const { db, calls } = database();
  for (const role of ["advisor", "technician", "cashier", "viewer"]) assert.match((await writeServiceCategory(db, { ...actor, role }, { id }, true)).error!, /Owner or manager/);
  for (const value of ["", "../category", "not-a-uuid"]) assert.ok((await writeServiceCategory(db, actor, { id: value }, true)).error);
  for (const input of [{ id, name: "A", sortOrder: 0, isActive: true }, { id, name: "Valid", sortOrder: -1, isActive: true }]) assert.ok((await writeServiceCategory(db, actor, input)).error);
  assert.equal(calls.length, 0);
});

test("missing categories and persistence failures are reported safely", async () => {
  assert.match((await writeServiceCategory(database(null).db, actor, { id }, true)).error!, /no longer available/);
  assert.match((await writeServiceCategory(database(null, { code: "23505", message: "private DB detail" }).db, actor, { id, name: "Hair care", sortOrder: 0, isActive: true })).error!, /already exists/);
  const failure = await writeServiceCategory(database(null, { message: "private DB detail" }).db, actor, { id }, true);
  assert.doesNotMatch(failure.error!, /private DB/);
});

test("catalog navigation retains filters and only permits recognized category dialogs", () => {
  assert.equal(servicesCatalogHref({ tab: "categories", q: "Hair & Nails", category: id, dialog: "category-edit", categoryId: id }), `/dashboard/services?tab=categories&q=Hair+%26+Nails&category=${id}&dialog=category-edit&categoryId=${id}`);
  assert.equal(servicesCatalogHref({ category: "foreign/path", categoryId: "bad", dialog: "https://outside.test" }), "/dashboard/services");
});

test("Back links resolve real parent routes for new/edit/detail and settings pages", () => {
  const cases = {
    "/dashboard/services/new": "/dashboard/services", "/dashboard/services/service-id/edit": "/dashboard/services/service-id",
    "/dashboard/services/service-id": "/dashboard/services", "/dashboard/customers/new": "/dashboard/customers",
    "/dashboard/customers/customer-id/preferences": "/dashboard/customers/customer-id", "/dashboard/vehicles/vehicle-id/edit": "/dashboard/vehicles/vehicle-id",
    "/dashboard/appointments/new": "/dashboard/appointments", "/dashboard/appointments/appointment-id/edit": "/dashboard/appointments/appointment-id",
    "/dashboard/queue/new": "/dashboard/queue", "/dashboard/jobs/job-id": "/dashboard/jobs",
    "/dashboard/estimates/estimate-id": "/dashboard/jobs", "/dashboard/invoices/invoice-id": "/dashboard/payments",
    "/dashboard/settings/branches/new": "/dashboard/settings/branches", "/dashboard/settings/branches/branch-id/edit": "/dashboard/settings/branches",
    "/dashboard/settings/resources/resource-id/edit": "/dashboard/settings/resources", "/dashboard/settings/staff": "/dashboard/settings",
    "/dashboard/settings/public-page": "/dashboard/settings", "/dashboard/settings/billing": "/dashboard/settings",
  };
  for (const [pathname, href] of Object.entries(cases)) assert.equal(dashboardBackDestination(pathname)?.href, href, pathname);
  assert.equal(dashboardBackDestination("/dashboard/services/new", true)?.label, "Back to treatments");
  assert.equal(dashboardBackDestination("/dashboard/appointments/new", true), null);
  assert.equal(dashboardBackDestination("/dashboard/appointments/appointment-id/edit", true), null);
  for (const pathname of ["/dashboard", "/dashboard/services", "/shop/salon", "/dashboard/customers/import", "/dashboard/jobs/job-id/work", "/dashboard/vehicles/vehicle-id/history"]) assert.equal(dashboardBackDestination(pathname), null);
});

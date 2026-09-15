import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { starterServices } from "../modules/core/catalog/starter-services";
import { installStarterServices } from "../modules/core/catalog/install-starter-services";

test("each supported industry has 10 distinct services with valid editable prices and durations", () => {
  assert.deepEqual(Object.keys(starterServices).sort(), ["automotive", "pet_care", "salon"]);
  for (const services of Object.values(starterServices)) {
    assert.equal(services.length, 10);
    assert.equal(new Set(services.map(service => service.name.toLowerCase())).size, 10);
    for (const service of services) {
      assert.ok(service.name.length >= 2 && service.category.length >= 2);
      assert.ok(Number.isSafeInteger(service.priceCentavos) && service.priceCentavos > 0);
      assert.ok(Number.isInteger(service.durationMinutes) && service.durationMinutes > 0);
    }
  }
});
test("starter catalog rejects non-manager roles before accessing the database", async () => {
  const db = { from() { throw new Error("unexpected query"); } } as unknown as SupabaseClient;
  for (const role of ["viewer", "advisor", "cashier", "technician"]) {
    assert.match((await installStarterServices(db, { organizationId: crypto.randomUUID(), role })).error ?? "", /Owner or manager/);
  }
});

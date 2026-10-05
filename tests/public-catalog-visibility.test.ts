import test from "node:test";
import assert from "node:assert/strict";
import { publicCatalogVisibilitySchema } from "../lib/public-booking";

const input = { kind: "product", id: "10000000-0000-4000-8000-000000000001", branchId: "10000000-0000-4000-8000-000000000002", isPublic: "false" };
test("public catalog accepts explicit show and hide for products and promos", () => {
  for (const kind of ["product", "promo"]) for (const isPublic of ["true", "false"]) {
    assert.equal(publicCatalogVisibilitySchema.parse({...input,kind,isPublic}).isPublic,isPublic);
  }
});
test("public catalog rejects arbitrary tables, invalid IDs and ambiguous visibility", () => {
  for (const change of [{kind:"services"},{id:""},{branchId:"all"},{isPublic:"on"},{isPublic:true},{isPublic:undefined}]) {
    assert.equal(publicCatalogVisibilitySchema.safeParse({...input,...change}).success,false);
  }
});

test("promo details preserve stored visibility under the existing optimistic lock", async () => {
  const {readFile} = await import("node:fs/promises");
  const action = await readFile("app/dashboard/promos/actions.ts", "utf8");
  const form = await readFile("components/commerce-catalog-forms.tsx", "utf8");
  assert.match(action, /select\("is_public"\).*eq\("organization_id", m.organizationId\).*eq\("branch_id", m.branchId\)/);
  assert.match(action, /isPublic = existing.is_public/);
  assert.match(action, /p_is_public:isPublic/);
  assert.match(action, /p_version: Number\(form.get\("version"\)/);
  assert.doesNotMatch(action, /form.get\("isPublic"\)/);
  assert.doesNotMatch(form, /id="promo-public"/);
});

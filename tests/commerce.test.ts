import assert from "node:assert/strict";
import test from "node:test";
import { quantityAmountCentavos, quantityThousandths } from "../modules/core/commerce/quantity";
import { promoSchema } from "../modules/core/commerce/promos";
import { navigationForIndustry } from "../modules/platform/navigation";
import { resolveIndustryConfig } from "../modules/platform/industry";

const service = "11111111-1111-4111-8111-111111111111", product = "22222222-2222-4222-8222-222222222222";
const promo = { name: "Service and take-home product", description: "", priceCentavos: 150000, status: "active", validFrom: "2026-09-01", validThrough: "2026-09-30", components: [{ kind: "service", referenceId: service, quantity: "1", unit: "service" }, { kind: "product", referenceId: product, quantity: "1", unit: "piece" }] };
test("commerce quantity arithmetic uses exact thousandths and minor-unit rounding", () => {
  assert.equal(quantityThousandths("0.001"), 1n);
  assert.equal(quantityThousandths("999999999.999"), 999999999999n);
  assert.equal(quantityAmountCentavos("0.125", 100n), 13n);
  assert.equal(quantityAmountCentavos("1.005", 100n), 101n);
  assert.equal(quantityAmountCentavos("999999999.999", 10000000000n), 9999999999990000000n);
});
test("commerce rejects ambiguous or inexact quantities", () => {
  for (const value of ["", "0", "0.000", "-1", "1e2", "1,000", "1.0001", "NaN", "Infinity", " 1", "1000000000", "01"]) assert.throws(() => quantityThousandths(value));
});
test("fixed-price promos validate bounded components without changing service duration", () => {
  assert.ok(promoSchema.safeParse(promo).success);
  assert.equal(promoSchema.safeParse({ ...promo, components: [...promo.components, promo.components[1]] }).success, false);
  assert.equal(promoSchema.safeParse({ ...promo, components: [promo.components[1]] }).success, false);
  assert.equal(promoSchema.safeParse({ ...promo, components: [{ ...promo.components[0], quantity: "2" }, promo.components[1]] }).success, false);
  assert.equal(promoSchema.safeParse({ ...promo, validThrough: "2026-08-31" }).success, false);
  assert.equal(promoSchema.safeParse({ ...promo, priceCentavos: 0.1 }).success, false);
});
test("accommodation is a billable context, not a stocked room identity", () => {
  const components = [{ kind: "accommodation", referenceId: null, quantity: "1", unit: "service" }, promo.components[1]];
  assert.ok(promoSchema.safeParse({ ...promo, components }).success);
  assert.equal(promoSchema.safeParse({ ...promo, components: [{ ...components[0], referenceId: service }, components[1]] }).success, false);
});
test("all implemented verticals expose catalog pages through existing inventory permissions", () => {
  for (const industry of ["salon", "automotive", "pet_care", "hospitality"]) {
    const config = resolveIndustryConfig(industry);
    assert.ok(navigationForIndustry(config, "owner").some(item => item.href === "/dashboard/products"));
    assert.ok(navigationForIndustry(config, "manager").some(item => item.href === "/dashboard/promos"));
    assert.ok(!navigationForIndustry(config, "technician").some(item => item.key === "promos"));
  }
});

test("promos allow distinct services with optional products and reject duplicate or mixed stay components",()=>{
 const second={kind:"service",referenceId:product,quantity:"1",unit:"service"};
 assert.ok(promoSchema.safeParse({...promo,components:[promo.components[0],second]}).success);
 assert.ok(promoSchema.safeParse({...promo,components:[...promo.components,second]}).success);
 assert.equal(promoSchema.safeParse({...promo,components:[promo.components[0],promo.components[0]]}).success,false);
 assert.equal(promoSchema.safeParse({...promo,components:[promo.components[0],{kind:"accommodation",referenceId:null,quantity:"1",unit:"service"}]}).success,false);
 assert.equal(promoSchema.safeParse({...promo,components:[promo.components[1],{...promo.components[1],kind:"supply"}]}).success,false);
});

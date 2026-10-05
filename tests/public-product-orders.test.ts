import assert from "node:assert/strict";
import test from "node:test";
import { publicProductOrderSchema, publicOrderError } from "../modules/core/commerce/public-product-orders";
const valid = { slug: "test-shop", productId: "10000000-0000-4000-8000-000000000001", requestKey: "10000000-0000-4000-8000-000000000002", quantity: "1.250", customerName: "Test Client", phone: "09171234567", email: "", note: "Pickup tomorrow", website: "", expectedPrice: "12500", expectedCurrency: "PHP", expectedUnit: "bottle" };
test("public product requests allow bounded native quantities and optional email", () => {
  assert.equal(publicProductOrderSchema.parse(valid).quantity, "1.250");
  assert.equal(publicProductOrderSchema.parse(valid).expectedPrice, 12500);
  assert.ok(publicProductOrderSchema.safeParse({ ...valid, quantity: "1000" }).success);
});
test("public order validation rejects malformed quantities, IDs, contact and spam fields", () => {
  for (const patch of [{ quantity: "0" }, { quantity: "-1" }, { quantity: "1.0001" }, { quantity: "1000.001" }, { quantity: "1e3" }, { productId: "bad" }, { requestKey: "bad" }, { phone: "abcdefghi" }, { phone: "123456" }, { email: "invalid" }, { customerName: " " }, { website: "bot" }, { expectedPrice: "-1" }, { note: "a".repeat(1001) }]) {
    assert.equal(publicProductOrderSchema.safeParse({ ...valid, ...patch }).success, false, JSON.stringify(patch));
  }
});
test("public order errors give safe retry guidance without raw database messages", () => {
  assert.match(publicOrderError("40001"), /price changed/);
  assert.match(publicOrderError("54000"), /try again later/);
  assert.equal(publicOrderError("private database diagnostic"), publicOrderError());
});

test("basket validation requires contact, bounded distinct products and price snapshots", async()=>{
 const {publicBasketOrderSchema}=await import("../modules/core/commerce/public-product-orders");
 const line={productId:valid.productId,quantity:"2",expectedPrice:12500,expectedCurrency:"PHP",expectedUnit:"bottle"};
 const basket={...valid,lines:[line,{...line,productId:"10000000-0000-4000-8000-000000000003"}]};
 assert.ok(publicBasketOrderSchema.safeParse(basket).success);
 for(const patch of [{lines:[]},{lines:[line,line]},{lines:Array(21).fill(line)},{phone:""},{customerName:""},{lines:[{...line,quantity:"0"}]}]) assert.equal(publicBasketOrderSchema.safeParse({...basket,...patch}).success,false);
});

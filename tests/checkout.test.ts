import {test} from "node:test";
import assert from "node:assert/strict";
import {checkoutQuantity,checkoutError,checkoutLoadError} from "../modules/core/checkout/contracts";
import {quantityAmountCentavos} from "../modules/core/commerce/quantity";
test("checkout loading distinguishes database repair, permissions and transient errors",()=>{
 for(const code of ["42702","42703","42883","42P01","PGRST202","PGRST205"])assert.match(checkoutLoadError(code),/0111/);
 assert.match(checkoutLoadError("42501"),/permission/);
 assert.doesNotMatch(checkoutLoadError("42501"),/0111/);
 assert.match(checkoutLoadError(),/server logs/);
 assert.doesNotMatch(checkoutLoadError("private database detail"),/private database detail/);
});
test("checkout accepts exact native quantities and rejects unsafe input",()=>{
 for(const valid of ["1","0.001","1.5","999999"])assert.equal(checkoutQuantity.safeParse(valid).success,true);
 for(const invalid of ["0","-1","1e3","1.0001","1000000","NaN",""])assert.equal(checkoutQuantity.safeParse(invalid).success,false);
 assert.equal(quantityAmountCentavos("1.5",2501n),3752n);
});
test("checkout errors disclose useful recovery without database details",()=>{
 assert.match(checkoutError({code:"40001"}),/Reload/);
 assert.match(checkoutError({message:"insufficient stock"}),/available stock/);
 assert.match(checkoutError({code:"42501",message:"secret tenant id"}),/permission/);
 assert.doesNotMatch(checkoutError({message:"secret SQL or customer information"}),/secret/);
});

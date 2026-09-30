import assert from "node:assert/strict";
import test from "node:test";
import { catalogSaveError } from "../modules/core/commerce/save-errors";

test("missing catalog RPCs and receipt tables give migration guidance, never stock-history errors", () => {
  for (const code of ["PGRST202", "PGRST205", "42883", "42P01"]) {
    const result = catalogSaveError({ code }, "product");
    assert.match(result, /0104_restore_catalog_save_rpcs.sql/);
    assert.doesNotMatch(result, /stock history/i);
  }
});
test("stock-history guidance is limited to that exact failure on an existing product", () => {
  const error = { code: "22023", message: "Stock history exists; unit and stock identity cannot change" };
  assert.match(catalogSaveError(error, "product", true), /original counting measure/);
  assert.doesNotMatch(catalogSaveError(error, "product", false), /stock history/i);
  assert.doesNotMatch(catalogSaveError({ code: "42501" }, "product", true), /stock history/i);
});
test("catalog messages distinguish permission, product code, retry and stale edits without leaking raw errors", () => {
  assert.match(catalogSaveError({ code: "42501" }, "product"), /permission/);
  assert.match(catalogSaveError({ code: "23505" }, "product"), /product code/);
  assert.match(catalogSaveError({ code: "40001" }, "promo"), /changed/);
  assert.match(catalogSaveError({ code: "22023", message: "Request key reused with different details" }, "product"), /already saved/);
  assert.doesNotMatch(catalogSaveError({ code: "XX000", message: "private database internals" }, "product"), /private database internals/);
});

type DatabaseError = { code?: string; message?: string };

export function catalogSaveError(error: DatabaseError, kind: "product" | "promo", editing = false): string {
  if (["PGRST202", "PGRST203", "PGRST204", "PGRST205", "42883", "42P01", "42703"].includes(error.code ?? "")) {
    return "Product and promo setup needs a database update. Ask your administrator to apply migration 0104_restore_catalog_save_rpcs.sql, then try again.";
  }
  if (error.code === "42501") return "You do not have permission to save in this branch. Ask your owner or manager to check your access.";
  if (error.code === "23505") return kind === "product" ? "This product code is already used in this branch. Choose another product code or edit that product." : "This promo already exists. Reload the catalog and try again.";
  if (error.code === "40001") return "This record changed. Reload it before saving.";
  if (error.code === "22023") {
    if (kind === "promo" && error.message === "Choose exactly one service or accommodation component") return "Multiple-service promos need database setup. Apply migration 0107_multi_service_promos.sql, then save again.";
    if (kind === "product" && editing && error.message === "Stock history exists; unit and stock identity cannot change") return "This product already has stock history. Keep its original counting measure and stock tracking setting; you can still edit its name, price, and description.";
    if (error.message === "Request key reused with different details") return "This form was already saved. Close it and reopen the product or promo to make another change.";
    if (error.message === "Invalid product details") return "Check the product name, price, counting measure, and purpose, then try again.";
    if (kind === "promo") return "Check that each component is active in this branch and uses its original counting measure.";
  }
  return `Unable to save this ${kind}. Please try again. If it still fails, ask your administrator to check the database setup.`;
}

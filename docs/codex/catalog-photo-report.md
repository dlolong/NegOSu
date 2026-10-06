# Catalog photo editing and thumbnails

Product, promo and service forms share a preview with an Edit photo button. The popup offers uploads, a public image URL, preview, clear, cancel and Use photo. Applying a draft does not submit its enclosing form; Cancel/Escape discard the draft. Detail-page previews save photos directly. Upload access and file checks reuse the existing image endpoint and plan rules. Uploaded objects remain stored if an edit is abandoned, as before.

Shared thumbnail displays now cover desktop/mobile product, promo and service catalogs; inventory stock, movements and consumption; checkout product choices; appointment service/promo search and selected items; promo components; and public booking choices. Existing public storefront/settings thumbnails remain. Historical transaction snapshots and plain textual references are not converted into image records.

Main implementation: `components/catalog-photo-editor.tsx`, `catalog-photo-field.tsx`, `catalog-detail-photo.tsx`, `catalog-item-thumbnail.tsx`; `app/dashboard/catalog/actions.ts`; `modules/core/catalog/photo.ts` and `product-photos.ts`; their catalog/detail/selection integrations.

No database migration or RLS change. Direct saves authorize owner/manager, validate UUIDs and HTTP(S) URLs, resolve organization/branch from authenticated membership, and use the authenticated database client. Product edits are branch scoped; services retain their existing organization-wide scope. Updates touch only photo fields, comparing the prior URL to reject conflicting edits. Promos use database-read fields and the existing version-checked save RPC. Images are batched from RLS-protected inventory records for older report/view contracts; failed image reads show placeholders. No production changes or deployment.

Validation: all 581 unit tests passed using Node 24 with `--import tsx --test tests/**/*.test.ts`, including five new server photo tests. Lint and typecheck passed before final integration edits; final verification is recorded in the chat report. Browser tests were added for open/cancel/Escape, invalid URLs, draft application without parent submission, failed saves, clear and mobile containment; existing photo tests were updated. Chrome failed to launch inside the sandbox and escalation was declined, so no browser pass or live Storage validation is claimed.

Customer-list follow-up: added stable customer-specific keys to the JSX cell values passed across the server/client table boundary, including the reported RecordLink. Row IDs and navigation remain unchanged.

Before release, run the desktop/mobile photo browser checks and a live owner/manager photo-save smoke test with both free and upload-enabled plans. Verify stale-photo rejection in two sessions and denied access from another tenant/branch. Historical snapshot thumbnails remain outside this catalog UI change.

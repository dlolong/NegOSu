import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BusinessIdentity } from "../components/business-identity";
import { PoweredBy } from "../components/powered-by";
import { businessInitials, businessLogoUrlSchema, businessMetadata, resolveBusinessLogoUrl } from "../modules/platform/business-branding";
import { parsePublicAppointmentSelfService } from "../modules/core/scheduling/appointment-self-service";

test("business logo URLs permit public web images and reject executable or credential-bearing sources", () => {
  assert.equal(resolveBusinessLogoUrl(" https://example.test/logo.png "), "https://example.test/logo.png");
  assert.equal(businessLogoUrlSchema.parse("  "), "");
  for (const value of ["javascript:alert(1)", "data:image/svg+xml,<svg/>", "file:///private/logo.png", "//example.test/logo.png", "https://user:secret@example.test/logo.png", "not a url", "https://example.test/" + "x".repeat(2048)]) {
    assert.equal(resolveBusinessLogoUrl(value), null);
    assert.equal(businessLogoUrlSchema.safeParse(value).success, false);
  }
  for (const value of [null, undefined, 12]) assert.equal(resolveBusinessLogoUrl(value), null);
});

test("business fallback represents the business, including long and non-ASCII names", () => {
  assert.equal(businessInitials("  Maria’s   Beauty Studio  "), "MB");
  assert.equal(businessInitials("車屋"), "車");
  assert.equal(businessInitials(""), "B");
  const html = renderToStaticMarkup(createElement(BusinessIdentity, { name: "Maria’s Beauty Studio", logoUrl: null }));
  assert.match(html, /Maria’s Beauty Studio/);
  assert.match(html, />MB</);
  assert.doesNotMatch(html, /<img|NegOSu/);
});

test("business identity uses its own image while platform attribution stays secondary", () => {
  const html = renderToStaticMarkup(createElement(BusinessIdentity, { name: "Acme Auto", logoUrl: "https://example.test/acme.png", inverse: true }));
  assert.match(html, /src="https:\/\/example.test\/acme.png"/);
  assert.match(html, /alt="Acme Auto logo"/);
  assert.match(html, /referrerPolicy="no-referrer"/i);
  assert.doesNotMatch(html, /_next\/image|NegOSu_logo/);
  const attribution = renderToStaticMarkup(createElement(PoweredBy));
  assert.match(attribution, /Powered by/);
  assert.match(attribution, /<img[^>]+alt="NegOSu"/);
  assert.match(attribution, /NegOSu_logo_dark\.png/);
  const inverseAttribution = renderToStaticMarkup(createElement(PoweredBy, { inverse: true }));
  assert.match(inverseAttribution, /NegOSu_logo_light\.png/);
});

test("owned page metadata overrides platform title and icon without exposing invalid image URLs", () => {
  const metadata = businessMetadata("Acme Auto", "https://example.test/acme.png", "Booking status");
  assert.deepEqual(metadata.title, { absolute: "Booking status | Acme Auto", template: "%s | Acme Auto" });
  assert.deepEqual(metadata.icons, { icon: "https://example.test/acme.png", apple: "https://example.test/acme.png" });
  assert.doesNotMatch(JSON.stringify(metadata), /NegOSu/);
  assert.equal(metadata.referrer, "no-referrer");
  assert.deepEqual(businessMetadata("Acme", "javascript:alert(1)").icons, { icon: "/images/NegOSu_favicon.png", apple: "/images/NegOSu_logo_512x512.png" });
});

test("private appointment branding remains compatible with earlier RPC responses and unavailable links", () => {
  const payload = { state: "active", businessName: "Salon A", branchName: "Main", branchTimezone: "Asia/Manila", appointmentStatus: "confirmed", startsAt: "2026-09-14T01:00:00Z", endsAt: null, treatments: [], assignedStaff: [], paymentStatus: "unpaid", totalCentavos: 0, paidCentavos: 0 };
  assert.equal(parsePublicAppointmentSelfService(payload).state, "active");
  const branded = parsePublicAppointmentSelfService({ ...payload, logoUrl: "https://example.test/a.png" });
  assert.equal(branded.state === "active" && branded.logoUrl, "https://example.test/a.png");
  assert.deepEqual(parsePublicAppointmentSelfService({ state: "expired", logoUrl: "https://example.test/private.png" }), { state: "expired" });
});

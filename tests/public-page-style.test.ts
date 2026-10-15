import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicClosingBanner, PublicVisitGuide, PublicStyledHero } from "../components/public-page-presentation";
import { isPublicPageStyleForIndustry, publicPageAppearanceSchema, publicPageStyleIds, publicPageStylesForIndustry, resolvePublicPageStyle, resolvePublicHeroPosition } from "../modules/platform/public-page-style";

const pairs = { salon: "elegant", automotive: "precision", hospitality: "retreat", pet_care: "friendly" } as const;
test("businesses can choose only Standard or their own industry style", () => {
  for (const [industry, ownStyle] of Object.entries(pairs)) {
    assert.deepEqual(publicPageStylesForIndustry(industry).map(style => style.id), ["standard", ownStyle]);
    for (const style of publicPageStyleIds) assert.equal(isPublicPageStyleForIndustry(style, industry), style === "standard" || style === ownStyle);
    assert.equal(resolvePublicPageStyle(ownStyle, industry), ownStyle);
    for (const invalid of [undefined, null, "unknown", "", "<script>", {}, 42]) assert.equal(resolvePublicPageStyle(invalid, industry), "standard");
  }
  assert.equal(resolvePublicPageStyle("elegant", "automotive"), "standard");
  for (const industry of ["field_service", "unknown", "toString", "__proto__"]) assert.deepEqual(publicPageStylesForIndustry(industry).map(style => style.id), ["standard"]);
});

test("hero editing trims text, bounds stored content and restricts image position", () => {
  const input = { pageStyle: "elegant", headline: " Hello ", eyebrow: " ", description: " Welcome ", position: "right" };
  assert.deepEqual(publicPageAppearanceSchema.parse(input), { ...input, headline: "Hello", eyebrow: "", description: "Welcome" });
  for (const [key, value] of Object.entries({ headline: "a".repeat(121), eyebrow: "a".repeat(61), description: "a".repeat(301), position: "url(evil)", pageStyle: "other" })) assert.equal(publicPageAppearanceSchema.safeParse({ ...input, [key]: value }).success, false);
  assert.equal(resolvePublicHeroPosition("bad"), "center");
});

test("hospitality and unavailable booking guides never promise an online reservation", () => {
  const hospitality = renderToStaticMarkup(createElement(PublicVisitGuide, { industry: "hospitality", bookingAvailable: true })) + renderToStaticMarkup(createElement(PublicClosingBanner, { industry: "hospitality", slug: "inn", bookingAvailable: true }));
  assert.match(hospitality, /Contact for availability/);
  assert.match(hospitality, /href="#public-shop-contact"/);
  assert.doesNotMatch(hospitality, /\/book|How booking works/);
  const unavailable = renderToStaticMarkup(createElement(PublicVisitGuide, { industry: "salon", bookingAvailable: false }));
  assert.match(unavailable, /Contact the business/);
  assert.doesNotMatch(unavailable, /Pick a time|Send your request/);
});

test("hero text is escaped, empty text falls back, and valid bookings keep the existing route", () => {
  const html = renderToStaticMarkup(createElement(PublicStyledHero, { name: "Sample", industry: "salon", slug: "sample", coverUrl: null, bookingAvailable: true, hero: { headline: "<script>alert(1)</script>", description: " ", position: "bad" } }));
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /Explore our treatments/);
  assert.match(html, /href="\/shop\/sample\/book"/);
});

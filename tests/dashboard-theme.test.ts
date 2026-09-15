import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { dashboardThemes, dashboardThemeIds, isDashboardTheme, resolveDashboardTheme } from "../modules/platform/dashboard-theme";

const source = (path: string) => readFileSync(path, "utf8");

function contrastWithWhite(hex: string) {
  const linear = [1, 3, 5].map(offset => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return 1.05 / (luminance + 0.05);
}

test("dashboard themes expose a small professional allowlist with a safe default", () => {
  assert.deepEqual(dashboardThemes.map(theme => theme.id), ["blue", "plum", "teal", "graphite", "indigo"]);
  assert.equal(new Set(dashboardThemes.map(theme => theme.id)).size, dashboardThemes.length);
  assert.equal(resolveDashboardTheme("emerald"), "teal");
  assert.equal(resolveDashboardTheme("invented"), "blue");
  assert.equal(resolveDashboardTheme(null), "blue");
  for (const theme of dashboardThemes) assert.ok(contrastWithWhite(theme.swatches[1]) >= 4.5, `${theme.name} primary must support readable white text.`);
});

test("the authenticated user owns a validated theme preference applied at the dashboard shell", () => {
  const context = source("lib/auth/context.ts");
  const action = source("app/dashboard/settings/actions.ts");
  const settings = source("app/dashboard/settings/page.tsx") + source("components/workspace-theme-form.tsx");
  const shell = source("components/app-shell.tsx");
  assert.match(context, /resolveDashboardTheme\(user\.user_metadata\.dashboard_theme\)/);
  assert.match(action, /isDashboardTheme\(theme\)/);
  assert.match(action, /requireAuthenticatedUser/);
  assert.match(action, /supabase\.auth\.updateUser\(\{ data: \{ dashboard_theme: theme \} \}\)/);
  assert.match(settings, /id="settings-theme-form"/);
  assert.match(settings, /id=\{`settings-theme-radio-\$\{theme\.id\}`\}/);
  assert.match(settings, /id="settings-theme-save-button"/);
  assert.match(shell, /data-dashboard-theme=\{dashboardTheme\}/);
});

test("every alternate palette overrides shared tokens without changing semantic status colors", () => {
  const css = source("app/globals.css");
  for (const theme of dashboardThemes) {
    assert.match(css, new RegExp(`\\[data-dashboard-theme="${theme.id}"\\]`));
  }
  for (const block of css.matchAll(/\[data-dashboard-theme="[^"]+"\]\s*\{([^}]+)\}/g)) {
    assert.doesNotMatch(block[1], /--(?:success|warning|danger|info):/);
  }
});

test("Public Page and Billing settings expose clear operational sections", () => {
  const publicPage = source("app/dashboard/settings/public-page/page.tsx");
  const billing = source("app/dashboard/settings/billing/page.tsx") + source("components/billing-overview.tsx");
  for (const id of ["public-page-readiness-card", "public-page-locations-section", "public-gallery-empty-state"]) assert.match(publicPage, new RegExp(id));
  assert.match(publicPage, /Weekly booking hours/);
  assert.doesNotMatch(publicPage, /Opening-hours JSON/);
  assert.match(billing, /id="billing-current-plan"/);
  assert.match(billing, /hasMonthlyCheckout \? <option/);
  assert.match(billing, /hasYearlyCheckout \? <option/);
  assert.match(billing, /billing-checkout-unavailable-/);
  assert.doesNotMatch(billing, /ring-blue-/);
});

test("five generic themes preserve old metadata without industry matching", () => {
  assert.deepEqual(dashboardThemes.map(theme => theme.name), ["Steel Blue", "Plum", "Teal", "Graphite", "Indigo"]);
  for (const preference of [undefined, null, "", "industry", "unknown", { theme: "salon" }]) assert.equal(resolveDashboardTheme(preference), "blue");
  const previous = { automotive: "blue", ocean: "blue", salon: "plum", pet_care: "teal", emerald: "teal", graphite: "graphite", indigo: "indigo" };
  for (const [stored, resolved] of Object.entries(previous)) assert.equal(resolveDashboardTheme(stored), resolved);
  for (const preference of dashboardThemeIds) {
    assert.ok(isDashboardTheme(preference));
    assert.equal(resolveDashboardTheme(preference), preference);
  }
  for (const invalid of ["industry", "automotive", "salon", "pet_care", "ocean", "emerald", "red", "#123456", "var(--danger)", {}, 42, null]) assert.equal(isDashboardTheme(invalid), false);
  assert.equal(new Set(dashboardThemeIds).size, 5);
  const form = source("components/workspace-theme-form.tsx");
  assert.doesNotMatch(form, /Recommended|recommended|industry|classic|<details/);
});

function contrast(foreground: string, background: string) {
  // contrastWithWhite = 1.05 / (luminance + 0.05).
  const a = 1.05 / contrastWithWhite(foreground), b = 1.05 / contrastWithWhite(background);
  return Math.max(a, b) / Math.min(a, b);
}
function tokens(block: string) {
  return Object.fromEntries([...block.matchAll(/(--[a-z-]+):\s*(#[a-f0-9]{6})\s*;/gi)].map(match => [match[1], match[2]]));
}
test("palette swatches match rendered CSS and action, text, and focus colors meet contrast targets", () => {
  const css = source("app/globals.css"), root = tokens(css.match(/:root\s*\{([^}]+)\}/)![1]);
  for (const palette of dashboardThemes) {
    const block = css.match(new RegExp(`\\[data-dashboard-theme="${palette.id}"\\]\\s*\\{([^}]+)\\}`));
    const theme = { ...root, ...tokens(block?.[1] ?? "") };
    assert.deepEqual(palette.swatches, [theme["--brand"], theme["--brand-primary"], theme["--brand-tint"]], `${palette.id} swatches must match its actual CSS`);
    for (const color of ["--brand-primary", "--brand-primary-strong"]) {
      assert.ok(contrast(theme[color], "#ffffff") >= 4.5, `${palette.id} white text on ${color}`);
      assert.ok(contrast(theme[color], theme["--brand-tint"]) >= 4.5, `${palette.id} ${color} on selected surface`);
    }
    for (const color of ["--admin-text", "--admin-text-secondary", "--admin-text-muted"]) {
      for (const surface of ["--admin-canvas", "--admin-surface", "--admin-surface-muted"]) assert.ok(contrast(theme[color], theme[surface]) >= 4.5, `${palette.id} ${color} on ${surface}`);
    }
    assert.ok(contrast(theme["--brand-primary"], theme["--admin-surface"]) >= 3, `${palette.id} light-surface focus`);
    assert.ok(contrast(theme["--brand-on-dark"], theme["--brand"]) >= 3, `${palette.id} sidebar focus and active indicator`);
    for (const text of ["#ffffff", "#cbd5e1", "#94a3b8"]) assert.ok(contrast(text, theme["--brand"]) >= 4.5, `${palette.id} sidebar text ${text}`);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import path from "node:path";
import { isPublicPageTheme, publicPageThemeIds, publicPageThemes, resolvePublicPageTheme } from "../modules/platform/public-page-theme";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild") as typeof import("esbuild");

test("public palettes accept only supported IDs and preserve the original look for old payloads", () => {
  assert.equal(new Set(publicPageThemeIds).size, 6);
  assert.deepEqual(publicPageThemes.map(theme => theme.id), [...publicPageThemeIds]);
  for (const id of publicPageThemeIds) {
    assert.ok(isPublicPageTheme(id));
    assert.equal(resolvePublicPageTheme(id), id);
  }
  for (const invalid of [undefined, null, "", {}, 7, "salon", "#fff", "url(https://example.test)"]) {
    assert.equal(isPublicPageTheme(invalid), false);
    assert.equal(resolvePublicPageTheme(invalid), "classic");
  }
});

async function actionHarness(role: string | null, result: { data: unknown; error: unknown } = { data: { id: "owned-business" }, error: null }) {
  const state = { role, result, calls: [] as unknown[][] };
  const compiled = await build({ entryPoints: [path.resolve("app/dashboard/settings/public-page/actions.ts")], bundle: true, write: false, platform: "node", format: "cjs", plugins: [{ name: "theme-action-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(next\/(navigation|cache)|@\/lib\/auth\/industry-access|@\/lib\/supabase\/server)$/ }, args => ({ path: args.path, namespace: "boundary" }));
    builder.onResolve({ filter: /^test-state$/ }, () => ({ path: "test-state", external: true }));
    builder.onLoad({ filter: /.*/, namespace: "boundary" }, args => ({ loader: "js", contents:
      args.path === "next/navigation" ? 'export function redirect(url){throw new Error(url)}' :
      args.path === "next/cache" ? 'import state from "test-state"; export function revalidatePath(...args){state.calls.push(["revalidate",...args])}' :
      args.path.endsWith("industry-access") ? 'import state from "test-state"; export async function requireIndustryFeature(){if(!state.role)throw new Error("SIGN_IN");return {activeMembership:{role:state.role,organizationId:"owned-business",organizationSlug:"owned-shop"}}}' :
      'import state from "test-state"; export async function createClient(){return {from(table){state.calls.push(["from",table]); const q={};for(const method of ["update","eq","select"]){q[method]=(...args)=>{state.calls.push([method,...args]);return q}}q.maybeSingle=async()=>state.result;return q}}}'
    }));
  } }] });
  const compiledModule = { exports: {} as { savePublicPageTheme: (data: FormData) => Promise<void> } };
  new Function("require", "module", compiled.outputFiles[0].text)((name: string) => name === "test-state" ? state : require(name), compiledModule);
  return { state, save: compiledModule.exports.savePublicPageTheme };
}
function submitted(theme: string) {
  const data = new FormData();
  data.set("publicPageTheme", theme);
  data.set("organizationId", "forged-business");
  data.set("enabled", "on");
  data.set("description", "Unrelated profile edit");
  return data;
}

test("owners and managers save only the theme for the authenticated business and refresh public routes", async () => {
  for (const role of ["owner", "manager"]) {
    const { state, save } = await actionHarness(role);
    for (let retry = 0; retry < 2; retry++) await assert.rejects(save(submitted("plum")), /message=Public\+page\+color\+theme\+saved/);
    assert.deepEqual(state.calls.filter(call => call[0] === "update"), [["update", { public_page_theme: "plum" }], ["update", { public_page_theme: "plum" }]]);
    assert.ok(state.calls.some(call => JSON.stringify(call) === JSON.stringify(["eq", "id", "owned-business"])));
    assert.ok(state.calls.some(call => JSON.stringify(call) === JSON.stringify(["revalidate", "/shop/owned-shop", "layout"])));
    assert.doesNotMatch(JSON.stringify(state.calls), /forged-business|Unrelated profile edit|public_page_enabled/);
  }
});

test("invalid themes and unauthorized callers cannot reach the database", async () => {
  for (const role of [null, "viewer", "cashier", "technician"]) {
    const { state, save } = await actionHarness(role);
    await assert.rejects(save(submitted("teal")), role ? /Settings\+access\+required/ : /SIGN_IN/);
    assert.deepEqual(state.calls, []);
  }
  for (const theme of ["", "unknown", "#abc", "var(--danger)"]) {
    const { state, save } = await actionHarness("owner");
    await assert.rejects(save(submitted(theme)), /Select\+a\+valid\+public\+page\+color\+theme/);
    assert.deepEqual(state.calls, []);
  }
});

test("database errors and missing update rows give a safe error without claiming success", async () => {
  for (const result of [{ data: null, error: { message: "private database diagnostic" } }, { data: null, error: null }]) {
    const { state, save } = await actionHarness("owner", result);
    await assert.rejects(save(submitted("teal")), /error=Unable\+to\+save\+your\+public\+page\+theme/);
    assert.ok(!state.calls.some(call => call[0] === "revalidate"));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild") as typeof import("esbuild");
const admin = "83100000-0000-4000-8000-000000000001";

async function harness(userId: string | null, rows: Record<string, unknown>[] = []) {
  const state = { userId, clients: 0, calls: [] as Array<[string, ...unknown[]]>, rows };
  const result = await build({ entryPoints: [path.resolve("modules/platform/admin-reader.ts")], bundle: true, write: false, platform: "node", format: "cjs", plugins: [{ name: "admin-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(server-only|next\/navigation|@\/lib\/auth\/context|@\/lib\/supabase\/admin)$/ }, args => ({ path: args.path, namespace: "boundary" }));
    builder.onResolve({ filter: /^test-state$/ }, () => ({ path: "test-state", external: true }));
    builder.onLoad({ filter: /.*/, namespace: "boundary" }, args => ({ loader: "js", contents:
      args.path === "server-only" ? "" : args.path === "next/navigation" ? 'export function notFound(){throw new Error("NOT_FOUND")}' : args.path.endsWith("context") ? 'import state from "test-state"; export async function requireAuthenticatedUser(){if(!state.userId)throw new Error("SIGN_IN");return {user:{id:state.userId,user_metadata:{role:"admin"}}}}' : `import state from "test-state";
        export function createAdminClient(){state.clients++;return {
          rpc: async (...args)=>{state.calls.push(["rpc",...args]);return {data:{users:1,rows:state.rows,total:state.rows.length},error:null}},
          from: (table)=>{state.calls.push(["from",table]);const q={};for(const method of ["select","eq","ilike","not","is","order","range"]){q[method]=(...args)=>{state.calls.push([method,...args]);return q}}q.then=(resolve)=>Promise.resolve({data:state.rows,count:state.rows.length,error:null}).then(resolve);return q}
        }};`
    }));
  } }] });
  const compiledModule = { exports: {} as Record<string, (...args: unknown[]) => Promise<unknown>> };
  new Function("require", "module", result.outputFiles[0].text)((name: string) => name === "test-state" ? state : require(name), compiledModule);
  return { state, api: compiledModule.exports };
}

test("every admin reader rejects unauthenticated and non-admin callers before creating a service client", async () => {
  const original = process.env.PLATFORM_ADMIN_USER_IDS;
  process.env.PLATFORM_ADMIN_USER_IDS = admin;
  try {
    for (const userId of [null, "83100000-0000-4000-8000-000000000002"]) {
      const { state, api } = await harness(userId);
      await assert.rejects(api.loadAdminOverview(true), userId ? /NOT_FOUND/ : /SIGN_IN/);
      await assert.rejects(api.loadAdminDirectory("signups", {}), userId ? /NOT_FOUND/ : /SIGN_IN/);
      assert.equal(state.clients, 0);
      assert.deepEqual(state.calls, []);
    }
  } finally { if (original === undefined) delete process.env.PLATFORM_ADMIN_USER_IDS; else process.env.PLATFORM_ADMIN_USER_IDS = original; }
});

test("authorized payment directory separates environments and bounds rows", async () => {
  const original = process.env.PLATFORM_ADMIN_USER_IDS;
  process.env.PLATFORM_ADMIN_USER_IDS = admin;
  try {
    const { state, api } = await harness(admin);
    await api.loadAdminDirectory("payments", { mode: "test", status: "paid", page: "2" });
    assert.ok(state.calls.some(call => JSON.stringify(call) === JSON.stringify(["eq", "livemode", false])));
    assert.ok(state.calls.some(call => JSON.stringify(call) === JSON.stringify(["eq", "status", "paid"])));
    assert.ok(state.calls.some(call => JSON.stringify(call) === JSON.stringify(["range", 25, 49])));
    const live = await harness(admin);
    await live.api.loadAdminDirectory("payments", { mode: "invalid", status: "forged" });
    assert.ok(live.state.calls.some(call => JSON.stringify(call) === JSON.stringify(["eq", "livemode", true])));
    assert.ok(!live.state.calls.some(call => call[0] === "eq" && call[1] === "status"));
  } finally { if (original === undefined) delete process.env.PLATFORM_ADMIN_USER_IDS; else process.env.PLATFORM_ADMIN_USER_IDS = original; }
});

test("billing event diagnostics are removed before returning directory records", async () => {
  const original = process.env.PLATFORM_ADMIN_USER_IDS;
  process.env.PLATFORM_ADMIN_USER_IDS = admin;
  try {
    const { api } = await harness(admin, [{ id: "event", processing_error: "Private provider diagnostic", processed_at: null }]);
    const result = await api.loadAdminDirectory("events", {}) as { rows: Record<string, unknown>[] };
    assert.equal(result.rows[0].processing_status, "Error");
    assert.equal("processing_error" in result.rows[0], false);
    assert.ok(!JSON.stringify(result).includes("Private provider diagnostic"));
  } finally { if (original === undefined) delete process.env.PLATFORM_ADMIN_USER_IDS; else process.env.PLATFORM_ADMIN_USER_IDS = original; }
});

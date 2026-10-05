import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { groupWorkContributors, loadStaffWorkHistory, loadWorkParticipation, staffWorkHref, type WorkParticipation } from "../modules/core/staff/work-history";
const scope = { organizationId: "tenant", branchId: "branch", industry: "salon" };
const person = (staff: string, source: WorkParticipation["source"], service: string | null = null): WorkParticipation => ({ kind: "job", record_id: "job", target_id: "job", appointment_id: "appointment", staff_id: staff, staff_name: staff, service_id: service, source });
function database(results: { data: unknown[]; error: unknown }[] = []) {
  const calls: { method: string; args: unknown[] }[] = [];
  const query: Record<string, unknown> = {};
  for (const method of ["from", "select", "eq", "in", "or", "gte", "lt", "order"]) query[method] = (...args: unknown[]) => { calls.push({ method, args }); return query; };
  query.range = (...args: unknown[]) => { calls.push({ method: "range", args }); return Promise.resolve(results.shift() ?? { data: [], error: null }); };
  return { db: query as unknown as SupabaseClient, calls };
}
test("shared work retains all employees and combines repeated sessions and roles", () => {
  const groups = groupWorkContributors([person("Alex", "job_assignment"), person("Alex", "work_session"), person("Alex", "work_session"), person("Bo", "work_session"), person("Casey", "service_assignment", "haircut")], "appointment_id");
  assert.deepEqual(groups.get("appointment")?.map(p => p.name), ["Alex", "Bo", "Casey"]);
  assert.deepEqual(groups.get("appointment")?.[0].sources, ["job_assignment", "work_session"]);
});
test("service history excludes other service assignees but labels whole-job workers", () => {
  const groups = groupWorkContributors([person("Alex", "service_assignment", "haircut"), person("Bo", "service_assignment", "color"), person("Casey", "work_session")], "target_id", new Set(["haircut"]));
  assert.deepEqual(groups.get("job")?.map(p => p.name), ["Alex", "Casey"]);
  assert.deepEqual(groups.get("job")?.[1].sources, ["work_session"]);
});
test("history uses snapshot names and never merges people sharing a display name", () => {
  const a = person("one", "work_session"), b = person("two", "service_assignment", "haircut");
  a.staff_name = b.staff_name = "Same Name";
  const groups = groupWorkContributors([a, b, { ...a, source: "job_assignment", staff_name: "Renamed" }], "target_id");
  assert.equal(groups.get("job")?.length, 2);
  assert.equal(groups.get("job")?.find(p => p.staffId === "one")?.name, "Same Name");
});
test("staff history applies tenant, branch, staff, search and dates before paging", async () => {
  const { db, calls } = database();
  await loadStaffWorkHistory(db, scope, "staff", 2, { q: "50%", from: "2026-10-01", to: "2026-10-05" });
  for (const pair of [["organization_id", "tenant"], ["branch_id", "branch"], ["staff_id", "staff"]]) assert.ok(calls.some(c => c.method === "eq" && JSON.stringify(c.args) === JSON.stringify(pair)));
  assert.deepEqual(calls.find(c => c.method === "range")?.args, [20, 40]);
  assert.deepEqual(calls.find(c => c.method === "gte")?.args, ["occurred_at", "2026-10-01T00:00:00Z"]);
  assert.deepEqual(calls.find(c => c.method === "lt")?.args, ["occurred_at", "2026-10-06T00:00:00.000Z"]);
  assert.ok(String(calls.find(c => c.method === "or")?.args[0]).includes('50\\\\%'));
});
test("staff work links open the correct vertical source", () => {
  assert.equal(staffWorkHref({ kind: "appointment", target_id: "a" }, "pet_care"), "/dashboard/pet-care/appointments/a");
  assert.equal(staffWorkHref({ kind: "appointment", target_id: "a" }, "salon"), "/dashboard/appointments/a");
  assert.equal(staffWorkHref({ kind: "job", target_id: "j" }, "automotive"), "/dashboard/jobs/j");
  assert.equal(staffWorkHref({ kind: "stay", target_id: "s" }, "hospitality"), "/dashboard/hospitality/stays/s");
});
test("contributor lookup batches parents and pages every worker under the same scope", async () => {
  const full = Array.from({ length: 500 }, (_, i) => person(String(i), "work_session"));
  const { db, calls } = database([{ data: full, error: null }, { data: [person("last", "work_session")], error: null }]);
  const result = await loadWorkParticipation(db, scope, "target_id", ["job", "job"]);
  assert.equal(result.data.length, 501);
  assert.deepEqual(calls.filter(c => c.method === "range").map(c => c.args), [[0, 499], [500, 999]]);
  assert.deepEqual(calls.find(c => c.method === "in")?.args, ["target_id", ["job"]]);
  assert.equal(calls.filter(c => c.method === "eq" && c.args[0] === "branch_id").length, 2);
});
test("failed contributor lookups never return misleading partial teams", async () => {
  const { db } = database([{ data: [], error: { message: "blocked" } }]);
  const result = await loadWorkParticipation(db, scope, "appointment_id", ["appointment"]);
  assert.ok(result.error); assert.deepEqual(result.data, []);
  const empty = database(); await loadWorkParticipation(empty.db, scope, "target_id", []);
  assert.equal(empty.calls.length, 0);
});

// Opt-in Node preload for local browser tests only. Never imported by application code.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

if (process.env.NEGOSU_PAYMONGO_FIXTURE !== "local-only"
  || !["127.0.0.1", "localhost"].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname)
  || process.env.PAYMONGO_SECRET_KEY !== "sk_test_localfixture") throw new Error("PayMongo fixture requires an explicitly isolated local server");
const directory = join(tmpdir(), "negosu-paymongo-fixture");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname !== "api.paymongo.com") return realFetch(input, init);
  const response = data => Response.json({ data });
  if (url.pathname === "/v2/checkout_sessions") {
    const attributes = JSON.parse(init.body).data.attributes;
    const id = `cs_${attributes.reference_number.replaceAll("-", "")}`;
    const file = join(directory, `${id}.json`);
    if (!existsSync(file)) writeFileSync(file, JSON.stringify({ id, attributes: { ...attributes, status: "active", livemode: false, checkout_url: `https://checkout.paymongo.com/${id}`, payments: [] } }), { mode: 0o600 });
    const session = JSON.parse(readFileSync(file, "utf8"));
    return response({ id, attributes: { checkout_url: session.attributes.checkout_url, livemode: false } });
  }
  const match = url.pathname.match(/^\/v1\/checkout_sessions\/(cs_[A-Za-z0-9]+)(\/expire)?$/);
  if (!match) throw new Error("Unexpected PayMongo test API request");
  const file = join(directory, `${match[1]}.json`);
  if (!existsSync(file)) return new Response("Missing fixture", { status: 404 });
  const session = JSON.parse(readFileSync(file, "utf8"));
  if (match[2]) {
    session.attributes.status = "expired";
    writeFileSync(file, JSON.stringify(session), { mode: 0o600 });
  }
  return response(session);
};

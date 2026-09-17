/** Read-only source discovery; extracted controls are candidates, never passed QA. */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? files(name) : /\.tsx?$/.test(name) ? [name] : [];
  });
}
const rows: Array<{ file: string; line: number; kind: string; id: string; target: string; label: string }> = [];
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
for (const file of [...files("app"), ...files("components")].sort()) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const kind = node.tagName.getText(source);
      if (["form", "button", "Button", "SubmitButton", "Link", "a", "input", "Input", "select", "textarea", "SearchableSelect", "Tabs", "ListTabs"].includes(kind)) {
        const attributes = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(item => [item.name.getText(source), item.initializer?.getText(source) ?? "true"]));
        if (attributes.type !== '"hidden"') rows.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind, id: attributes.id ?? "(unscoped)", target: attributes.action ?? attributes.href ?? attributes.onClick ?? attributes.name ?? "(composed)", label: clean(ts.isJsxElement(node.parent) ? node.parent.children.filter(ts.isJsxText).map(child => child.text).join(" ") : "") });
      }
    }
    if (ts.isFunctionDeclaration(node) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) && node.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword) && /actions\.ts$/.test(file)) {
      rows.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind: "server action", id: node.name?.text ?? "default", target: "authenticated/domain validation required", label: "" });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
mkdirSync("docs/qa", { recursive: true });
const escape = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
const routes = files("app").filter(file => /\/(page\.tsx|route\.ts)$/.test(file)).sort();
const header = "# Source feature and action inventory\n\nGenerated with `node --import tsx scripts/qa-inventory.ts`. Source discovery is not browser verification. Expressions, permission requirements and composed controls require manual expansion. See `verification-results.md` for executed suite evidence; no route is fully verified merely by loading.\n\n";
writeFileSync("docs/qa/feature-matrix.md", header + `Discovered ${routes.length} route entry points and ${rows.length} control/server-action occurrences (not unique user journeys).\n\n| Entry point | Source | Actor / prerequisites | Expected behavior / method | Current result |\n| --- | --- | --- | --- | --- |\n` + routes.map(file => {
  const route = "/" + file.replace(/^app\//, "").replace(/\/?(?:page\.tsx|route\.ts)$/, "");
  const actor = route.startsWith("/dashboard") || route.startsWith("/display") ? "Active membership; industry, permission, branch and fixture appropriate to route" : /token/.test(route) ? "Scoped valid token; anonymous negative context" : "Public or authenticated onboarding context";
  return `| \`${route}\` | \`${file}\` | ${actor} | Read/navigation plus each composed action; browser, authoritative readback and negative permissions | DISCOVERED; action verification pending |`;
}).join("\n") + "\n\nControl-level candidates are in [action-inventory.md](action-inventory.md). Shared controls can occur in multiple verticals. Actor/fixture applicability and outcomes must be resolved per workflow; unexecuted actions remain unverified.\n");
writeFileSync("docs/qa/action-inventory.md", header + "| Source | Kind | Semantic ID | Action / destination | Literal label | Result |\n| --- | --- | --- | --- | --- | --- |\n" + rows.map(row => `| ${row.file}:${row.line} | ${row.kind} | ${escape(row.id)} | ${escape(row.target)} | ${escape(row.label)} | NOT EXECUTED individually |`).join("\n") + "\n");
console.log(`Inventoried ${routes.length} routes and ${rows.length} control/action occurrences.`);

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// esbuild is the locked compiler dependency of the project's tsx test runner.
const projectRequire = createRequire(path.join(process.cwd(), "package.json"));
const { build } = createRequire(projectRequire.resolve("tsx/package.json"))("esbuild") as typeof import("esbuild");

export async function renderFormFixture(entryPoint: string) {
  const result = await build({
    entryPoints: [entryPoint], bundle: true, write: false, format: "iife", jsx: "automatic",
    alias: { "@": process.cwd() }, define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "synthetic-form-boundaries", setup(builder) {
      builder.onResolve({ filter: /^next\/(link|navigation|image)$/ }, args => ({ path: args.path, namespace: "form-boundary" }));
      builder.onResolve({ filter: /^@\/app\/.*(?:actions|entity-actions)$/ }, args => ({ path: args.path, namespace: "form-boundary" }));
      builder.onLoad({ filter: /.*/, namespace: "form-boundary" }, args => {
        let contents: string;
        if (args.path === "next/link") contents = 'import React from "react"; export default function Link({replace,prefetch,...props}) { return React.createElement("a",props); }';
        else if (args.path === "next/image") contents = 'import React from "react"; export default function Image({unoptimized,fill,priority,...props}) { return React.createElement("img",props); }';
        else if (args.path === "next/navigation") contents = 'export function useRouter(){ return {replace: href => location.assign(href)}; } export function usePathname(){ return new URLSearchParams(location.search).get("pathname") || location.pathname; }';
        else {
          const source = readFileSync(path.join(process.cwd(), args.path.replace("@/", "") + ".ts"), "utf8");
          const names = [...source.matchAll(/export async function (\w+)/g)].map(match => match[1]);
          contents = names.map(name => `export async function ${name}(data) { return await window.recordFormAction(${JSON.stringify(name)}, data instanceof FormData ? [...data] : []) ?? {}; }`).join("\n");
        }
        return { contents, loader: "jsx", resolveDir: process.cwd() };
      });
    } }],
  });
  const postcss = projectRequire("postcss") as typeof import("postcss").default;
  const tailwind = projectRequire("@tailwindcss/postcss") as typeof import("@tailwindcss/postcss").default;
  const css = (await postcss([tailwind()]).process(readFileSync("app/globals.css", "utf8"), { from: path.resolve("app/globals.css") })).css;
  return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main id="root" class="mx-auto max-w-3xl p-4"></main><script>${result.outputFiles[0].text}</script></body></html>`;
}

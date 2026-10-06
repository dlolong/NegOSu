import test from "node:test";
import assert from "node:assert/strict";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecordTable } from "../components/record-table";

test("server table preserves status children before the hydration enhancement", () => {
 const status = createElement("span", { className: "capitalize" }, "completed");
 const html = renderToStaticMarkup(createElement(RecordTable, {
  id: "appointments", caption: "Appointments",
  columns: [{ key: "name", label: "Client" }, { key: "status", label: "Status" }],
  rows: [{ id: "appointment-1", cells: { name: "Client", status }, mobile: createElement(Fragment, null, createElement("p", null, status)) }],
 }));
 assert.ok(html.includes('<span class="capitalize">completed</span>'));
 assert.equal(html.includes("data-status-badge"), false);
});

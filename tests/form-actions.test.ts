import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement, type MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormActions, FormCancelDestination } from "../components/form-actions";
import { Button } from "../components/ui/button";

test("dialog Cancel uses the clean parent destination and keeps list filters", () => {
  const html = renderToStaticMarkup(createElement(FormCancelDestination, { value: "/dashboard/customers?q=Ana&status=active" },
    createElement(FormActions, { id: "customer-actions", cancelHref: "/dashboard/customers/customer-id" }, "Save customer")));
  assert.match(html, /href="\/dashboard\/customers\?q=Ana&amp;status=active"/);
  assert.doesNotMatch(html, /href="[^\"]*(?:create=|edit=)/);
  assert.match(html, /justify-end/);
  assert.match(html, /aria-hidden="true"/);
  assert.ok(html.indexOf("Cancel") < html.indexOf("Save customer"));
});

test("standalone Cancel returns to its explicit record; inline Cancel resets without submitting", () => {
  const standalone = renderToStaticMarkup(createElement(FormActions, { id: "edit-actions", cancelHref: "/dashboard/appointments/appointment-id" }, "Save"));
  assert.match(standalone, /href="\/dashboard\/appointments\/appointment-id"/);
  const inline = renderToStaticMarkup(createElement(FormActions, { id: "profile-actions" }, "Save"));
  assert.match(inline, /type="reset"/);
  assert.doesNotMatch(inline, /type="submit"/);
});

test("ordinary buttons cannot accidentally submit their surrounding form", () => {
  const ordinary = renderToStaticMarkup(createElement(Button, null, "Cancel"));
  assert.match(ordinary, /type="button"/);
  const submit = renderToStaticMarkup(createElement(Button, { type: "submit" }, "Save"));
  assert.match(submit, /type="submit"/);
});

test("disabled link buttons suppress child handlers as well as navigation", () => {
  let invoked = false;
  let prevented = false;
  const element = Button({ asChild: true, disabled: true, children: createElement("a", { href: "/next", onClick: () => { invoked = true; } }, "Next") });
  const handler = element.props.onClick as (event: MouseEvent<HTMLElement>) => void;
  handler({ preventDefault: () => { prevented = true; } } as MouseEvent<HTMLElement>);
  assert.equal(prevented, true);
  assert.equal(invoked, false);
});

test("record forms use shared cancellation and retain authoritative save actions", () => {
  const crm = readFileSync("components/crm-forms.tsx", "utf8");
  assert.doesNotMatch(crm, /href=\{returnTo/);
  for (const name of ["saveBranch", "saveCustomer", "saveVehicle"]) assert.match(crm, new RegExp(`action=\\{${name}\\}`));
  const visits = readFileSync("components/operations-forms.tsx", "utf8");
  assert.match(visits, /<FormActions[^>]*controlPrefix/s);
  assert.match(visits, /appointment \? "Save appointment"/);
  const branding = readFileSync("components/business-branding-form.tsx", "utf8");
  assert.match(branding, /onReset=\{\(\) => setPreview\(logoUrl \?\? ""\)\}/);
});

import type { ReactNode } from "react";

/** Related settings stay together visually and in the accessible form structure. */
export function SettingsFormSection({ id, title, description, children }: {
  id: string; title: string; description: string; children: ReactNode;
}) {
  return <fieldset id={id} aria-describedby={`${id}-help`} className="col-span-full min-w-0 rounded-ui-lg border border-admin-border p-4 sm:p-5">
    <legend className="px-1 text-base font-semibold text-admin-text">{title}</legend>
    <p id={`${id}-help`} className="mb-4 text-sm leading-relaxed text-admin-text-secondary">{description}</p>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">{children}</div>
  </fieldset>;
}

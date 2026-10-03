import type { ReactNode } from "react";

/** Related settings stay together visually and in the accessible form structure. */
export function SettingsFormSection({ id, title, description, children }: {
  id: string; title: string; description?: string; children: ReactNode;
}) {
  return <fieldset id={id} aria-describedby={description ? `${id}-help` : undefined} className="col-span-full min-w-0 rounded-ui-lg border border-admin-border bg-white p-4 sm:p-5">
    <legend className="px-1 text-sm font-semibold text-admin-text">{title}</legend>
    {description ? <p id={`${id}-help`} className="mb-4 text-xs leading-5 text-admin-text-secondary">{description}</p> : null}
    <div className="grid min-w-0 items-start gap-x-5 gap-y-4 sm:grid-cols-2 [&_label]:text-sm [&_label]:font-medium [&_input]:font-normal [&_select]:font-normal [&_textarea]:font-normal [&_label>input:not([type=checkbox]):not([type=radio])]:mt-2 [&_label>select]:mt-2">{children}</div>
  </fieldset>;
}

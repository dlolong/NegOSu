import { petContext } from "@/modules/pet-care/runtime";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { enabled } = await petContext();
  return <div id="pet-care-workspace" className="min-w-0 [&_h1]:font-normal [&_h2]:font-normal [&_a]:font-normal [&_button]:font-normal [&_summary]:font-normal">{!enabled ? <p id="pet-care-disabled-notice" role="status" className="mb-4 rounded-xl border p-4 text-sm">This Pet Care business is currently unavailable. Existing records remain available for reference.</p> : null}{children}</div>;
}

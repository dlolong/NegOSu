import Link from "next/link";
import { workSourceLabels, type WorkContributor } from "@/modules/core/staff/work-history";

export function WorkContributors({ people, canOpenStaff = false, error = false }: { people: WorkContributor[]; canOpenStaff?: boolean; error?: boolean }) {
  if (error) return <span role="alert" className="text-xs text-admin-text-secondary">Staff details unavailable</span>;
  if (!people.length) return <span className="text-xs text-admin-text-secondary">No staff recorded</span>;
  return <ul className="space-y-2">{people.map(person => <li key={person.staffId}>{canOpenStaff ? <Link href={`/dashboard/settings/staff/${person.staffId}`} className="font-medium underline">{person.name}</Link> : <span className="font-medium">{person.name}</span>}<p className="text-xs text-admin-text-secondary">{person.sources.map(source => workSourceLabels[source]).join(" · ")}</p></li>)}</ul>;
}

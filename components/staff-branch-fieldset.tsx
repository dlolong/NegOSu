"use client";

import { useState } from "react";

export function StaffBranchFieldset({ id, branches, selected, label }: {
  id: string;
  branches: { id: string; name: string }[];
  selected: string[];
  label: string;
}) {
  const [allBranches, setAllBranches] = useState(!selected.length);
  const [branchIds, setBranchIds] = useState(selected);
  const unavailableIds = branchIds.filter((branchId) => !branches.some((branch) => branch.id === branchId));

  return <fieldset id={id} className="col-span-full min-w-0 rounded-xl border border-slate-300 p-3">
    <legend className="max-w-full px-1 text-sm font-medium [overflow-wrap:anywhere]">{label}</legend>
    <label className="flex min-h-9 min-w-0 items-center gap-2 text-sm [overflow-wrap:anywhere]">
      <input id={`${id}-all-checkbox`} type="checkbox" className="shrink-0" name="allBranches" checked={allBranches} onChange={(event) => {
        setAllBranches(event.target.checked);
        setBranchIds([]);
      }}/> All current and future branches
    </label>
    <div className="grid gap-1 sm:grid-cols-2">{branches.map((branch, index) => <label className="flex min-h-9 min-w-0 items-center gap-2 text-sm [overflow-wrap:anywhere]" key={branch.id}>
      <input id={`${id}-${branch.id}-checkbox`} type="checkbox" className="shrink-0" name="branchIds" value={branch.id}
        checked={branchIds.includes(branch.id)} required={!allBranches && !branchIds.length && index === 0}
        onChange={(event) => {
          setAllBranches(false);
          setBranchIds(event.target.checked ? [...branchIds, branch.id] : branchIds.filter((value) => value !== branch.id));
        }}/>{branch.name}
    </label>)}</div>
    {unavailableIds.map((branchId) => <input key={branchId} type="hidden" name="branchIds" value={branchId}/>)}
    {unavailableIds.length ? <p className="mt-2 text-xs text-slate-600">This profile includes unavailable branches. Choose all branches to clear them, then select the branches you need.</p> : null}
    {!allBranches && !branchIds.length ? <p id={`${id}-selection-help`} className="mt-2 text-xs text-slate-600">Select at least one branch, or choose all branches.</p> : null}
  </fieldset>;
}

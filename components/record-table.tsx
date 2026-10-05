"use client";

import { useState } from "react";
import { recordMatches, recordText } from "@/lib/record-table-search";
import { Input } from "@/components/ui/input";
import type { ReactNode } from "react";
import { RecordRow } from "@/components/record-item";
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type RecordColumn = { key: string; label: string; className?: string; secondary?: boolean; align?: "right" };
export type RecordTableRow = { id: string; cells: Record<string, ReactNode>; mobile?: ReactNode };

/** One set of controls: desktop table, compact stacked records below the desktop breakpoint. */
export function RecordTable({ id, caption, columns, rows, emptyId, empty = "No records found.", searchable = false, className }: {
  id: string; caption: string; columns: RecordColumn[]; rows: RecordTableRow[]; empty?: string; emptyId?: string; className?: string; searchable?: boolean;
}) {
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("");
  const filterColumn = columns.find(column => ["status", "type", "category", "method", "branch"].includes(column.key));
  const options = filterColumn ? [...new Set(rows.map(row => recordText(row.cells[filterColumn.key])).filter(Boolean))].sort() : [];
  const visible = searchable ? rows.filter(row => recordMatches(row.cells, search) && (!options.includes(filter) || !filterColumn || recordText(row.cells[filterColumn.key]) === filter)) : rows;
  return <div className={className}>
    {searchable ? <div className="my-3 flex min-w-0 flex-wrap gap-2"><label className="min-w-0 flex-1 text-xs text-admin-text-secondary">Search loaded records<Input id={`${id}-search`} type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder={`Search ${caption.toLowerCase()}`}/></label>{options.length > 1 ? <label className="text-xs text-admin-text-secondary">{filterColumn?.label}<select id={`${id}-filter`} value={filter} onChange={event=>setFilter(event.target.value)} className="block min-h-11 max-w-full rounded-md border border-admin-border bg-white px-3 text-sm"><option value="">All</option>{options.map(value=><option key={value} value={value}>{value}</option>)}</select></label> : null}<p className="w-full text-xs text-admin-text-secondary">Filters apply to the records loaded in this list{rows.length ? ` (${visible.length} of ${rows.length})` : ""}.</p></div> : null}
    <TableFrame className={"min-w-0"}>
    <Table id={id} className="block md:table md:table-fixed"><caption className="sr-only">{caption}</caption>
      <TableHeader className="hidden md:table-header-group"><tr>{columns.map(column => <TableHead key={column.key} scope="col" className={cn(column.secondary && "hidden md:table-cell", column.align === "right" && "w-32 text-right sm:w-44", column.className)}>{column.label}</TableHead>)}</tr></TableHeader>
      <TableBody className="block md:table-row-group">{visible.map(row => <RecordRow id={row.id} key={row.id} className="flex min-w-0 flex-wrap items-start gap-y-1 px-3 py-3 md:table-row md:p-0">{columns.map((column,index) => <TableCell key={column.key} className={cn("block min-w-0 px-0 py-1 [overflow-wrap:anywhere] md:table-cell md:px-4 md:py-3", index === 0 ? "w-full md:w-auto" : "w-full text-xs md:w-auto md:text-sm", column.secondary && row.mobile ? "hidden md:table-cell" : "",column.align === "right" && "md:text-right [&>div]:justify-start md:[&>div]:justify-end",column.className)}>{index > 0 && column.key !== "actions" ? <span className="mr-1 text-admin-text-secondary md:hidden">{column.label}:</span> : null}{row.cells[column.key]}{index === 0 && row.mobile ? <div className="mt-2 space-y-1 text-xs font-normal text-admin-text-secondary md:hidden">{row.mobile}</div> : null}</TableCell>)}</RecordRow>)}</TableBody>
    </Table>
    {!visible.length && <p id={emptyId??`${id}-empty`} role="status" className="px-4 py-10 text-center text-sm text-admin-text-muted">{searchable && (search || filter) ? "No matching records in this list." : empty}</p>}
  </TableFrame></div>;
}

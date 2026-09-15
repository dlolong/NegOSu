import type { ReactNode } from "react";
import { RecordRow } from "@/components/record-item";
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type RecordColumn = { key: string; label: string; className?: string; secondary?: boolean; align?: "right" };
export type RecordTableRow = { id: string; cells: Record<string, ReactNode>; mobile?: ReactNode };

/** Keep primary details and the final amount/actions visible; condense secondary fields on phones. */
export function RecordTable({ id, caption, columns, rows, emptyId, empty = "No records found.", className }: {
  id: string; caption: string; columns: RecordColumn[]; rows: RecordTableRow[]; empty?: string; emptyId?: string; className?: string;
}) {
  return <TableFrame className={cn("min-w-0", className)}>
    <Table id={id} className="table-fixed"><caption className="sr-only">{caption}</caption>
      <TableHeader><tr>{columns.map(column => <TableHead key={column.key} scope="col" className={cn(column.secondary && "hidden lg:table-cell", column.align === "right" && "w-32 text-right sm:w-44", column.className)}>{column.label}</TableHead>)}</tr></TableHeader>
      <TableBody>{rows.map(row => <RecordRow id={row.id} key={row.id}>{columns.map((column,index) => <TableCell key={column.key} className={cn("[overflow-wrap:anywhere]",column.secondary && "hidden lg:table-cell",column.align === "right" && "text-right",column.className)}>{row.cells[column.key]}{index === 0 && row.mobile ? <div className="mt-2 space-y-1 text-xs font-normal text-admin-text-secondary lg:hidden">{row.mobile}</div> : null}</TableCell>)}</RecordRow>)}</TableBody>
    </Table>
    {!rows.length && <p id={emptyId??`${id}-empty`} role="status" className="px-4 py-10 text-center text-sm text-admin-text-muted">{empty}</p>}
  </TableFrame>;
}

/** Show each record's amount alongside the summary card, without duplicate revenue fields. */
export function reportListColumns<T extends {key:string;label:string}>(columns:T[]):T[] {
  return columns.filter(column => !["paid","revenue"].includes(column.key)
    && column.label !== "Revenue collected")
    .map(column => ["total","charges"].includes(column.key) || column.label === "Total amount" || column.label === "Total billed"
      ? {...column,label:"Amount"} : column);
}

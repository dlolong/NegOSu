import { isValidElement, type ReactNode } from "react";
/** Read displayed text only; never search hidden form values or arbitrary props. */
export function recordText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(recordText).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return recordText(node.props.children);
  return "";
}
export function recordMatches(cells: Record<string, ReactNode>, query: string) {
  return Object.values(cells).map(recordText).join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

import { cloneElement, Fragment, isValidElement, type ReactNode } from "react";
import { statusColor } from "@/lib/status-colors";

/** Preserve links, controls and supporting text while coloring recognized status labels. */
export function colorStatusText(node: ReactNode): ReactNode {
 if (typeof node === "string") {
  const color = statusColor(node);
  if (color) return <span data-status-badge className={`inline-flex max-w-full items-center rounded-full border px-2 py-1 text-xs font-semibold leading-tight ${color}`}>{node}</span>;
  if (node.includes(" · ")) return node.split(" · ").map((part,index) => <Fragment key={index}>{index ? " · " : null}{colorStatusText(part)}</Fragment>);
  return node;
 }
 if (Array.isArray(node)) return node.map((child,index)=><Fragment key={index}>{colorStatusText(child)}</Fragment>);
 if (isValidElement<{children?:ReactNode;className?:string}>(node) && (node.type === Fragment || ["span","p","div","small","strong"].includes(String(node.type)))) {
  if (node.props.className?.includes("bg-")) return node;
  return cloneElement(node,{},colorStatusText(node.props.children));
 }
 return node;
}

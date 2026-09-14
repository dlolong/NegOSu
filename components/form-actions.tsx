"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Dialog cancellation must use its clean parent URL, not a mutation's error return URL.
export const FormCancelDestination = createContext<string | undefined>(undefined);

export function FormActions({ id, children, cancelHref, cancelId, onCancel, disabled = false, className }: {
  id: string;
  children?: ReactNode;
  cancelHref?: string;
  cancelId?: string;
  onCancel?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const dialogHref = useContext(FormCancelDestination);
  const { pending } = useFormStatus();
  const href = dialogHref ?? cancelHref;
  const unavailable = pending || disabled;
  const content = <><X aria-hidden="true" size={16} className="shrink-0"/>Cancel</>;
  return <div id={id} className={cn("col-span-full flex w-full flex-wrap items-center justify-end gap-2 border-t border-admin-border pt-4", className)}>
    {onCancel ? <Button id={cancelId ?? `${id}-cancel-button`} type="button" variant="secondary" disabled={unavailable} onClick={onCancel}>{content}</Button>
      : href ? <Button id={cancelId ?? `${id}-cancel-button`} asChild variant="secondary" disabled={unavailable}><Link href={href} replace>{content}</Link></Button>
      : <Button id={cancelId ?? `${id}-cancel-button`} type="reset" variant="secondary" disabled={unavailable}>{content}</Button>}
    {children}
  </div>;
}

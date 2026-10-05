"use client";
import type { HTMLAttributes, ReactNode } from "react";
import { PageBack } from "@/components/page-back";
import { DashboardBackLink } from "@/components/dashboard-back-link";

/** Back navigation precedes the heading, or the entire page when a layout supplies a target. */
export function PageTitle({ back, children, className = "", ...props }: HTMLAttributes<HTMLHeadingElement> & { back?: ReactNode }) {
  const classes = className.split(/\s+/);
  const spacing = classes.filter(value => /(^|:)m[ty]-/.test(value));
  const heading = classes.filter(value => !/(^|:)m[ty]-/.test(value));
  return <div data-page-title-row className={`min-w-0 ${spacing.join(" ")}`}>
    {back === undefined ? <DashboardBackLink/> : <PageBack>{back}</PageBack>}
    <h1 {...props} className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${heading.join(" ")}`}>{children}</h1>
  </div>;
}

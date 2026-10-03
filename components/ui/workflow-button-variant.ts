import type { ButtonProps } from "./button";

// Presentation only: authorization and allowed transitions remain in the domain.
const workflowVariants: Record<string, ButtonProps["variant"]> = {
  confirm: "confirm", approve: "confirm", authorize: "confirm",
  arrive: "arrival", check_in: "arrival",
  start: "start", start_service: "start", resume: "start", in_progress: "start", called: "start",
  complete: "complete", finish: "complete", collect: "complete", check_out: "complete",
  ready: "ready", quality_check: "ready",
  pause: "warning", stop: "warning", no_show: "warning", extend: "warning",
  cancel: "destructive", cancelled: "destructive", decline: "destructive", reverse: "destructive",
};

export function workflowButtonVariant(action: string): ButtonProps["variant"] {
  return Object.hasOwn(workflowVariants, action) ? workflowVariants[action] : "secondary";
}

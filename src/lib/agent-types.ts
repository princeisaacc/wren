import type { ServiceKey } from "@/lib/services";

export type StepState = "running" | "done" | "waiting" | "error";
export type Step = { id: number; label: string; state: StepState };

export type ActionRow = { label: string; value: string; long?: boolean };

export type PendingAction = {
  id: string;
  tool: string;
  service: ServiceKey;
  title: string;
  summary: string;
  danger: boolean;
  running: string;
  done: string;
  rows: ActionRow[];
  args: Record<string, unknown>;
  status?: "pending" | "done" | "cancelled" | "failed";
  error?: string;
};

export type StepEvent = { t: "step" } & Step;
export type FinalEvent = { t: "final"; text: string; actions?: PendingAction[]; connect?: ServiceKey };
export type ErrorEvent = { t: "error" };
export type AgentEvent = StepEvent | FinalEvent | ErrorEvent;
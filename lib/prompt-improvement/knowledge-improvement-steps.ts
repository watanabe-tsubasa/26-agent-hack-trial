import type { GoodjobTone, StepState } from "../generation-steps";
import type { RunStatus } from "@/app/(app)/admin/prompt-improvements/_components/types";

export type KnowledgeImprovementStepKey =
  | "collect_corrections"
  | "analyze_patterns"
  | "generate_knowledge"
  | "prepare_review";

export type KnowledgeImprovementStep = {
  key: KnowledgeImprovementStepKey;
  label: string;
  description: string;
  goodjob: GoodjobTone;
};

export const KNOWLEDGE_IMPROVEMENT_STEPS: readonly KnowledgeImprovementStep[] = [
  {
    key: "collect_corrections",
    label: "人間の修正履歴を確認しています",
    description:
      "確定済み事故報の修正差分から、施設ごとに繰り返し出てくる情報を探しています。",
    goodjob: "thinking",
  },
  {
    key: "analyze_patterns",
    label: "施設ごとの傾向を整理しています",
    description:
      "場所名称、設備、注意箇所、過去の不具合など、次回に活かせる知識を見つけています。",
    goodjob: "investigating",
  },
  {
    key: "generate_knowledge",
    label: "施設ナレッジ候補を作成しています",
    description:
      "共通ルールではなく、この施設に固有の情報だけを候補としてまとめています。",
    goodjob: "working",
  },
  {
    key: "prepare_review",
    label: "確認用の候補を準備しています",
    description:
      "人間が確認・編集・採用できるように、施設ナレッジ候補を整理しています。",
    goodjob: "success",
  },
] as const;

export type KnowledgeStepSnapshot = {
  step: KnowledgeImprovementStep;
  state: StepState;
};

const STEP_PROGRESS_MS = 2000;

export function deriveKnowledgeStepStates(
  status: RunStatus | null,
  elapsedMs: number
): KnowledgeStepSnapshot[] {
  if (status === "completed") {
    return KNOWLEDGE_IMPROVEMENT_STEPS.map((step) => ({
      step,
      state: "completed" as StepState,
    }));
  }

  if (status === "queued") {
    return KNOWLEDGE_IMPROVEMENT_STEPS.map((step, i) => ({
      step,
      state: i === 0 ? ("in_progress" as StepState) : ("pending" as StepState),
    }));
  }

  if (status === "running") {
    const completed = Math.min(
      KNOWLEDGE_IMPROVEMENT_STEPS.length - 1,
      Math.floor(elapsedMs / STEP_PROGRESS_MS)
    );
    return KNOWLEDGE_IMPROVEMENT_STEPS.map((step, i) => {
      if (i < completed) return { step, state: "completed" as StepState };
      if (i === completed) return { step, state: "in_progress" as StepState };
      return { step, state: "pending" as StepState };
    });
  }

  if (status === "failed") {
    const failedAt = Math.min(
      KNOWLEDGE_IMPROVEMENT_STEPS.length - 1,
      Math.floor(elapsedMs / STEP_PROGRESS_MS)
    );
    return KNOWLEDGE_IMPROVEMENT_STEPS.map((step, i) => {
      if (i < failedAt) return { step, state: "completed" as StepState };
      if (i === failedAt) return { step, state: "failed" as StepState };
      return { step, state: "pending" as StepState };
    });
  }

  return KNOWLEDGE_IMPROVEMENT_STEPS.map((step) => ({
    step,
    state: "pending" as StepState,
  }));
}

type AgentEventLike = {
  stepKey: string;
  state: "started" | "completed" | "failed";
};

export function deriveKnowledgeStepStatesFromEvents(
  events: AgentEventLike[]
): KnowledgeStepSnapshot[] {
  const lastByStep = new Map<string, AgentEventLike>();
  for (const e of events) lastByStep.set(e.stepKey, e);
  return KNOWLEDGE_IMPROVEMENT_STEPS.map((step) => {
    const e = lastByStep.get(step.key);
    const state: StepState = !e
      ? "pending"
      : e.state === "started"
        ? "in_progress"
        : e.state === "completed"
          ? "completed"
          : "failed";
    return { step, state };
  });
}

export function pickKnowledgeGoodjobTone(
  snapshots: KnowledgeStepSnapshot[]
): GoodjobTone {
  const failed = snapshots.find((s) => s.state === "failed");
  if (failed) return "warning";
  const active = snapshots.find((s) => s.state === "in_progress");
  if (active) return active.step.goodjob;
  if (snapshots.every((s) => s.state === "completed")) return "success";
  return "idle";
}

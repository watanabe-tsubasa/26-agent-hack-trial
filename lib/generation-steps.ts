export type GenerationStepKey =
  | "parse_input"
  | "search_camera_frames"
  | "evaluate_images"
  | "generate_report"
  | "prepare_review";

export type GoodjobTone =
  | "idle"
  | "thinking"
  | "working"
  | "investigating"
  | "success"
  | "warning";

export type GenerationStep = {
  key: GenerationStepKey;
  label: string;
  description: string;
  goodjob: GoodjobTone;
};

export const GENERATION_STEPS: readonly GenerationStep[] = [
  {
    key: "parse_input",
    label: "事故概要を整理しています",
    description: "入力された内容から、発生場所・状況・被害有無を読み取っています。",
    goodjob: "thinking",
  },
  {
    key: "search_camera_frames",
    label: "関連するカメラ画像を探しています",
    description: "発生場所や状況に近い画像候補を確認しています。",
    goodjob: "investigating",
  },
  {
    key: "evaluate_images",
    label: "画像から確認できる事実を整理しています",
    description: "原因を断定せず、画像上で確認できる情報だけを抽出しています。",
    goodjob: "working",
  },
  {
    key: "generate_report",
    label: "事故報告書の下書きを作成しています",
    description: "5W2Hと施設ナレッジを踏まえて報告書形式に整えています。",
    goodjob: "working",
  },
  {
    key: "prepare_review",
    label: "確認用の画面を準備しています",
    description: "AI下書きと写真台帳を確認・修正できる状態にしています。",
    goodjob: "success",
  },
] as const;

export type StepState = "pending" | "in_progress" | "completed" | "failed";

export type StepStatusSnapshot = {
  step: GenerationStep;
  state: StepState;
};

const STEP_PROGRESS_MS = 2200;

type Status =
  | "queued"
  | "generating_report"
  | "waiting_human_review"
  | "review"
  | "updated"
  | "confirmed"
  | "failed"
  | string;

export function deriveStepStates(
  status: Status,
  elapsedMs: number
): StepStatusSnapshot[] {
  if (
    status === "waiting_human_review" ||
    status === "review" ||
    status === "updated" ||
    status === "confirmed"
  ) {
    return GENERATION_STEPS.map((step) => ({ step, state: "completed" as StepState }));
  }

  if (status === "queued") {
    return GENERATION_STEPS.map((step, i) => ({
      step,
      state: i === 0 ? ("in_progress" as StepState) : ("pending" as StepState),
    }));
  }

  if (status === "generating_report") {
    const completed = Math.min(
      GENERATION_STEPS.length - 1,
      Math.floor(elapsedMs / STEP_PROGRESS_MS)
    );
    return GENERATION_STEPS.map((step, i) => {
      if (i < completed) return { step, state: "completed" as StepState };
      if (i === completed) return { step, state: "in_progress" as StepState };
      return { step, state: "pending" as StepState };
    });
  }

  if (status === "failed") {
    const failedAt = Math.min(
      GENERATION_STEPS.length - 1,
      Math.floor(elapsedMs / STEP_PROGRESS_MS)
    );
    return GENERATION_STEPS.map((step, i) => {
      if (i < failedAt) return { step, state: "completed" as StepState };
      if (i === failedAt) return { step, state: "failed" as StepState };
      return { step, state: "pending" as StepState };
    });
  }

  return GENERATION_STEPS.map((step) => ({ step, state: "pending" as StepState }));
}

type AgentEventLike = {
  stepKey: string;
  state: "started" | "completed" | "failed";
};

export function deriveStepStatesFromEvents(events: AgentEventLike[]): StepStatusSnapshot[] {
  const lastByStep = new Map<string, AgentEventLike>();
  for (const e of events) lastByStep.set(e.stepKey, e);
  return GENERATION_STEPS.map((step) => {
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

export function pickActiveGoodjobTone(snapshots: StepStatusSnapshot[]): GoodjobTone {
  const failed = snapshots.find((s) => s.state === "failed");
  if (failed) return "warning";
  const active = snapshots.find((s) => s.state === "in_progress");
  if (active) return active.step.goodjob;
  if (snapshots.every((s) => s.state === "completed")) return "success";
  return "idle";
}

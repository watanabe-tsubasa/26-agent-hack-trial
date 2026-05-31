import { generateReportDraft, type GenerationStepReporter } from "../lib/mock-agent";
import { getInputJson, saveAiDraft, updateReportStatus } from "../lib/report-repository";
import { parsePromptImprovementMessage, parseReportGenerationMessage } from "../lib/job-messages";
import {
  runPromptImprovementJob,
  type KnowledgeStepReporter,
} from "../lib/prompt-improvement-processor";
import {
  getActivePromptImprovementRun,
  markPromptImprovementRunRunning,
  markPromptImprovementRunSuperseded,
} from "../lib/prompt-improvement-run-repository";
import { appendAgentEvent } from "../lib/agent-event-log";
import {
  GENERATION_STEPS,
  type GenerationStepKey,
} from "../lib/generation-steps";
import {
  KNOWLEDGE_IMPROVEMENT_STEPS,
  type KnowledgeImprovementStepKey,
} from "../lib/knowledge-improvement-steps";

type WorkerDeps = {
  parseReportMsg: typeof parseReportGenerationMessage;
  parsePromptMsg: typeof parsePromptImprovementMessage;
  updateStatus: typeof updateReportStatus;
  getInput: typeof getInputJson;
  generateDraft: typeof generateReportDraft;
  saveDraft: typeof saveAiDraft;
  getActiveRun: typeof getActivePromptImprovementRun;
  markRunning: typeof markPromptImprovementRunRunning;
  markSuperseded: typeof markPromptImprovementRunSuperseded;
  runPromptJob: typeof runPromptImprovementJob;
  appendEvent: typeof appendAgentEvent;
};

const defaultDeps: WorkerDeps = {
  parseReportMsg: parseReportGenerationMessage,
  parsePromptMsg: parsePromptImprovementMessage,
  updateStatus: updateReportStatus,
  getInput: getInputJson,
  generateDraft: generateReportDraft,
  saveDraft: saveAiDraft,
  getActiveRun: getActivePromptImprovementRun,
  markRunning: markPromptImprovementRunRunning,
  markSuperseded: markPromptImprovementRunSuperseded,
  runPromptJob: runPromptImprovementJob,
  appendEvent: appendAgentEvent,
};

function stepLabel(key: GenerationStepKey): string {
  return GENERATION_STEPS.find((s) => s.key === key)?.label ?? key;
}

function stepTone(key: GenerationStepKey) {
  return GENERATION_STEPS.find((s) => s.key === key)?.goodjob;
}

function knowledgeStepLabel(key: KnowledgeImprovementStepKey): string {
  return KNOWLEDGE_IMPROVEMENT_STEPS.find((s) => s.key === key)?.label ?? key;
}

function knowledgeStepTone(key: KnowledgeImprovementStepKey) {
  return KNOWLEDGE_IMPROVEMENT_STEPS.find((s) => s.key === key)?.goodjob;
}

export async function handleReportMessage(body: unknown, deps: WorkerDeps = defaultDeps): Promise<void> {
  const parsed = deps.parseReportMsg(body);
  if (!parsed) return;

  const { reportId } = parsed;
  let currentStep: GenerationStepKey = "parse_input";

  const emit = async (
    stepKey: GenerationStepKey,
    state: "started" | "completed" | "failed",
    extra?: { metadata?: Record<string, unknown>; errorMessage?: string }
  ) => {
    try {
      await deps.appendEvent({
        entityType: "report",
        reportId,
        runId: null,
        stepKey,
        stepLabel: stepLabel(stepKey),
        state,
        goodjobTone: stepTone(stepKey),
        metadata: extra?.metadata,
        errorMessage: extra?.errorMessage,
      });
    } catch (err) {
      console.warn("appendEvent failed", err);
    }
  };

  const onStep: GenerationStepReporter = async (e) => {
    currentStep = e.stepKey;
    await emit(e.stepKey, e.state, { metadata: e.metadata, errorMessage: e.errorMessage });
  };

  try {
    await deps.updateStatus(reportId, "generating_report");

    currentStep = "parse_input";
    await emit("parse_input", "started");
    const input = await deps.getInput(reportId);
    if (!input) throw new Error(`input not found: ${reportId}`);
    await emit("parse_input", "completed");

    const draft = await deps.generateDraft(input, onStep);
    draft.id = reportId;
    draft.status = "waiting_human_review";

    currentStep = "prepare_review";
    await emit("prepare_review", "started");
    await deps.saveDraft(reportId, draft);
    await emit("prepare_review", "completed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    await emit(currentStep, "failed", { errorMessage: msg });
    await deps.updateStatus(reportId, "failed", msg);
    throw err;
  }
}

export async function handlePromptImprovementMessage(body: unknown, deps: WorkerDeps = defaultDeps): Promise<void> {
  const parsed = deps.parsePromptMsg(body);
  if (!parsed) return;

  const { runId, locationKey } = parsed;
  const activeRun = await deps.getActiveRun(locationKey);
  if (!activeRun || activeRun.id !== runId) {
    const reason = activeRun ? `newer active run exists: ${activeRun.id}` : "no active run for this locationKey";
    await deps.markSuperseded(runId, reason);
    return;
  }

  await deps.markRunning(runId);

  const onStep: KnowledgeStepReporter = async (e) => {
    try {
      await deps.appendEvent({
        entityType: "prompt_improvement_run",
        reportId: null,
        runId,
        stepKey: e.stepKey,
        stepLabel: knowledgeStepLabel(e.stepKey),
        state: e.state,
        goodjobTone: knowledgeStepTone(e.stepKey),
        metadata: e.metadata,
        errorMessage: e.errorMessage,
      });
    } catch (err) {
      console.warn("appendEvent failed", err);
    }
  };

  await deps.runPromptJob({ runId, locationKey }, undefined, onStep);
}

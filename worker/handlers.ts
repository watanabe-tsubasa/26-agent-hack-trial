import { generateReportDraft } from "../lib/mock-agent";
import { getInputJson, saveAiDraft, updateReportStatus } from "../lib/report-repository";
import { parsePromptImprovementMessage, parseReportGenerationMessage } from "../lib/job-messages";
import { runPromptImprovementJob } from "../lib/prompt-improvement-processor";
import {
  getActivePromptImprovementRun,
  markPromptImprovementRunRunning,
  markPromptImprovementRunSuperseded,
} from "../lib/prompt-improvement-run-repository";

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
};

export async function handleReportMessage(body: unknown, deps: WorkerDeps = defaultDeps): Promise<void> {
  const parsed = deps.parseReportMsg(body);
  if (!parsed) return;

  const { reportId } = parsed;
  try {
    await deps.updateStatus(reportId, "generating_report");
    const input = await deps.getInput(reportId);
    if (!input) throw new Error(`input not found: ${reportId}`);

    const draft = await deps.generateDraft(input);
    draft.id = reportId;
    draft.status = "waiting_human_review";

    await deps.saveDraft(reportId, draft);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
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
  await deps.runPromptJob({ runId, locationKey });
}

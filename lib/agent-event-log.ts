import { randomUUID } from "crypto";
import { getCosmosContainer } from "./cosmos";
import type { GoodjobTone, StepState } from "./generation-steps";

export type AgentEventState = "started" | "completed" | "failed";
export type AgentEntityType = "report" | "prompt_improvement_run";

export type AgentEvent = {
  id: string;
  entityType: AgentEntityType;
  entityId: string; // partition key in Cosmos (= reportId or runId)
  reportId: string | null;
  runId: string | null;
  stepKey: string;
  stepLabel: string;
  state: AgentEventState;
  goodjobTone?: GoodjobTone;
  occurredAt: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
};

export type AppendAgentEventInput = Omit<AgentEvent, "id" | "entityId" | "occurredAt"> & {
  occurredAt?: string;
};

export function buildAgentEventDoc(event: AppendAgentEventInput): AgentEvent | null {
  const entityId =
    event.entityType === "report" ? event.reportId : event.runId;
  if (!entityId) return null;

  return {
    id: randomUUID(),
    entityType: event.entityType,
    entityId,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    reportId: event.reportId,
    runId: event.runId,
    stepKey: event.stepKey,
    stepLabel: event.stepLabel,
    state: event.state,
    goodjobTone: event.goodjobTone,
    durationMs: event.durationMs,
    metadata: event.metadata,
    errorMessage: event.errorMessage,
  };
}

export async function appendAgentEvent(event: AppendAgentEventInput): Promise<void> {
  const container = getCosmosContainer();
  if (!container) return;

  const doc = buildAgentEventDoc(event);
  if (!doc) {
    console.warn(
      `appendAgentEvent skipped: missing id for entityType=${event.entityType}`
    );
    return;
  }

  try {
    await container.items.create(doc);
  } catch (err) {
    console.warn("appendAgentEvent failed", err);
  }
}

async function listEventsByEntity(entityId: string): Promise<AgentEvent[]> {
  const container = getCosmosContainer();
  if (!container) return [];

  try {
    const { resources } = await container.items
      .query<AgentEvent>(
        {
          query: "SELECT * FROM c WHERE c.entityId = @id ORDER BY c.occurredAt ASC",
          parameters: [{ name: "@id", value: entityId }],
        },
        { partitionKey: entityId }
      )
      .fetchAll();
    return resources;
  } catch (err) {
    console.warn(`listEventsByEntity failed`, err);
    return [];
  }
}

export function listAgentEventsByReport(reportId: string): Promise<AgentEvent[]> {
  return listEventsByEntity(reportId);
}

export function listAgentEventsByRun(runId: string): Promise<AgentEvent[]> {
  return listEventsByEntity(runId);
}

export function deriveStepStateFromEvent(state: AgentEventState): StepState {
  if (state === "started") return "in_progress";
  if (state === "completed") return "completed";
  return "failed";
}

export type ReportGenerationJobMessage = {
  reportId: string;
};

export type PromptImprovementJobMessage = {
  runId: string;
  locationKey: string;
};

export function parseReportGenerationMessage(
  body: unknown
): ReportGenerationJobMessage | null {
  if (typeof body === "string" && body.length > 0) {
    return { reportId: body };
  }
  if (typeof body === "object" && body !== null) {
    const obj = body as Record<string, unknown>;
    if (typeof obj.reportId === "string" && obj.reportId.length > 0) {
      return { reportId: obj.reportId };
    }
  }
  return null;
}

export function parsePromptImprovementMessage(
  body: unknown
): PromptImprovementJobMessage | null {
  if (typeof body !== "object" || body === null) return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.runId !== "string" || obj.runId.length === 0) return null;
  if (typeof obj.locationKey !== "string" || obj.locationKey.length === 0) return null;
  return { runId: obj.runId, locationKey: obj.locationKey };
}

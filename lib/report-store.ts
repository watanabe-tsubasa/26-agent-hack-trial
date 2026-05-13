import type { CreateReportInput, Photo, ProcessingStep, Report } from "./types";
import { PROCESSING_STEPS, STEP_DURATION_MS, TOTAL_PROCESSING_MS } from "./types";
import { generateReportDraft } from "./mock-agent";
import { recordFeedbacks } from "./diff";

// Module-level in-memory store (prototype only)
const reports = new Map<string, Report>();
const processingStartTimes = new Map<string, number>();
let reportIdCounter = 1;

function nextId(): string {
  return `report_${String(reportIdCounter++).padStart(3, "0")}`;
}

export async function createReport(input: CreateReportInput): Promise<string> {
  const id = nextId();
  const draft = await generateReportDraft(input);
  draft.id = id;
  draft.status = "processing";
  reports.set(id, draft);
  processingStartTimes.set(id, Date.now());
  return id;
}

export function getProcessingSteps(reportId: string): {
  status: "processing" | "completed";
  steps: ProcessingStep[];
} | null {
  const report = reports.get(reportId);
  if (!report) return null;

  if (report.status !== "processing") {
    return {
      status: "completed",
      steps: PROCESSING_STEPS.map((label) => ({ label, status: "completed" })),
    };
  }

  const startTime = processingStartTimes.get(reportId) ?? Date.now();
  const elapsed = Date.now() - startTime;

  if (elapsed >= TOTAL_PROCESSING_MS) {
    report.status = "review";
    processingStartTimes.delete(reportId);
    return {
      status: "completed",
      steps: PROCESSING_STEPS.map((label) => ({ label, status: "completed" })),
    };
  }

  const completedCount = Math.floor(elapsed / STEP_DURATION_MS);
  const steps: ProcessingStep[] = PROCESSING_STEPS.map((label, i) => {
    if (i < completedCount) return { label, status: "completed" };
    if (i === completedCount) return { label, status: "in_progress" };
    return { label, status: "pending" };
  });

  return { status: "processing", steps };
}

function maybeTransitionToReview(reportId: string): void {
  const report = reports.get(reportId);
  if (!report || report.status !== "processing") return;
  const startTime = processingStartTimes.get(reportId);
  if (!startTime) return;
  if (Date.now() - startTime >= TOTAL_PROCESSING_MS) {
    report.status = "review";
    processingStartTimes.delete(reportId);
  }
}

export function getReport(reportId: string): Report | null {
  maybeTransitionToReview(reportId);
  return reports.get(reportId) ?? null;
}

export function updateReport(
  reportId: string,
  updates: Partial<Report>
): Report | null {
  const report = reports.get(reportId);
  if (!report) return null;

  const newFeedbacks = recordFeedbacks(report, updates);

  const updatedPhotos = updates.photos
    ? mergePhotos(report.photos, updates.photos as Partial<Photo>[])
    : report.photos;

  const updated: Report = {
    ...report,
    ...updates,
    photos: updatedPhotos,
    fiveWTwoH: updates.fiveWTwoH
      ? { ...report.fiveWTwoH, ...updates.fiveWTwoH }
      : report.fiveWTwoH,
    status: "updated",
    feedbacks: [...report.feedbacks, ...newFeedbacks],
    updatedAt: new Date().toISOString(),
  };
  reports.set(reportId, updated);
  return updated;
}

function mergePhotos(
  current: Photo[],
  patches: Partial<Photo>[]
): Photo[] {
  return current.map((photo) => {
    const patch = patches.find((p) => p.id === photo.id);
    return patch ? { ...photo, ...patch } : photo;
  });
}

export function deletePhoto(reportId: string, photoId: string): Report | null {
  const report = reports.get(reportId);
  if (!report) return null;
  const updated = {
    ...report,
    photos: report.photos.filter((p) => p.id !== photoId),
    updatedAt: new Date().toISOString(),
  };
  reports.set(reportId, updated);
  return updated;
}

export function reorderPhotos(reportId: string, orderedIds: string[]): Report | null {
  const report = reports.get(reportId);
  if (!report) return null;
  const photoMap = new Map(report.photos.map((p) => [p.id, p]));
  const reordered = orderedIds.flatMap((id) => {
    const p = photoMap.get(id);
    return p ? [p] : [];
  });
  const updated = { ...report, photos: reordered, updatedAt: new Date().toISOString() };
  reports.set(reportId, updated);
  return updated;
}

export function confirmReport(reportId: string): Report | null {
  const report = reports.get(reportId);
  if (!report) return null;
  const confirmed = { ...report, status: "confirmed" as const, updatedAt: new Date().toISOString() };
  reports.set(reportId, confirmed);
  return confirmed;
}

export function getAllReports(): Report[] {
  return [...reports.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

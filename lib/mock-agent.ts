import type { CreateReportInput, Photo, Report } from "./types";
import { fetchCameraImagesMock } from "./mock-camera";
import { analyzeImagesMock } from "./mock-vision";
import { generateReportContent } from "./report-template";

export async function generateReportDraft(input: CreateReportInput): Promise<Report> {
  const photos: Photo[] = await fetchCameraImagesMock({
    occurredAt: input.occurredAt,
    location: input.location,
    summary: input.summary,
  });

  const imageObservation = await analyzeImagesMock(photos);
  const content = generateReportContent(input, photos, imageObservation);

  const now = new Date().toISOString();
  const aiOutput = {
    victim: content.victim,
    fiveWTwoH: content.fiveWTwoH,
    cause: content.cause,
    treatment: content.treatment,
    preventiveAction: content.preventiveAction,
    body: content.body,
    photos,
  };

  return {
    id: "",
    status: "review",
    title: content.title,
    summary: input.summary,
    occurredAt: input.occurredAt,
    location: input.location,
    note: input.note,
    reportedAt: now,
    reporter: "施設管理担当者",
    department: "施設管理部",
    recoveredAt: null,
    amount: input.amountImpact,
    victim: content.victim,
    fiveWTwoH: content.fiveWTwoH,
    cause: content.cause,
    treatment: content.treatment,
    preventiveAction: content.preventiveAction,
    body: content.body,
    photos,
    originalAiOutput: aiOutput,
    feedbacks: [],
    createdAt: now,
    updatedAt: now,
  };
}

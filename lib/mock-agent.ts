import type { CreateReportInput, Report } from "./types";
import { searchCameraFrames } from "./camera-search";
import { analyzeImagesMock } from "./mock-vision";
import { generateReportContent } from "./report-template";
import { generateAccidentReportWithAI } from "./accident-report-ai";

export async function generateReportDraft(input: CreateReportInput): Promise<Report> {
  const photos = await searchCameraFrames(input);
  const imageObservation = await analyzeImagesMock(photos);

  let content;
  if (process.env.AI_REPORT_GENERATION_ENABLED === "true") {
    try {
      content = await generateAccidentReportWithAI({ input, photos, imageObservation });
    } catch (err) {
      console.error("AI report generation failed. Falling back to mock.", err);
      content = generateReportContent(input, photos, imageObservation);
    }
  } else {
    content = generateReportContent(input, photos, imageObservation);
  }

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
    reporter: "担当者",
    department: "",
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

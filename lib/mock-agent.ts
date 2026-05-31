import type { CreateReportInput, Photo, Report } from "./types";
import { searchCameraFrames } from "./camera-search";
import { analyzeImagesMock } from "./mock-vision";
import { generateReportContent } from "./report-template";
import { generateAccidentReportWithAI } from "./accident-report-ai";
import {
  applyImageEvaluationToPhotos,
  buildImageObservationText,
  evaluateImagesWithAI,
} from "./image-evaluation-ai";
import type { GenerationStepKey } from "./generation-steps";
import type { AgentEventState } from "./agent-event-log";

export type GenerationStepReporter = (event: {
  stepKey: GenerationStepKey;
  state: AgentEventState;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}) => void | Promise<void>;

async function resolvePhotosAndObservation(
  input: CreateReportInput,
  photoCandidates: Photo[]
): Promise<{ photos: Photo[]; imageObservation: string; usedFallback: boolean }> {
  const aiEnabled = process.env.AI_IMAGE_EVALUATION_ENABLED === "true";

  if (!aiEnabled || photoCandidates.length === 0) {
    const imageObservation = await analyzeImagesMock(photoCandidates);
    return { photos: photoCandidates, imageObservation, usedFallback: false };
  }

  try {
    const evaluation = await evaluateImagesWithAI({ input, photos: photoCandidates });
    const photos = applyImageEvaluationToPhotos(photoCandidates, evaluation);
    const imageObservation = buildImageObservationText(evaluation);
    return { photos, imageObservation, usedFallback: false };
  } catch (err) {
    console.error("Image evaluation failed. Falling back to analyzeImagesMock.", err);
    const imageObservation = await analyzeImagesMock(photoCandidates);
    return { photos: photoCandidates, imageObservation, usedFallback: true };
  }
}

export async function generateReportDraft(
  input: CreateReportInput,
  onStep?: GenerationStepReporter
): Promise<Report> {
  await onStep?.({ stepKey: "search_camera_frames", state: "started" });
  const photoCandidates = await searchCameraFrames(input);
  await onStep?.({
    stepKey: "search_camera_frames",
    state: "completed",
    metadata: { candidateCount: photoCandidates.length },
  });

  await onStep?.({ stepKey: "evaluate_images", state: "started" });
  const { photos, imageObservation, usedFallback } = await resolvePhotosAndObservation(
    input,
    photoCandidates
  );
  await onStep?.({
    stepKey: "evaluate_images",
    state: "completed",
    metadata: { photosUsed: photos.length, usedFallback },
  });

  console.log(
    `report draft generation: photoCandidates=${photoCandidates.length}, photosUsed=${photos.length}, imageEvalFallback=${usedFallback}`
  );

  await onStep?.({ stepKey: "generate_report", state: "started" });
  let content;
  if (process.env.AI_REPORT_GENERATION_ENABLED === "true") {
    try {
      content = await generateAccidentReportWithAI({
        input,
        photos,
        imageObservation,
        locationKey: input.facilityId,
      });
    } catch (err) {
      console.error("AI report generation failed. Falling back to mock.", err);
      content = generateReportContent(input, photos, imageObservation);
    }
  } else {
    content = generateReportContent(input, photos, imageObservation);
  }
  await onStep?.({ stepKey: "generate_report", state: "completed" });

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

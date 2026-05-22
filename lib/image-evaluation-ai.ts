import { getAzureOpenAIClient } from "./azure-openai";
import { generateBlobReadSasUrl } from "./blob-storage";
import {
  imageEvaluationOutputJsonSchema,
  imageEvaluationOutputSchema,
  type ImageEvaluationOutput,
} from "./image-evaluation-schema";
import { IMAGE_EVALUATION_SYSTEM_PROMPT } from "./image-evaluation-prompt";
import type { CreateReportInput, Photo } from "./types";

type EvaluateArgs = {
  input: CreateReportInput;
  photos: Photo[];
};

export async function evaluateImagesWithAI({
  input,
  photos,
}: EvaluateArgs): Promise<ImageEvaluationOutput> {
  if (photos.length === 0) {
    return { summary: "評価対象の画像はありません。", results: [] };
  }

  const client = getAzureOpenAIClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT_NAME is not set");

  const photosWithSas = await Promise.all(
    photos.map(async (p) => {
      if (!p.blobContainer || !p.blobName) {
        throw new Error(`Photo ${p.id} has no blobContainer/blobName for SAS generation`);
      }
      const sasUrl = await generateBlobReadSasUrl(p.blobContainer, p.blobName);
      return { photo: p, sasUrl };
    })
  );

  console.log(
    `image evaluation start: imageCount=${photos.length}, deployment=${deployment}`
  );

  const contextText = JSON.stringify(
    {
      accidentInput: input,
      photoCandidates: photos.map((p) => ({
        id: p.id,
        cameraName: p.cameraName,
        capturedAt: p.capturedAt,
        photoLocationName: p.photoLocationName,
      })),
    },
    null,
    2
  );

  const imageContents = photosWithSas.flatMap(({ photo, sasUrl }) => [
    {
      type: "input_text" as const,
      text: `[image] imageId=${photo.id}`,
    },
    {
      type: "input_image" as const,
      image_url: sasUrl,
      detail: "auto" as const,
    },
  ]);

  const response = await client.responses.create({
    model: deployment,
    instructions: IMAGE_EVALUATION_SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: contextText },
          ...imageContents,
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "image_evaluation_output",
        strict: true,
        schema: imageEvaluationOutputJsonSchema,
      },
    },
  });

  const raw = response.output_text;
  if (!raw) throw new Error("Azure OpenAI response content is empty");

  const parsed = imageEvaluationOutputSchema.parse(JSON.parse(raw));

  const selectedCount = parsed.results.filter((r) => r.shouldUseInLedger).length;
  console.log(
    `image evaluation done: imageCount=${photos.length}, selectedCount=${selectedCount}`
  );

  return parsed;
}

export function buildImageObservationText(evaluation: ImageEvaluationOutput): string {
  if (evaluation.results.length === 0) return evaluation.summary;

  const lines: string[] = [];
  lines.push(`総評: ${evaluation.summary}`);
  for (const result of evaluation.results) {
    lines.push("");
    lines.push(
      `- imageId: ${result.imageId} (relevance=${result.relevanceScore.toFixed(2)}, useInLedger=${result.shouldUseInLedger})`
    );
    if (result.observedFacts.length > 0) {
      lines.push(`  観察事実:`);
      for (const fact of result.observedFacts) lines.push(`    - ${fact}`);
    }
    if (result.suggestedCaption) {
      lines.push(`  キャプション案: ${result.suggestedCaption}`);
    }
    if (result.riskNotes.length > 0) {
      lines.push(`  注意:`);
      for (const note of result.riskNotes) lines.push(`    - ${note}`);
    }
  }
  return lines.join("\n");
}

export function applyImageEvaluationToPhotos(
  photos: Photo[],
  evaluation: ImageEvaluationOutput
): Photo[] {
  const resultsById = new Map(evaluation.results.map((r) => [r.imageId, r]));

  const enriched = photos.map((photo) => {
    const result = resultsById.get(photo.id);
    if (!result) return photo;
    return {
      ...photo,
      caption: result.suggestedCaption || photo.caption,
      relevanceScore: result.relevanceScore,
      observedFacts: result.observedFacts,
    };
  });

  const usable = enriched.filter((photo) => {
    const result = resultsById.get(photo.id);
    if (!result) return true;
    return result.shouldUseInLedger;
  });

  usable.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  return usable;
}

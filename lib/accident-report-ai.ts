import { getAzureOpenAIClient } from "./azure-openai";
import { generatedContentJsonSchema, generatedContentSchema } from "./accident-report-schema";
import { ACCIDENT_REPORT_SYSTEM_PROMPT } from "./accident-report-prompt";
import type { CreateReportInput, Photo } from "./types";

type GenerateArgs = {
  input: CreateReportInput;
  photos: Photo[];
  imageObservation: string;
};

export async function generateAccidentReportWithAI({
  input,
  photos,
  imageObservation,
}: GenerateArgs) {
  const client = getAzureOpenAIClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

  if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT_NAME is not set");
  
  const payload = {
    accidentInput: input,
    imageObservation,
    photoCandidates: photos.map((p) => ({
      id: p.id,
      cameraName: p.cameraName,
      capturedAt: p.capturedAt,
    })),
  };

  const response = await client.responses.create({
    model: deployment,
    // temperature: 0.2,
    instructions: ACCIDENT_REPORT_SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
          name: "accident_report_content",
          strict: true,
          schema: generatedContentJsonSchema,
      },
    }
  });

  const raw = response.output_text;
  if (!raw) throw new Error("Azure OpenAI response content is empty");

  return generatedContentSchema.parse(JSON.parse(raw));
}

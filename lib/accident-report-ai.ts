import { getAzureOpenAIClient } from "./azure-openai";
import { generatedContentJsonSchema, generatedContentSchema } from "./accident-report-schema";
import { ACCIDENT_REPORT_SYSTEM_PROMPT } from "./accident-report-prompt";
import { getActiveLocationPromptOverride } from "./location-prompt-override-repository";
import type { CreateReportInput, Photo } from "./types";

type GenerateArgs = {
  input: CreateReportInput;
  photos: Photo[];
  imageObservation: string;
  locationKey?: string;
};

export async function generateAccidentReportWithAI({
  input,
  photos,
  imageObservation,
  locationKey,
}: GenerateArgs) {
  const client = getAzureOpenAIClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  console.log(`locationKey: ${locationKey}`);

  if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT_NAME is not set");

  let systemPrompt = ACCIDENT_REPORT_SYSTEM_PROMPT;
  if (locationKey) {
    try {
      const override = await getActiveLocationPromptOverride(locationKey);
      if (override) {
        systemPrompt = [
          ACCIDENT_REPORT_SYSTEM_PROMPT,
          [
            "",
            "# 施設固有の参考情報",
            "以下はこの施設に関する既知情報です。事故概要と関連する場合のみ参考にしてください。",
            "確定原因として断定しないでください。",
            "",
            override.overrideText,
          ].join("\n"),
        ].join("\n");
        console.log(
          `facility knowledge loaded: id=${override.id}, locationKey=${override.locationKey}, status=${override.status}, contentLength=${override.overrideText.length}`
        );
      }
      console.log(
        `system prompt updated: ${systemPrompt.includes("施設固有の参考情報")}`
      );
    } catch (err) {
      console.error("Failed to fetch location prompt override (using base prompt):", err);
    }
  }

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
    instructions: systemPrompt,
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
    },
  });

  const raw = response.output_text;
  if (!raw) throw new Error("Azure OpenAI response content is empty");

  return generatedContentSchema.parse(JSON.parse(raw));
}

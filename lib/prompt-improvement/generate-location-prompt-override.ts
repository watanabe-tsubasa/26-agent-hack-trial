import { getAzureOpenAIClient } from "../azure-openai";
import {
  locationPromptOverrideProposalJsonSchema,
  locationPromptOverrideProposalSchema,
  type LocationPromptOverrideProposal,
} from "../prompt-improvement/location-prompt-override-schema";
import { PROMPT_IMPROVEMENT_SYSTEM_PROMPT } from "../prompt-improvement/location-prompt-override-prompt";
import type { JsonDiffItem } from "../prompt-improvement/json-diff";

export type CorrectionDiffSet = {
  reportId: string;
  items: JsonDiffItem[];
};

type CorrectionExample = {
  reportId: string;
  fieldPath: string;
  before: string;
  after: string;
};

type CorrectionSummary = {
  locationKey: string;
  correctionCount: number;
  frequentFields: string[];
  examples: CorrectionExample[];
};

export function buildCorrectionSummary(
  locationKey: string,
  diffSets: CorrectionDiffSet[]
): CorrectionSummary {
  const fieldCounts: Record<string, number> = {};
  const examples: CorrectionExample[] = [];

  for (const { reportId, items } of diffSets) {
    for (const item of items) {
      if (item.changeType !== "update") continue;
      fieldCounts[item.fieldPath] = (fieldCounts[item.fieldPath] ?? 0) + 1;
      if (
        examples.length < 10 &&
        typeof item.before === "string" &&
        typeof item.after === "string"
      ) {
        examples.push({
          reportId,
          fieldPath: item.fieldPath,
          before: item.before,
          after: item.after,
        });
      }
    }
  }

  const frequentFields = Object.entries(fieldCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([field]) => field);

  return {
    locationKey,
    correctionCount: diffSets.length,
    frequentFields,
    examples,
  };
}

export async function generateLocationPromptOverride(
  summary: CorrectionSummary
): Promise<LocationPromptOverrideProposal> {
  const client = getAzureOpenAIClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

  if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT_NAME is not set");

  const response = await client.responses.create({
    model: deployment,
    instructions: PROMPT_IMPROVEMENT_SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "location_prompt_override_proposal",
        strict: true,
        schema: locationPromptOverrideProposalJsonSchema,
      },
    },
  });

  const raw = response.output_text;
  if (!raw) throw new Error("Azure OpenAI response content is empty");

  return locationPromptOverrideProposalSchema.parse(JSON.parse(raw));
}

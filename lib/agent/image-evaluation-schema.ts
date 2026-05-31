import { z } from "zod";

export const imageEvaluationResultSchema = z.object({
  imageId: z.string(),
  relevanceScore: z.number().min(0).max(1),
  shouldUseInLedger: z.boolean(),
  observedFacts: z.array(z.string()),
  suggestedCaption: z.string(),
  riskNotes: z.array(z.string()),
});

export const imageEvaluationOutputSchema = z.object({
  summary: z.string(),
  results: z.array(imageEvaluationResultSchema),
});

export type ImageEvaluationResult = z.infer<typeof imageEvaluationResultSchema>;
export type ImageEvaluationOutput = z.infer<typeof imageEvaluationOutputSchema>;

export const imageEvaluationOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          imageId: { type: "string" },
          relevanceScore: { type: "number" },
          shouldUseInLedger: { type: "boolean" },
          observedFacts: {
            type: "array",
            items: { type: "string" },
          },
          suggestedCaption: { type: "string" },
          riskNotes: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "imageId",
          "relevanceScore",
          "shouldUseInLedger",
          "observedFacts",
          "suggestedCaption",
          "riskNotes",
        ],
      },
    },
  },
  required: ["summary", "results"],
} as const;

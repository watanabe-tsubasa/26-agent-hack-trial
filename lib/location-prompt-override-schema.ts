import { z } from "zod";

const observedCorrectionPatternSchema = z.object({
  fieldPath: z.string(),
  pattern: z.string(),
  recommendation: z.string(),
});

export const locationPromptOverrideProposalSchema = z.object({
  title: z.string(),
  summary: z.string(),
  observedCorrectionPatterns: z.array(observedCorrectionPatternSchema),
  overrideText: z.string(),
  riskNotes: z.array(z.string()),
});

export type LocationPromptOverrideProposal = z.infer<typeof locationPromptOverrideProposalSchema>;

export const locationPromptOverrideProposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    observedCorrectionPatterns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fieldPath: { type: "string" },
          pattern: { type: "string" },
          recommendation: { type: "string" },
        },
        required: ["fieldPath", "pattern", "recommendation"],
      },
    },
    overrideText: { type: "string" },
    riskNotes: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["title", "summary", "observedCorrectionPatterns", "overrideText", "riskNotes"],
} as const;

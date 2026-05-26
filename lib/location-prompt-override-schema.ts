import { z } from "zod";

export const FACILITY_KNOWLEDGE_CATEGORIES = [
  "leakage",
  "construction",
  "layout",
  "equipment",
  "incident_history",
  "maintenance_note",
  "naming",
  "other",
] as const;

export type FacilityKnowledgeCategory = (typeof FACILITY_KNOWLEDGE_CATEGORIES)[number];

const evidenceSchema = z.object({
  reportId: z.string(),
  fieldPath: z.string(),
  quotedCorrection: z.string(),
});

const facilityKnowledgeCandidateSchema = z.object({
  category: z.enum(FACILITY_KNOWLEDGE_CATEGORIES),
  title: z.string(),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema),
  shouldApplyToGeneration: z.boolean(),
  riskNotes: z.array(z.string()),
});

const ignoredStyleCorrectionSchema = z.object({
  fieldPath: z.string(),
  reason: z.string(),
});

export const locationPromptOverrideProposalSchema = z.object({
  title: z.string(),
  summary: z.string(),
  facilityKnowledgeCandidates: z.array(facilityKnowledgeCandidateSchema),
  ignoredStyleCorrections: z.array(ignoredStyleCorrectionSchema),
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
    facilityKnowledgeCandidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: {
            type: "string",
            enum: [...FACILITY_KNOWLEDGE_CATEGORIES],
          },
          title: { type: "string" },
          content: { type: "string" },
          confidence: { type: "number" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                reportId: { type: "string" },
                fieldPath: { type: "string" },
                quotedCorrection: { type: "string" },
              },
              required: ["reportId", "fieldPath", "quotedCorrection"],
            },
          },
          shouldApplyToGeneration: { type: "boolean" },
          riskNotes: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "category",
          "title",
          "content",
          "confidence",
          "evidence",
          "shouldApplyToGeneration",
          "riskNotes",
        ],
      },
    },
    ignoredStyleCorrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fieldPath: { type: "string" },
          reason: { type: "string" },
        },
        required: ["fieldPath", "reason"],
      },
    },
    overrideText: { type: "string" },
    riskNotes: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "title",
    "summary",
    "facilityKnowledgeCandidates",
    "ignoredStyleCorrections",
    "overrideText",
    "riskNotes",
  ],
} as const;

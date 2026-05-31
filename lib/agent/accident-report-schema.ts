import { z } from "zod";

export const generatedContentSchema = z.object({
  title: z.string(),
  victim: z.object({
    hasVictim: z.boolean(),
    category: z.enum(["なし", "従業員", "協力会社", "来館者", "テナント関係者", "その他"]),
    gender: z.enum(["男性", "女性", "その他"]).nullable(),
    age: z.number().nullable(),
    damageLevel: z.string(),
    note: z.string(),
  }),
  fiveWTwoH: z.object({
    when: z.string(),
    where: z.string(),
    who: z.string(),
    what: z.string(),
    why: z.string(),
    how: z.string(),
    howMuch: z.string(),
  }),
  cause: z.string(),
  treatment: z.string(),
  preventiveAction: z.string(),
  body: z.string(),
});

export type GeneratedContent = z.infer<typeof generatedContentSchema>;

export const generatedContentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    victim: {
      type: "object",
      additionalProperties: false,
      properties: {
        hasVictim: { type: "boolean" },
        category: {
          type: "string",
          enum: ["なし", "従業員", "協力会社", "来館者", "テナント関係者", "その他"],
        },
        gender: {
          anyOf: [
            { type: "string", enum: ["男性", "女性", "その他"] },
            { type: "null" },
          ],
        },
        age: { anyOf: [{ type: "number" }, { type: "null" }] },
        damageLevel: { type: "string" },
        note: { type: "string" },
      },
      required: ["hasVictim", "category", "gender", "age", "damageLevel", "note"],
    },
    fiveWTwoH: {
      type: "object",
      additionalProperties: false,
      properties: {
        when: { type: "string" },
        where: { type: "string" },
        who: { type: "string" },
        what: { type: "string" },
        why: { type: "string" },
        how: { type: "string" },
        howMuch: { type: "string" },
      },
      required: ["when", "where", "who", "what", "why", "how", "howMuch"],
    },
    cause: { type: "string" },
    treatment: { type: "string" },
    preventiveAction: { type: "string" },
    body: { type: "string" },
  },
  required: [
    "title",
    "victim",
    "fiveWTwoH",
    "cause",
    "treatment",
    "preventiveAction",
    "body",
  ],
} as const;

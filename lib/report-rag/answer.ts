import { getAzureOpenAIClient } from "../azure-openai";
import type { FacilityAggregate } from "./aggregate-reports";
import type { ReportSearchHit } from "./search-reports";

const SYSTEM_PROMPT = [
  "あなたは事故報お任せグッジョくんの管理者向けRAGアシスタントです。",
  "管理者は厳密な事故報IDや内部用語を知らずに自然な日本語で質問します。",
  "提示された根拠（事故報や集計データ）のみを使って回答してください。",
  "根拠が無い場合は推測せず、「該当する事故報が見つかりませんでした」と伝えてください。",
  "出力は次の順序で簡潔に：",
  "1. 結論（1〜2文）",
  "2. 補足（必要に応じて短く）",
  "3. 該当事故報（タイトル / サイト名）を箇条書き",
].join("\n");

type AnswerInput =
  | { mode: "aggregate"; message: string; aggregate: FacilityAggregate[] }
  | { mode: "search"; message: string; sources: ReportSearchHit[] };

function renderUserPrompt(input: AnswerInput): string {
  if (input.mode === "aggregate") {
    const lines = input.aggregate.length
      ? input.aggregate
          .map((a, i) => `${i + 1}. ${a.siteName} (${a.facilityId}): ${a.count} 件`)
          .join("\n")
      : "(集計データなし)";
    return [
      `質問: ${input.message}`,
      "",
      "集計データ（confirmed 事故報）:",
      lines,
    ].join("\n");
  }
  const lines = input.sources.length
    ? input.sources
        .map(
          (s, i) =>
            `${i + 1}. [${s.title}] サイト=${s.siteName} reportId=${s.reportId}\n   抜粋: ${s.snippet}`
        )
        .join("\n")
    : "(該当なし)";
  return [
    `質問: ${input.message}`,
    "",
    "関連する事故報:",
    lines,
  ].join("\n");
}

export async function generateRagAnswer(input: AnswerInput): Promise<{ answer: string }> {
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT_NAME is not set");

  const client = getAzureOpenAIClient();
  const res = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: renderUserPrompt(input) },
    ],
    temperature: 0.2,
  });

  const answer = res.choices[0]?.message?.content?.trim() ?? "";
  return { answer };
}

export const __test__ = { renderUserPrompt };

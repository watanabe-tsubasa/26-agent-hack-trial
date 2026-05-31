import { getAzureOpenAIClient } from "../azure-openai";
import type { FacilityAggregate } from "./aggregate-reports";
import type { ReportSearchHit } from "./search-reports";

const SYSTEM_PROMPT = [
  "あなたは事故報お任せグッジョくんの管理者向けRAGアシスタントです。",
  "管理者は厳密な事故報IDや内部用語を知らずに自然な日本語で質問します。",
  "直前の会話文脈を踏まえつつ、回答の根拠は今回提示された事故報や集計データのみを使ってください。",
  "根拠が無い場合は推測せず、「該当する事故報が見つかりませんでした」と伝えてください。",
  "出力は次の順序で簡潔に：",
  "1. 結論（1〜2文）",
  "2. 補足（必要に応じて短く）",
  "3. 該当事故報（タイトル / サイト名）を箇条書き",
].join("\n");

export type ChatHistoryItem = { role: "user" | "assistant"; content: string };

type AnswerInput =
  | {
      mode: "aggregate";
      message: string;
      aggregate: FacilityAggregate[];
      history?: ChatHistoryItem[];
    }
  | {
      mode: "search";
      message: string;
      sources: ReportSearchHit[];
      history?: ChatHistoryItem[];
    };

const HISTORY_LIMIT = 6;

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

// Use the EasyInputMessage form (plain string content) for history items.
// Reason: Responses API rejects `{ type: "input_text" }` parts inside an
// assistant turn (it requires `output_text`/`refusal` which need extra fields
// like id/status). Passing `content: string` lets the SDK encode each role
// correctly without us replicating ResponseOutputMessage shape.
type ResponsesInputItem = {
  role: "user" | "assistant";
  content: string;
};

function toHistoryItem(h: ChatHistoryItem): ResponsesInputItem {
  return { role: h.role, content: h.content };
}

function buildInputItems(input: AnswerInput): ResponsesInputItem[] {
  const history = (input.history ?? []).slice(-HISTORY_LIMIT);
  const items: ResponsesInputItem[] = history.map(toHistoryItem);
  items.push({ role: "user", content: renderUserPrompt(input) });
  return items;
}

export async function generateRagAnswer(input: AnswerInput): Promise<{ answer: string }> {
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT_NAME is not set");

  const client = getAzureOpenAIClient();
  const response = await client.responses.create({
    model: deployment,
    instructions: SYSTEM_PROMPT,
    input: buildInputItems(input),
  });

  const answer = response.output_text?.trim() ?? "";
  return { answer };
}

export const __test__ = { renderUserPrompt, buildInputItems, toHistoryItem };

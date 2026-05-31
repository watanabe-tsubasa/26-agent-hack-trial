export type AdminRagQueryMode = "aggregate" | "search";

const AGGREGATE_KEYWORDS = [
  "多い",
  "少ない",
  "何件",
  "件数",
  "ランキング",
  "サイト別",
  "施設別",
  "サイトごと",
  "施設ごと",
  "合計",
  "総数",
  "上位",
  "件くらい",
  "件あり",
];

export function classifyAdminRagQuery(message: string): AdminRagQueryMode {
  for (const kw of AGGREGATE_KEYWORDS) {
    if (message.includes(kw)) return "aggregate";
  }
  return "search";
}

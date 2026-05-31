const FOLLOW_UP_KEYWORDS = [
  "その中",
  "それら",
  "それ",
  "先ほど",
  "さっき",
  "前回",
  "この事故",
  "この件",
  "同じ",
  "そのうち",
  "上記",
];

/** 「直前の検索結果に絞った追質問」かどうかを軽量に判定 */
export function detectFollowUp(message: string): boolean {
  return FOLLOW_UP_KEYWORDS.some((kw) => message.includes(kw));
}

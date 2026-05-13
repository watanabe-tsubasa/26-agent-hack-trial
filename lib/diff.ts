import type { AiOutput, Feedback, Photo, Report } from "./types";

function summarizeDiff(before: string, after: string): string {
  if (before === after) return "変更なし";
  if (!before) return "内容が追加されました";
  if (!after) return "内容が削除されました";

  // Find added/removed phrases (simple heuristic)
  const beforeWords = new Set(before.split(/[、。\s]+/).filter(Boolean));
  const afterWords = new Set(after.split(/[、。\s]+/).filter(Boolean));
  const added = [...afterWords].filter((w) => !beforeWords.has(w));
  const removed = [...beforeWords].filter((w) => !afterWords.has(w));

  if (added.length > 0 && removed.length === 0) {
    return `「${added.slice(0, 2).join("」「")}」が追加されました`;
  }
  if (removed.length > 0 && added.length === 0) {
    return `「${removed.slice(0, 2).join("」「")}」が削除されました`;
  }
  if (added.length > 0 && removed.length > 0) {
    return `「${removed[0]}」→「${added[0]}」に変更されました`;
  }
  return "内容が修正されました";
}

let feedbackIdCounter = 1;

function makeFeedback(
  reportId: string,
  fieldName: string,
  before: string,
  after: string
): Feedback {
  return {
    id: `fb_${feedbackIdCounter++}`,
    reportId,
    fieldName,
    before,
    after,
    diffSummary: summarizeDiff(before, after),
    savedAt: new Date().toISOString(),
  };
}

export function recordFeedbacks(
  report: Report,
  updates: Partial<Report>
): Feedback[] {
  const results: Feedback[] = [];
  const orig = report.originalAiOutput;

  const scalarFields: Array<{ key: keyof AiOutput & keyof Report; label: string }> = [
    { key: "cause", label: "原因" },
    { key: "treatment", label: "処置" },
    { key: "preventiveAction", label: "防止対策" },
    { key: "body", label: "報告書本文" },
  ];

  for (const { key, label } of scalarFields) {
    const after = updates[key] as string | undefined;
    if (after !== undefined && after !== orig[key]) {
      results.push(makeFeedback(report.id, label, orig[key] as string, after));
    }
  }

  if (updates.fiveWTwoH) {
    const fiveWFields: Array<[keyof typeof orig.fiveWTwoH, string]> = [
      ["when", "When（いつ）"],
      ["where", "Where（どこで）"],
      ["who", "Who（誰が）"],
      ["what", "What（何が）"],
      ["why", "Why（なぜ）"],
      ["how", "How（どのように）"],
      ["howMuch", "How much（金額影響）"],
    ];
    for (const [key, label] of fiveWFields) {
      const after = updates.fiveWTwoH[key];
      if (after !== undefined && after !== orig.fiveWTwoH[key]) {
        results.push(makeFeedback(report.id, label, orig.fiveWTwoH[key], after));
      }
    }
  }

  if (updates.photos) {
    for (const updatedPhoto of updates.photos) {
      const origPhoto = orig.photos.find((p) => p.id === updatedPhoto.id);
      if (
        origPhoto &&
        updatedPhoto.photoLocationName !== undefined &&
        updatedPhoto.photoLocationName !== origPhoto.photoLocationName
      ) {
        results.push(
          makeFeedback(
            report.id,
            `写真場所名称（${updatedPhoto.id}）`,
            origPhoto.photoLocationName,
            updatedPhoto.photoLocationName
          )
        );
      }
    }
  }

  return results;
}

import type { Report } from "@/lib/types";

export function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ja-JP");
}

export function resolveDiffValue(value: string): string {
  return value || "（空）";
}

export function getFeedbackCountLabel(report: Pick<Report, "feedbacks">): string {
  return `${report.feedbacks.length} 件の修正履歴`;
}

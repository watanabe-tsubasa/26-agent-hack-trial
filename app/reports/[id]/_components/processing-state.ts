import type { ReportStatus } from "@/lib/types";

export const PROCESSING_STATUSES: ReportStatus[] = ["queued", "generating_report", "processing"];

export const STATUS_LABELS: Record<string, string> = {
  queued: "AIエージェントの処理待ちです",
  generating_report: "事故報告書ドラフトを生成しています",
  waiting_human_review: "完了しました。画面を更新しています...",
  failed: "処理に失敗しました",
};

export function resolveStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function isProcessingStatus(status: ReportStatus): boolean {
  return PROCESSING_STATUSES.includes(status);
}

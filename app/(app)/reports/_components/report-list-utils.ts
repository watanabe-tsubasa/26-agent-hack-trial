export const STATUS_LABELS: Record<string, string> = {
  queued: "待機中",
  generating_report: "生成中",
  waiting_human_review: "確認中",
  processing: "処理中",
  review: "確認中",
  updated: "修正済",
  confirmed: "確定済",
  failed: "エラー",
};

export const STATUS_COLORS: Record<string, string> = {
  queued: "bg-slate-100 text-slate-600 border-slate-200",
  generating_report: "bg-amber-100 text-amber-700 border-amber-200",
  waiting_human_review: "bg-blue-100 text-blue-700 border-blue-200",
  processing: "bg-amber-100 text-amber-700 border-amber-200",
  review: "bg-blue-100 text-blue-700 border-blue-200",
  updated: "bg-purple-100 text-purple-700 border-purple-200",
  confirmed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function resolveStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function resolveStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";
}

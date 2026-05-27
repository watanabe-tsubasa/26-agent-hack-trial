import type { Override } from "./types";

export function StatusBadge({ status }: { status: Override["status"] }) {
  const styles: Record<Override["status"], string> = {
    active: "bg-green-100 text-green-700 border-green-200",
    draft: "bg-amber-100 text-amber-700 border-amber-200",
    archived: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const labels: Record<Override["status"], string> = {
    active: "適用中",
    draft: "下書き",
    archived: "アーカイブ",
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs border font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

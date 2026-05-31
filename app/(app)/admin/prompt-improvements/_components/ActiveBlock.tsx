import type { Override } from "./types";
import { formatDateTime, parseAnalysis } from "./utils";
import { StatusBadge } from "./StatusBadge";
import { AnalysisBlock } from "./AnalysisBlock";

export function ActiveBlock({ override }: { override: Override | null }) {
  if (!override) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center text-sm text-slate-500">
        現在 active な施設ナレッジはありません。draft を適用すると、ここに表示されます。
      </div>
    );
  }

  const analysis = parseAnalysis(override.analysisJson);

  return (
    <div className="bg-white rounded-xl border border-green-200 p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <StatusBadge status="active" />
        <h3 className="text-base font-bold text-slate-800">{override.title}</h3>
      </div>
      <div className="text-xs text-slate-500 space-y-0.5">
        <div>ID: <span className="font-mono">{override.id}</span></div>
        <div>適用日時: {formatDateTime(override.approvedAt)}</div>
        <div>ソース: {override.source === "ai_proposed" ? "AI生成" : "手動作成"}</div>
      </div>
      {analysis && <AnalysisBlock analysis={analysis} />}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-1">施設ナレッジ本文</div>
        <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 whitespace-pre-wrap font-mono">{override.overrideText}</pre>
      </div>
    </div>
  );
}

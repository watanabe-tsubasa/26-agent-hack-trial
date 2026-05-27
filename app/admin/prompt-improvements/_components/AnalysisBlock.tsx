import type { AnalysisJson } from "./types";
import { CATEGORY_LABELS } from "./utils";

export function AnalysisBlock({ analysis }: { analysis: AnalysisJson | null }) {
  if (!analysis) return null;
  const candidates = analysis.facilityKnowledgeCandidates ?? [];
  const ignored = analysis.ignoredStyleCorrections ?? [];
  const legacyPatterns = analysis.observedCorrectionPatterns ?? [];
  const risks = analysis.riskNotes ?? [];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-sm">
      {analysis.summary && <p className="text-slate-700 whitespace-pre-wrap">{analysis.summary}</p>}
      {candidates.length > 0 && (
        <ul className="space-y-2">
          {candidates.map((c, i) => (
            <li key={i} className="border-l-2 border-blue-300 pl-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 border border-blue-200">
                  {CATEGORY_LABELS[c.category] ?? c.category}
                </span>
                <span className="text-slate-700 font-medium">{c.title}</span>
              </div>
              <p className="text-slate-700 whitespace-pre-wrap text-xs">{c.content}</p>
            </li>
          ))}
        </ul>
      )}
      {ignored.length > 0 && <p className="text-[11px] text-slate-500">書きぶり修正: {ignored.length} 件</p>}
      {candidates.length === 0 && legacyPatterns.length > 0 && <p className="text-[11px] text-slate-500">旧スキーマ傾向: {legacyPatterns.length} 件</p>}
      {risks.length > 0 && <p className="text-[11px] text-slate-500">適用上の注意: {risks.length} 件</p>}
    </div>
  );
}

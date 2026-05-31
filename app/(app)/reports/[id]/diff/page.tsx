import Link from "next/link";
import type { Report } from "@/lib/types";
import { formatSavedAt, getFeedbackCountLabel, resolveDiffValue } from "./_components/diff-utils";

async function getReport(id: string): Promise<Report | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/reports/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function DiffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    return <div className="text-center py-12 text-slate-500">報告書が見つかりません</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/reports" className="hover:text-blue-600">一覧</Link>
        <span>/</span>
        <Link href={`/reports/${id}`} className="hover:text-blue-600 font-mono text-xs">{id}</Link>
        <span>/</span>
        <span>AI出力と修正差分</span>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">AI出力と修正差分</h2>
        <p className="text-sm text-slate-500 mt-1">
          {getFeedbackCountLabel(report)}
        </p>
      </div>

      {report.feedbacks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-sm shadow-sm">
          <svg className="w-10 h-10 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          まだ修正履歴がありません
          <br />
          <Link href={`/reports/${id}`} className="mt-2 inline-block text-blue-600 hover:underline text-sm">
            報告書を編集して修正を記録する
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold text-xs">AI</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-800">修正内容を保存しました。</p>
                <p className="text-xs text-blue-600 mt-0.5">この内容は今後のAI出力改善に活用されます。</p>
              </div>
            </div>
          </div>

          {/* Diff items */}
          {report.feedbacks.map((fb) => (
            <div key={fb.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                <span className="font-semibold text-slate-800 text-sm">{fb.fieldName}</span>
                <span className="text-xs text-slate-400">
                  {formatSavedAt(fb.savedAt)}
                </span>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <div className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">AI出力</div>
                  <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-900 whitespace-pre-wrap">
                    {resolveDiffValue(fb.before)}
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-green-500 uppercase tracking-wide mb-2">修正後</div>
                  <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-900 whitespace-pre-wrap">
                    {resolveDiffValue(fb.after)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-2">差分サマリー</div>
                  <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900">
                    {fb.diffSummary}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

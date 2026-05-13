import Link from "next/link";
import type { Report } from "@/lib/types";

async function getReports(): Promise<Report[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/reports`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

const STATUS_LABELS: Record<string, string> = {
  processing: "処理中",
  review: "確認中",
  updated: "修正済",
  confirmed: "確定済",
};

const STATUS_COLORS: Record<string, string> = {
  processing: "bg-amber-100 text-amber-700 border-amber-200",
  review: "bg-blue-100 text-blue-700 border-blue-200",
  updated: "bg-purple-100 text-purple-700 border-purple-200",
  confirmed: "bg-green-100 text-green-700 border-green-200",
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function ReportsPage() {
  const reports = await getReports();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">事故報告書一覧</h2>
          <p className="text-sm text-slate-500 mt-1">全 {reports.length} 件</p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新規作成
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-slate-300 mb-3">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm">まだ事故報告書がありません</p>
          <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
            新規作成する
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-slate-600 font-medium">ID</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">事故概要</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">発生場所</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">発生日時</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">ステータス</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">作成日時</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report, i) => (
                <tr
                  key={report.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}
                >
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{report.id}</td>
                  <td className="px-4 py-3 text-slate-800 max-w-xs">
                    <span className="line-clamp-2">{report.summary}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{report.location}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(report.occurredAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs border font-medium ${STATUS_COLORS[report.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[report.status] ?? report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(report.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/reports/${report.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      開く →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

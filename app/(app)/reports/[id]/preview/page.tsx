import Link from "next/link";
import type { Report } from "@/lib/types";
import { PrintButton } from "./PrintButton";
import { CIRCLE_NUMS, formatDate, resolvePreviewStatus } from "./_components/preview-utils";

async function getReport(id: string): Promise<Report | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/reports/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    return (
      <div className="text-center py-12 text-slate-500">
        報告書が見つかりません
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/reports" className="hover:text-blue-600">一覧</Link>
          <span>/</span>
          <Link href={`/reports/${id}`} className="hover:text-blue-600 font-mono text-xs">{id}</Link>
          <span>/</span>
          <span>帳票プレビュー</span>
        </div>
        <PrintButton />
      </div>

      {/* Page 1: Main report */}
      <div className="bg-white border border-slate-300 rounded-xl shadow-sm p-8 mb-6 print:shadow-none print:border-none print:rounded-none print:mb-0">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">事 故 報 告 書</h1>
          <p className="text-sm text-slate-500 mt-1">{report.department || ""}</p>
        </div>

        {/* Basic info grid */}
        <div className="grid grid-cols-4 gap-0 border border-slate-300 mb-6 text-sm">
          {[
            ["報告日", report.reportedAt.slice(0, 10)],
            ["報告者", report.reporter],
            ["担当部署", report.department],
            ["金額影響", report.amount ?? "未算定"],
            ["発生日時", formatDate(report.occurredAt)],
            ["発生場所", report.location],
            ["復旧日時", report.recoveredAt ? formatDate(report.recoveredAt) : "未復旧"],
            ["ステータス", resolvePreviewStatus(report.status)],
          ].map(([label, value]) => (
            <div key={label} className="border border-slate-300 p-2">
              <div className="text-xs text-slate-500 font-medium">{label}</div>
              <div className="text-slate-900 font-medium mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <table className="w-full border-collapse border border-slate-300 text-sm mb-6">
          <tbody>
            <tr>
              <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium text-slate-700 w-24 align-top">事故概要</td>
              <td className="border border-slate-300 px-3 py-2 text-slate-900">{report.summary}</td>
            </tr>
          </tbody>
        </table>

        {/* Victim */}
        <table className="w-full border-collapse border border-slate-300 text-sm mb-6">
          <thead>
            <tr className="bg-slate-50">
              <td colSpan={4} className="border border-slate-300 px-3 py-2 font-bold text-slate-700">被害者情報</td>
            </tr>
          </thead>
          <tbody>
            {report.victim.hasVictim ? (
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium w-24">区分</td>
                <td className="border border-slate-300 px-3 py-2">{report.victim.category}</td>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium w-24">被害程度</td>
                <td className="border border-slate-300 px-3 py-2">{report.victim.damageLevel}</td>
              </tr>
            ) : (
              <tr>
                <td colSpan={4} className="border border-slate-300 px-3 py-3 text-center text-slate-500 font-medium">
                  人的被害なし
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 5W2H */}
        <table className="w-full border-collapse border border-slate-300 text-sm mb-6">
          <thead>
            <tr className="bg-slate-50">
              <td colSpan={2} className="border border-slate-300 px-3 py-2 font-bold text-slate-700">事故詳細（5W2H）</td>
            </tr>
          </thead>
          <tbody>
            {[
              ["When（いつ）", report.fiveWTwoH.when],
              ["Where（どこで）", report.fiveWTwoH.where],
              ["Who（誰が / 誰に）", report.fiveWTwoH.who],
              ["What（何が起きたか）", report.fiveWTwoH.what],
              ["Why（なぜ）", report.fiveWTwoH.why],
              ["How（どのような状況）", report.fiveWTwoH.how],
              ["How much（金額影響）", report.fiveWTwoH.howMuch],
            ].map(([label, value]) => (
              <tr key={label}>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium text-slate-700 w-40 align-top">{label}</td>
                <td className="border border-slate-300 px-3 py-2 text-slate-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Cause / Treatment / Prevention */}
        <table className="w-full border-collapse border border-slate-300 text-sm mb-6">
          <tbody>
            {[
              ["原因", report.cause],
              ["処置", report.treatment],
              ["防止対策", report.preventiveAction],
            ].map(([label, value]) => (
              <tr key={label}>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium text-slate-700 w-24 align-top">{label}</td>
                <td className="border border-slate-300 px-3 py-2 text-slate-900 whitespace-pre-wrap">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Body */}
        <table className="w-full border-collapse border border-slate-300 text-sm">
          <tbody>
            <tr>
              <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium text-slate-700 w-24 align-top">報告書本文</td>
              <td className="border border-slate-300 px-3 py-2 text-slate-900 whitespace-pre-wrap leading-relaxed">{report.body}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Page 2: Photo ledger */}
      <div className="bg-white border border-slate-300 rounded-xl shadow-sm p-8 print:shadow-none print:border-none print:rounded-none print:page-break-before-always">
        <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">写 真 台 帳</h1>
          <p className="text-sm text-slate-500 mt-1">{report.title} / {report.location}</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 8 }).map((_, i) => {
            const photo = report.photos[i];
            return (
              <div key={i} className="border-2 border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-300 px-3 py-1.5 flex items-center gap-2">
                  <span className="font-bold text-slate-700 text-base">{CIRCLE_NUMS[i]}</span>
                  {photo && (
                    <span className="text-xs text-slate-600 truncate">{photo.photoLocationName}</span>
                  )}
                </div>
                <div className="relative w-full h-44 bg-slate-100">
                  {photo ? (
                    <img
                      src={photo.imageUrl}
                      alt={photo.photoLocationName}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                      <div className="text-center">
                        <svg className="w-10 h-10 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">（画像なし）</span>
                      </div>
                    </div>
                  )}
                </div>
                {photo && (
                  <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 text-xs text-slate-500 space-y-0.5">
                    <div>📷 {photo.cameraName}</div>
                    <div>🕐 {photo.capturedAt.slice(0, 16).replace("T", " ")}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

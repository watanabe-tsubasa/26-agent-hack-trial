"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import type { ProcessingStep, Report } from "@/lib/types";

// ── Processing screen ────────────────────────────────────────────────────────

function ProcessingScreen({ reportId }: { reportId: string }) {
  const [steps, setSteps] = useState<ProcessingStep[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const poll = async () => {
      const res = await fetch(`/api/reports/${reportId}/status`);
      if (!res.ok) return;
      const data = await res.json();
      setSteps(data.steps ?? []);
      if (data.status === "completed") {
        setDone(true);
      }
    };
    poll();
    const timer = setInterval(poll, 600);
    return () => clearInterval(timer);
  }, [reportId]);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => window.location.reload(), 500);
      return () => clearTimeout(t);
    }
  }, [done]);

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="relative rounded-2xl overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900" />
        <div className="absolute inset-0 backdrop-blur-sm bg-white/5" />
        <div className="relative p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 backdrop-blur mb-4">
              <svg className="w-7 h-7 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-xl">AIエージェントが処理中</h2>
            <p className="text-blue-200 text-sm mt-1">しばらくお待ちください...</p>
          </div>

          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center">
                  {step.status === "completed" ? (
                    <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : step.status === "in_progress" ? (
                    <div className="w-6 h-6 rounded-full bg-white/30 border-2 border-white flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20" />
                  )}
                </div>
                <span className={`text-sm ${step.status === "completed" ? "text-green-300" : step.status === "in_progress" ? "text-white font-medium" : "text-white/40"}`}>
                  {step.label}
                </span>
                {step.status === "in_progress" && (
                  <span className="ml-auto">
                    <svg className="animate-spin w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </span>
                )}
              </div>
            ))}
          </div>

          {done && (
            <div className="mt-6 text-center">
              <p className="text-green-300 font-medium text-sm">完了しました。画面を更新しています...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Report editor ─────────────────────────────────────────────────────────────

type Tab = "report" | "photos" | "diff";

function EditableField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {multiline ? (
        <textarea
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-slate-50 focus:bg-white transition-colors"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 focus:bg-white transition-colors"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ReportTab({ report, onChange }: { report: Report; onChange: (r: Report) => void }) {
  const set5W = (key: string, val: string) =>
    onChange({ ...report, fiveWTwoH: { ...report.fiveWTwoH, [key]: val } });

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">基本情報</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <EditableField label="事故概要" value={report.summary} onChange={(v) => onChange({ ...report, summary: v })} multiline />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">発生日時</label>
            <p className="text-sm text-slate-800 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">{report.occurredAt}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">発生場所</label>
            <p className="text-sm text-slate-800 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">{report.location}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">報告日</label>
            <p className="text-sm text-slate-800 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">{report.reportedAt.slice(0, 10)}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">報告者 / 担当部署</label>
            <p className="text-sm text-slate-800 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">{report.reporter} / {report.department}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">金額影響</label>
            <p className="text-sm text-slate-800 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">{report.amount ?? "未算定"}</p>
          </div>
        </div>
      </section>

      {/* Victim */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">被害者情報</h3>
        {report.victim.hasVictim ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">被害者区分</label>
              <p className="text-sm text-slate-800 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">{report.victim.category}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">被害程度</label>
              <p className="text-sm text-slate-800 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">{report.victim.damageLevel}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 bg-slate-50 rounded-lg border border-slate-200 px-3 py-3 text-center">人的被害なし</p>
        )}
      </section>

      {/* 5W2H */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">事故詳細（5W2H）</h3>
        <div className="space-y-4">
          {[
            ["when", "When：いつ"],
            ["where", "Where：どこで"],
            ["who", "Who：誰が / 誰に"],
            ["what", "What：何が起きたか"],
            ["why", "Why：なぜ起きたと考えられるか"],
            ["how", "How：どのような状況だったか"],
            ["howMuch", "How much：金額影響"],
          ].map(([key, label]) => (
            <EditableField
              key={key}
              label={label}
              value={report.fiveWTwoH[key as keyof typeof report.fiveWTwoH]}
              onChange={(v) => set5W(key, v)}
              multiline={["why", "how", "what"].includes(key)}
            />
          ))}
        </div>
      </section>

      {/* Cause / Treatment / Prevention */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">原因・対応・防止策</h3>
        <div className="space-y-4">
          <EditableField label="原因" value={report.cause} onChange={(v) => onChange({ ...report, cause: v })} multiline rows={3} />
          <EditableField label="処置" value={report.treatment} onChange={(v) => onChange({ ...report, treatment: v })} multiline rows={3} />
          <EditableField label="防止対策" value={report.preventiveAction} onChange={(v) => onChange({ ...report, preventiveAction: v })} multiline rows={3} />
        </div>
      </section>

      {/* Body */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">報告書本文</h3>
        <EditableField label="本文" value={report.body} onChange={(v) => onChange({ ...report, body: v })} multiline rows={5} />
      </section>
    </div>
  );
}

const CIRCLE_NUMS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

function PhotosTab({ report, onChange }: { report: Report; onChange: (r: Report) => void }) {
  const setPhotoName = (id: string, name: string) => {
    const photos = report.photos.map((p) =>
      p.id === id ? { ...p, photoLocationName: name } : p
    );
    onChange({ ...report, photos });
  };

  const removePhoto = (id: string) => {
    onChange({ ...report, photos: report.photos.filter((p) => p.id !== id) });
  };

  const movePhoto = (index: number, dir: -1 | 1) => {
    const photos = [...report.photos];
    const target = index + dir;
    if (target < 0 || target >= photos.length) return;
    [photos[index], photos[target]] = [photos[target], photos[index]];
    onChange({ ...report, photos });
  };

  const slots = Array.from({ length: 8 });

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        {slots.map((_, i) => {
          const photo = report.photos[i];
          return (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                <span className="font-bold text-slate-600">{CIRCLE_NUMS[i]}</span>
                {photo && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => movePhoto(i, -1)}
                      disabled={i === 0}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      title="上に移動"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => movePhoto(i, 1)}
                      disabled={i === report.photos.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      title="下に移動"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="削除"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {photo ? (
                <div>
                  <div className="relative w-full h-40 bg-slate-100">
                    <img
                      src={photo.imageUrl}
                      alt={photo.photoLocationName}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">写真場所名称</label>
                      <input
                        type="text"
                        value={photo.photoLocationName}
                        onChange={(e) => setPhotoName(photo.id, e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <div className="text-xs text-slate-400">
                      <div>{photo.cameraName}</div>
                      <div>{photo.capturedAt.slice(0, 16).replace("T", " ")}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-300">
                  <div className="text-center">
                    <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">画像なし</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
        プロトタイプでは写真追加機能は省略しています。実際の実装ではカメラ画像の選択・追加が可能になります。
      </div>
    </div>
  );
}

function DiffTab({ report }: { report: Report }) {
  const orig = report.originalAiOutput;

  if (report.feedbacks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
        まだ修正はありません。報告書の内容を編集して保存すると差分が表示されます。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {report.feedbacks.map((fb) => (
        <div key={fb.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700">{fb.fieldName}</span>
            <span className="text-xs text-slate-400">{new Date(fb.savedAt).toLocaleString("ja-JP")}</span>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
              <div className="text-xs font-semibold text-red-500 mb-1">AI出力</div>
              <p className="text-sm text-red-800 whitespace-pre-wrap">{fb.before || "（空）"}</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-100 p-3">
              <div className="text-xs font-semibold text-green-500 mb-1">修正後</div>
              <p className="text-sm text-green-800 whitespace-pre-wrap">{fb.after || "（空）"}</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <div className="text-xs font-semibold text-blue-500 mb-1">差分</div>
              <p className="text-sm text-blue-800">{fb.diffSummary}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [report, setReport] = useState<Report | null>(null);
  const [editedReport, setEditedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("report");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/reports/${id}`)
      .then((r) => r.json())
      .then((data: Report) => {
        setReport(data);
        setEditedReport(data);
        setLoading(false);
      })
      .catch(() => {
        setError("報告書の取得に失敗しました");
        setLoading(false);
      });
  }, [id]);

  const handleSave = async () => {
    if (!editedReport) return;
    setSaving(true);
    try {
      await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: editedReport.summary,
          fiveWTwoH: editedReport.fiveWTwoH,
          cause: editedReport.cause,
          treatment: editedReport.treatment,
          preventiveAction: editedReport.preventiveAction,
          body: editedReport.body,
          photos: editedReport.photos.map((p) => ({ id: p.id, photoLocationName: p.photoLocationName })),
        }),
      });
      const updated = await fetch(`/api/reports/${id}`).then((r) => r.json()) as Report;
      setReport(updated);
      setEditedReport(updated);
      setSaveMessage("修正内容を保存しました。この内容は今後のAI出力改善に活用されます。");
      setTimeout(() => setSaveMessage(""), 4000);
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!window.confirm("この内容で確定しますか？確定後は編集できません。")) return;
    setConfirming(true);
    try {
      await fetch(`/api/reports/${id}/confirm`, { method: "POST" });
      const updated = await fetch(`/api/reports/${id}`).then((r) => r.json()) as Report;
      setReport(updated);
      setEditedReport(updated);
    } catch {
      setError("確定に失敗しました");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        読み込み中...
      </div>
    );
  }

  if (!report || !editedReport) {
    return <div className="text-center py-12 text-slate-500">{error || "報告書が見つかりません"}</div>;
  }

  if (report.status === "processing") {
    return <ProcessingScreen reportId={id} />;
  }

  const isConfirmed = report.status === "confirmed";

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/reports" className="hover:text-blue-600">一覧</Link>
            <span>/</span>
            <span className="font-mono text-xs">{id}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800">{report.title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{report.location} / {report.occurredAt.slice(0, 10)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/reports/${id}/preview`}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            帳票プレビュー
          </Link>
          {!isConfirmed && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white rounded-lg transition-colors"
              >
                {saving ? "保存中..." : "修正内容を保存"}
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors"
              >
                {confirming ? "処理中..." : "この内容で確定"}
              </button>
            </>
          )}
          {isConfirmed && (
            <span className="px-3 py-2 text-sm bg-green-100 text-green-700 border border-green-200 rounded-lg font-medium">
              ✓ 確定済み
            </span>
          )}
        </div>
      </div>

      {/* Save notification */}
      {saveMessage && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {saveMessage}
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* AI note */}
      {!isConfirmed && (
        <div className="mb-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 font-bold text-xs">AI</span>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-800">AIドラフトを確認・修正してください</p>
            <p className="text-xs text-blue-600 mt-0.5">内容を確認・修正した上で「この内容で確定」を押してください。修正内容はAI改善に活用されます。</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl border border-slate-200 p-1 shadow-sm w-fit">
        {(
          [
            ["report", "事故報告書"],
            ["photos", "写真台帳"],
            ["diff", `AI出力と修正差分${report.feedbacks.length > 0 ? ` (${report.feedbacks.length})` : ""}`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === key
                ? "bg-blue-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "report" && (
          <ReportTab report={editedReport} onChange={isConfirmed ? () => {} : setEditedReport} />
        )}
        {activeTab === "photos" && (
          <PhotosTab report={editedReport} onChange={isConfirmed ? () => {} : setEditedReport} />
        )}
        {activeTab === "diff" && <DiffTab report={report} />}
      </div>
    </div>
  );
}

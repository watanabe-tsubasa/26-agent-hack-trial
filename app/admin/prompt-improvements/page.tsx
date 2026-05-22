"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Override = {
  id: string;
  locationKey: string;
  title: string;
  overrideText: string;
  source: "manual" | "ai_proposed";
  status: "draft" | "active" | "archived";
  analysisJson: string | null;
  createdAt: string;
  approvedAt: string | null;
};

type ObservedPattern = {
  fieldPath: string;
  pattern: string;
  recommendation: string;
};

type AnalysisJson = {
  summary?: string;
  observedCorrectionPatterns?: ObservedPattern[];
  riskNotes?: string[];
};

const LOCATION_KEY = "store-001";

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
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

function parseAnalysis(json: string | null): AnalysisJson | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AnalysisJson;
  } catch {
    return null;
  }
}

function StatusBadge({ status }: { status: Override["status"] }) {
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
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs border font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function AnalysisBlock({ analysis }: { analysis: AnalysisJson | null }) {
  if (!analysis) return null;
  const patterns = analysis.observedCorrectionPatterns ?? [];
  const risks = analysis.riskNotes ?? [];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-sm">
      {analysis.summary && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-0.5">AI 分析サマリ</div>
          <p className="text-slate-700 whitespace-pre-wrap">{analysis.summary}</p>
        </div>
      )}
      {patterns.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1">
            AIが見つけた修正傾向
          </div>
          <ul className="space-y-1">
            {patterns.map((p, i) => (
              <li key={i} className="border-l-2 border-blue-300 pl-2">
                <div className="text-xs text-slate-500 font-mono">{p.fieldPath}</div>
                <div className="text-slate-700">{p.pattern}</div>
                <div className="text-slate-500 text-xs mt-0.5">→ {p.recommendation}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {risks.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1">適用上の注意</div>
          <ul className="list-disc pl-5 text-slate-700 space-y-0.5">
            {risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DraftCard({
  override,
  onSaved,
  onApproved,
}: {
  override: Override;
  onSaved: (updated: Override) => void;
  onApproved: () => void;
}) {
  const [title, setTitle] = useState(override.title);
  const [overrideText, setOverrideText] = useState(override.overrideText);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const analysis = useMemo(() => parseAnalysis(override.analysisJson), [override.analysisJson]);
  const dirty = title !== override.title || overrideText !== override.overrideText;

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/location-prompt-overrides/${override.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, overrideText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "保存に失敗しました");
      onSaved(data.override as Override);
      setMessage({ kind: "ok", text: "保存しました" });
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (dirty) {
      if (!confirm("未保存の編集があります。保存せずに適用してよろしいですか？")) return;
    } else if (!confirm("この補正ルールを適用しますか？同じ施設の既存 active はアーカイブされます。")) {
      return;
    }

    setApproving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/location-prompt-overrides/${override.id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "適用に失敗しました");
      onApproved();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
      setApproving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={override.status} />
            <span className="text-xs text-slate-500 font-mono">{override.id}</span>
            <span className="text-xs text-slate-500">
              {override.source === "ai_proposed" ? "AI生成" : "手動作成"}
            </span>
          </div>
          <div className="text-xs text-slate-500">作成: {formatDateTime(override.createdAt)}</div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">タイトル</label>
        <input
          type="text"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {analysis && <AnalysisBlock analysis={analysis} />}

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          補正ルール本文（事故報告書生成 AI のプロンプトに追記されます）
        </label>
        <textarea
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          rows={10}
          value={overrideText}
          onChange={(e) => setOverrideText(e.target.value)}
        />
      </div>

      {message && (
        <p
          className={`text-sm px-3 py-2 rounded-lg border ${
            message.kind === "ok"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={approving}
          className="bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {approving ? "適用中..." : "この補正ルールを適用"}
        </button>
        {dirty && (
          <span className="text-xs text-amber-600">未保存の編集があります</span>
        )}
      </div>
    </div>
  );
}

function ActiveBlock({ override }: { override: Override | null }) {
  if (!override) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center text-sm text-slate-500">
        現在 active な補正ルールはありません。draft を適用すると、ここに表示されます。
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
        <div className="text-xs font-medium text-slate-500 mb-1">補正ルール本文</div>
        <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 whitespace-pre-wrap font-mono">
          {override.overrideText}
        </pre>
      </div>
    </div>
  );
}

type RunStatus = "queued" | "running" | "completed" | "failed";
type Run = {
  id: string;
  locationKey: string;
  status: RunStatus;
  inputCorrectionCount: number | null;
  proposedOverrideId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

const POLL_INTERVAL_MS = 3000;

export default function PromptImprovementsPage() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [activeRun, setActiveRun] = useState<Run | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/location-prompt-overrides?locationKey=${encodeURIComponent(LOCATION_KEY)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "取得に失敗しました");
      setOverrides(data.overrides as Override[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!activeRun) return;
    if (activeRun.status === "completed" || activeRun.status === "failed") return;

    const runId = activeRun.id;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/prompt-improvement-runs/${runId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) return;
        const run = data.run as Run;
        setActiveRun(run);
        if (run.status === "completed") {
          setGenMessage({
            kind: "ok",
            text: `改善案 draft を作成しました（修正履歴 ${run.inputCorrectionCount ?? 0} 件を分析）`,
          });
          setGenerating(false);
          await fetchList();
        } else if (run.status === "failed") {
          const msg = run.errorMessage ?? "改善案生成に失敗しました";
          if (msg === "No corrections found for this location") {
            setGenMessage({
              kind: "err",
              text: "対象の修正履歴がありません。事故報告書の修正・確定を行ってからお試しください。",
            });
          } else {
            setGenMessage({ kind: "err", text: msg });
          }
          setGenerating(false);
        }
      } catch {
        // polling 中の transient error は無視
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [activeRun, fetchList]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenMessage(null);
    setActiveRun(null);
    try {
      const res = await fetch(`/api/admin/run-prompt-improvement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationKey: LOCATION_KEY }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "改善案生成のキューイングに失敗しました");
      }
      setActiveRun({
        id: data.runId,
        locationKey: data.locationKey,
        status: "queued",
        inputCorrectionCount: null,
        proposedOverrideId: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
      setGenMessage({
        kind: "ok",
        text: `改善案生成を受け付けました（runId: ${data.runId}）。完了まで待機しています...`,
      });
    } catch (err) {
      setGenMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
      setGenerating(false);
    }
  };

  const handleDraftSaved = (updated: Override) => {
    setOverrides((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const active = overrides.find((o) => o.status === "active") ?? null;
  const drafts = overrides.filter((o) => o.status === "draft");
  const archived = overrides.filter((o) => o.status === "archived");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          補正ルール管理（Phase 5）
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          事故報告書の人間修正履歴から、店舗・施設別の補正ルール案をAIが生成します。
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p>・AIは改善案を draft として作成します。</p>
        <p>・適用するまで事故報告書生成には反映されません。</p>
        <p>・適用後、次回以降の同一施設の報告書生成時に補正ルールが追記されます。</p>
        <p className="text-blue-600 text-xs pt-1">
          ※ 本来は管理者権限が必要ですが、デモ実装では認証なしです。
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">対象施設ID</div>
            <div className="text-lg font-mono font-bold text-slate-800">{LOCATION_KEY}</div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {activeRun?.status === "running"
                  ? "Worker が処理中..."
                  : activeRun?.status === "queued"
                  ? "キュー投入済み・処理待ち..."
                  : "受付中..."}
              </>
            ) : (
              "現在の修正履歴から改善案を生成"
            )}
          </button>
        </div>

        {activeRun && (
          <div className="text-xs text-slate-500 flex items-center gap-2 font-mono">
            <span>runId: {activeRun.id}</span>
            <span>status: {activeRun.status}</span>
          </div>
        )}

        {genMessage && (
          <p
            className={`text-sm px-3 py-2 rounded-lg border ${
              genMessage.kind === "ok"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {genMessage.text}
          </p>
        )}
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
          現在適用中の補正ルール
        </h3>
        {loading ? (
          <div className="text-sm text-slate-500">読み込み中...</div>
        ) : (
          <ActiveBlock override={active} />
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
          改善案 draft（{drafts.length} 件）
        </h3>
        {loading ? (
          <div className="text-sm text-slate-500">読み込み中...</div>
        ) : drafts.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center text-sm text-slate-500">
            draft はまだありません。上の「改善案を生成」ボタンを押してください。
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((d) => (
              <DraftCard
                key={d.id}
                override={d}
                onSaved={handleDraftSaved}
                onApproved={() => fetchList()}
              />
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
            アーカイブ（{archived.length} 件）
          </h3>
          <details className="bg-white rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm text-slate-600">
              アーカイブを表示
            </summary>
            <ul className="mt-3 space-y-2">
              {archived.map((a) => (
                <li
                  key={a.id}
                  className="border-t border-slate-100 pt-2 text-sm text-slate-600 flex items-center gap-2"
                >
                  <StatusBadge status="archived" />
                  <span className="font-mono text-xs text-slate-400">{a.id}</span>
                  <span className="truncate">{a.title}</span>
                  <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">
                    適用: {formatDateTime(a.approvedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

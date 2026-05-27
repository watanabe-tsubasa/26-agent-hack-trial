"use client";

import { useCallback, useEffect, useState } from "react";
import type { Override, Run } from "./_components/types";
import { LOCATION_KEY, isInFlight, selectOverrideGroups } from "./_components/utils";
import { DraftCard } from "./_components/DraftCard";
import { ActiveBlock } from "./_components/ActiveBlock";
import { StatusBadge } from "./_components/StatusBadge";

const POLL_INTERVAL_MS = 3000;

export default function PromptImprovementsPage() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [genMessage, setGenMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [latestRun, setLatestRun] = useState<Run | null>(null);

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

  const fetchLatestRun = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/prompt-improvement-runs/latest?locationKey=${encodeURIComponent(LOCATION_KEY)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) return;
      setLatestRun((data.run as Run | null) ?? null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchLatestRun();
  }, [fetchList, fetchLatestRun]);

  useEffect(() => {
    if (!isInFlight(latestRun)) return;
    const runId = latestRun!.id;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/prompt-improvement-runs/${runId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) return;
        const run = data.run as Run;
        setLatestRun(run);
        if (run.status === "completed") {
          setGenMessage({
            kind: "ok",
            text: `改善案 draft を作成しました（修正履歴 ${run.inputCorrectionCount ?? 0} 件を分析）`,
          });
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
        } else if (run.status === "superseded") {
          setGenMessage({
            kind: "err",
            text: "この run は新しい run に置き換えられました（superseded）。",
          });
        }
      } catch {
        // ignore transient errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [latestRun, fetchList]);

  const handleGenerate = async () => {
    setSubmitting(true);
    setGenMessage(null);
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
      const placeholder: Run = {
        id: data.runId,
        locationKey: data.locationKey,
        status: "queued",
        inputCorrectionCount: null,
        proposedOverrideId: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      setLatestRun(placeholder);
      if (data.alreadyRunning) {
        setGenMessage({
          kind: "ok",
          text: `既に処理中の改善案生成があります（runId: ${data.runId}）。完了をお待ちください。`,
        });
      } else {
        setGenMessage({
          kind: "ok",
          text: `改善案生成を受け付けました（runId: ${data.runId}）。完了まで待機しています...`,
        });
      }
      // 直後に latest を取りに行って status を同期
      await fetchLatestRun();
    } catch (err) {
      setGenMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDraftSaved = (updated: Override) => {
    setOverrides((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const { active, latestDraft, archived } = selectOverrideGroups(overrides);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          施設ナレッジ管理（Phase 5）
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          事故報告書の人間修正履歴から、施設固有の事実・既往・レイアウト等のナレッジ候補をAIが抽出します。
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p>・AIは施設ナレッジ候補を draft として作成します。</p>
        <p>・適用するまで事故報告書生成には反映されません。</p>
        <p>・適用後、次回以降の同一施設の報告書生成時に「施設固有の参考情報」として渡されます（断定原因としては扱われません）。</p>
        <p>・書きぶり・記法など全社で標準化すべき表現ルールは施設ナレッジには保存しません。</p>
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
            disabled={loading || submitting || isInFlight(latestRun)}
            className="bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                状態を確認中...
              </>
            ) : submitting || isInFlight(latestRun) ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {latestRun?.status === "running"
                  ? "Worker が処理中..."
                  : latestRun?.status === "queued"
                  ? "キュー投入済み・処理待ち..."
                  : "受付中..."}
              </>
            ) : (
              "現在の修正履歴から施設ナレッジ候補を生成"
            )}
          </button>
        </div>

        {latestRun && (
          <div className="text-xs text-slate-500 flex items-center gap-3 font-mono">
            <span>runId: {latestRun.id}</span>
            <span>status: {latestRun.status}</span>
            {latestRun.inputCorrectionCount !== null && (
              <span>corrections: {latestRun.inputCorrectionCount}</span>
            )}
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
          現在適用中の施設ナレッジ
        </h3>
        {loading ? (
          <div className="text-sm text-slate-500">読み込み中...</div>
        ) : (
          <ActiveBlock override={active} />
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
          施設ナレッジ draft
        </h3>
        <p className="text-xs text-slate-500">
          表示されるのは最新の draft 1件です。過去の draft は新しい候補を生成すると自動で archived になります。
        </p>
        {loading ? (
          <div className="text-sm text-slate-500">読み込み中...</div>
        ) : !latestDraft ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center text-sm text-slate-500">
            draft はまだありません。上の「施設ナレッジ候補を生成」ボタンを押してください。
          </div>
        ) : (
          <DraftCard
            key={latestDraft.id}
            override={latestDraft}
            onSaved={handleDraftSaved}
            onApproved={() => fetchList()}
          />
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

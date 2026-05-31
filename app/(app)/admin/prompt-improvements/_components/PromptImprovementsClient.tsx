"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoodjobAvatar } from "@/components/goodjob-avatar";
import {
  deriveKnowledgeStepStates,
  deriveKnowledgeStepStatesFromEvents,
  pickKnowledgeGoodjobTone,
} from "@/lib/prompt-improvement/knowledge-improvement-steps";
import {
  KNOWLEDGE_ALREADY_RUNNING_COPY,
  KNOWLEDGE_NO_CORRECTIONS_COPY,
  KNOWLEDGE_PAGE_DESCRIPTION,
  KNOWLEDGE_PAGE_NOTE,
  KNOWLEDGE_PAGE_TITLE,
  KNOWLEDGE_PRIMARY_BUTTON_COPY,
  KNOWLEDGE_QUEUED_BUTTON_COPY,
  KNOWLEDGE_RECEIVED_COPY,
  KNOWLEDGE_RUNNING_BUTTON_COPY,
  KNOWLEDGE_SUPERSEDED_COPY,
  PROMPT_IMPROVEMENT_STATUS_COPY,
  SECTION_ACTIVE_TITLE,
  SECTION_ARCHIVED_TITLE,
  SECTION_DRAFT_EMPTY,
  SECTION_DRAFT_HINT,
  SECTION_DRAFT_TITLE,
} from "@/lib/prompt-improvement/knowledge-copy";
import type { Override, Run } from "./types";
import { formatDateTime, isInFlight, selectOverrideGroups } from "./utils";
import { DraftCard } from "./DraftCard";
import { ActiveBlock } from "./ActiveBlock";
import { StatusBadge } from "./StatusBadge";
import { KnowledgeImprovementDialog } from "./KnowledgeImprovementDialog";

const POLL_INTERVAL_MS = 3000;
const ELAPSED_TICK_MS = 200;

type AgentEvent = {
  stepKey: string;
  state: "started" | "completed" | "failed";
};

type Props = {
  locationKey: string;
  siteName: string;
};

export function PromptImprovementsClient({ locationKey, siteName }: Props) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [genMessage, setGenMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [latestRun, setLatestRun] = useState<Run | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const runStartRef = useRef<number | null>(null);
  const dialogStickyRef = useRef<"completed" | "failed" | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/location-prompt-overrides?locationKey=${encodeURIComponent(locationKey)}`,
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
  }, [locationKey]);

  const fetchLatestRun = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/prompt-improvement-runs/latest?locationKey=${encodeURIComponent(locationKey)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) return;
      setLatestRun((data.run as Run | null) ?? null);
    } catch {
      // ignore
    }
  }, [locationKey]);

  useEffect(() => {
    fetchList();
    fetchLatestRun();
  }, [fetchList, fetchLatestRun]);

  // Open dialog as soon as a run is in flight; keep it open on completed/failed
  // until the user closes (sticky), so the result is visible after polling ends.
  useEffect(() => {
    if (isInFlight(latestRun)) {
      setDialogOpen(true);
      dialogStickyRef.current = null;
      if (runStartRef.current === null) {
        const created = latestRun?.createdAt ? new Date(latestRun.createdAt).getTime() : Date.now();
        runStartRef.current = created;
      }
    } else if (latestRun?.status === "completed" || latestRun?.status === "failed") {
      if (dialogStickyRef.current === null && dialogOpen) {
        dialogStickyRef.current = latestRun.status;
      }
    }
  }, [latestRun, dialogOpen]);

  // elapsed timer
  useEffect(() => {
    if (!isInFlight(latestRun)) return;
    const tick = setInterval(() => {
      if (runStartRef.current !== null) {
        setElapsedMs(Date.now() - runStartRef.current);
      }
    }, ELAPSED_TICK_MS);
    return () => clearInterval(tick);
  }, [latestRun]);

  // run status polling
  useEffect(() => {
    if (!isInFlight(latestRun)) return;
    const runId = latestRun!.id;

    const timer = setInterval(async () => {
      try {
        const [runRes, eventsRes] = await Promise.all([
          fetch(`/api/prompt-improvement-runs/${runId}`, { cache: "no-store" }),
          fetch(`/api/prompt-improvement-runs/${runId}/events`, { cache: "no-store" }),
        ]);
        if (eventsRes.ok) {
          const data = await eventsRes.json();
          setEvents((data.events as AgentEvent[]) ?? []);
        }
        const data = await runRes.json();
        if (!runRes.ok) return;
        const run = data.run as Run;
        setLatestRun(run);
        if (run.status === "completed") {
          setGenMessage({
            kind: "ok",
            text: `施設ナレッジ候補ができました（修正履歴 ${run.inputCorrectionCount ?? 0} 件を分析）`,
          });
          await fetchList();
        } else if (run.status === "failed") {
          const msg = run.errorMessage ?? "改善案生成に失敗しました";
          if (msg === "No corrections found for this location") {
            setGenMessage({ kind: "err", text: KNOWLEDGE_NO_CORRECTIONS_COPY });
          } else {
            setGenMessage({ kind: "err", text: msg });
          }
        } else if (run.status === "superseded") {
          setGenMessage({ kind: "err", text: KNOWLEDGE_SUPERSEDED_COPY });
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
        body: JSON.stringify({ locationKey }),
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
      runStartRef.current = Date.now();
      setElapsedMs(0);
      setEvents([]);
      setLatestRun(placeholder);
      if (data.alreadyRunning) {
        setGenMessage({ kind: "ok", text: KNOWLEDGE_ALREADY_RUNNING_COPY });
      } else {
        setGenMessage({ kind: "ok", text: KNOWLEDGE_RECEIVED_COPY });
      }
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

  const stepSnapshots = useMemo(
    () =>
      events.length > 0
        ? deriveKnowledgeStepStatesFromEvents(events)
        : deriveKnowledgeStepStates(latestRun?.status ?? null, elapsedMs),
    [events, latestRun?.status, elapsedMs]
  );
  const tone = useMemo(() => pickKnowledgeGoodjobTone(stepSnapshots), [stepSnapshots]);
  const failed = latestRun?.status === "failed";
  const done = latestRun?.status === "completed";

  const buttonLabel =
    loading
      ? "状態を確認中..."
      : submitting || isInFlight(latestRun)
        ? latestRun?.status === "running"
          ? KNOWLEDGE_RUNNING_BUTTON_COPY
          : KNOWLEDGE_QUEUED_BUTTON_COPY
        : KNOWLEDGE_PRIMARY_BUTTON_COPY;

  const statusMeta = latestRun ? PROMPT_IMPROVEMENT_STATUS_COPY[latestRun.status] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <GoodjobAvatar tone="idle" size="sm" />
        <div>
          <h2 className="text-xl font-bold text-slate-800">{KNOWLEDGE_PAGE_TITLE}</h2>
          <p className="text-sm text-slate-500 mt-1">{KNOWLEDGE_PAGE_DESCRIPTION}</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p>・グッジョくんは「確認待ちの候補」として施設ナレッジ案を作成します。</p>
        <p>・採用するまで事故報告書生成には反映されません。</p>
        <p>・採用後、次回以降の同一施設の報告書生成時に「施設固有の参考情報」として渡されます（断定原因としては扱われません）。</p>
        <p>{KNOWLEDGE_PAGE_NOTE}</p>
        <p className="text-blue-600 text-xs pt-1">
          ※ 本来は管理者権限が必要ですが、デモ実装では認証なしです。
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">対象施設</div>
            <div className="text-lg font-bold text-slate-800">{siteName}</div>
            <div className="text-xs font-mono text-slate-400">{locationKey}</div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || submitting || isInFlight(latestRun)}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            {loading || submitting || isInFlight(latestRun) ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <GoodjobAvatar tone="thinking" size="xs" />
            )}
            <span>{buttonLabel}</span>
          </button>
        </div>

        {statusMeta && latestRun && (
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="font-medium">{statusMeta.label}</span>
            <span className="text-slate-400">— {statusMeta.description}</span>
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
          {SECTION_ACTIVE_TITLE}
        </h3>
        {loading ? (
          <div className="text-sm text-slate-500">読み込み中...</div>
        ) : (
          <ActiveBlock override={active} />
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
          {SECTION_DRAFT_TITLE}
        </h3>
        <p className="text-xs text-slate-500">{SECTION_DRAFT_HINT}</p>
        {loading ? (
          <div className="text-sm text-slate-500">読み込み中...</div>
        ) : !latestDraft ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center text-sm text-slate-500">
            {SECTION_DRAFT_EMPTY}
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
            {SECTION_ARCHIVED_TITLE}（{archived.length} 件）
          </h3>
          <details className="bg-white rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm text-slate-600">
              {SECTION_ARCHIVED_TITLE}を表示
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

      <KnowledgeImprovementDialog
        open={dialogOpen}
        steps={stepSnapshots}
        tone={tone}
        failed={failed}
        done={done}
        errorMessage={failed ? latestRun?.errorMessage ?? undefined : undefined}
        onClose={done || failed ? () => setDialogOpen(false) : undefined}
      />
    </div>
  );
}

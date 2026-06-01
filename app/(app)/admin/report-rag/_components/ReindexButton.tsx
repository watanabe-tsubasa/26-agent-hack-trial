"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";

type Status = {
  enabled: boolean;
  indexedDocuments: number;
  lastIndexedAt: string | null;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "未実行";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function ReindexButton() {
  const [status, setStatus] = useState<Status | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/report-rag/index-status", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Status;
      setStatus(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleReindex = async (force: boolean) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/report-rag/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "再インデックスに失敗しました");
      setMessage({
        kind: "ok",
        text: `再インデックス完了 (indexed=${data.indexed} skipped=${data.skipped} failed=${data.failed})`,
      });
      await fetchStatus();
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "再インデックスに失敗しました",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-slate-600">
          <div>
            インデックス済み:{" "}
            <span className="font-mono text-slate-800">
              {status?.indexedDocuments ?? "..."}
            </span>{" "}
            件
          </div>
          <div>最終更新: {formatDateTime(status?.lastIndexedAt ?? null)}</div>
          {status?.enabled === false && (
            <div className="text-red-600 mt-1">Cosmos チャットボット連携は無効です（env 未設定）</div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleReindex(false)}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            差分更新
          </button>
          <button
            type="button"
            onClick={() => handleReindex(true)}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            全件再インデックス
          </button>
        </div>
      </div>
      {message && (
        <p
          className={`text-xs px-2.5 py-1.5 rounded border ${
            message.kind === "ok"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

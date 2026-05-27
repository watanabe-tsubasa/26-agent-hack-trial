import { useMemo, useState } from "react";
import type { Override } from "./types";
import { formatDateTime, parseAnalysis } from "./utils";
import { StatusBadge } from "./StatusBadge";
import { AnalysisBlock } from "./AnalysisBlock";

export function DraftCard({
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
    } else if (!confirm("この施設ナレッジを適用しますか？同じ施設の既存 active はアーカイブされます。")) {
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
            <span className="text-xs text-slate-500">{override.source === "ai_proposed" ? "AI生成" : "手動作成"}</span>
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
        <label className="block text-xs font-medium text-slate-500 mb-1">施設ナレッジ本文（事故報告書生成 AI に「施設固有の参考情報」として渡されます）</label>
        <textarea
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          rows={10}
          value={overrideText}
          onChange={(e) => setOverrideText(e.target.value)}
        />
      </div>

      {message && <p className={`text-sm px-3 py-2 rounded-lg border ${message.kind === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>{message.text}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={handleSave} disabled={saving || !dirty} className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {saving ? "保存中..." : "保存"}
        </button>
        <button type="button" onClick={handleApprove} disabled={approving} className="bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {approving ? "適用中..." : "この施設ナレッジを適用"}
        </button>
        {dirty && <span className="text-xs text-amber-600">未保存の編集があります</span>}
      </div>
    </div>
  );
}

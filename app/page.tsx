"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_FORM = {
  summary: "本館3階 南側廊下で天井ボードが落下していた。",
  occurredAt: "2025-05-20T10:15",
  location: "本館 3階 南側廊下",
  note: "現時点で人的被害は確認されていない。",
  hasVictim: false,
  recoveryStatus: "未復旧",
  amountImpact: "未算定",
};

export default function NewReportPage() {
  const router = useRouter();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.summary || !form.occurredAt || !form.location) {
      setError("事故概要・発生日時・発生場所は必須です。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          occurredAt: new Date(form.occurredAt).toISOString(),
        }),
      });
      if (!res.ok) throw new Error("作成に失敗しました");
      const { reportId } = await res.json();
      router.push(`/reports/${reportId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">新規事故報告書の作成（from github actions）</h2>
        <p className="text-sm text-slate-500 mt-1">
          事故の概要を入力して、AIエージェントに報告書の作成を依頼します
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 p-4 flex gap-3">
        <div className="text-blue-600 mt-0.5">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-sm text-blue-700">
          AIエージェントが関連するカメラ画像を取得・解析し、事故報告書のドラフトを自動生成します。
          生成後に内容を確認・修正できます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            事故概要 <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
            placeholder="例：本館3階 南側廊下で天井ボードが落下していた。"
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              発生日時 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={form.occurredAt}
              onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              発生場所 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例：本館 3階 南側廊下"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">補足情報</label>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={2}
            placeholder="例：現時点で人的被害は確認されていない。"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">被害者有無</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="hasVictim"
                  checked={!form.hasVictim}
                  onChange={() => setForm({ ...form, hasVictim: false })}
                  className="accent-blue-600"
                />
                なし
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="hasVictim"
                  checked={form.hasVictim}
                  onChange={() => setForm({ ...form, hasVictim: true })}
                  className="accent-blue-600"
                />
                あり
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">復旧状況</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.recoveryStatus}
              onChange={(e) => setForm({ ...form, recoveryStatus: e.target.value })}
            >
              <option>未復旧</option>
              <option>対応中</option>
              <option>復旧済</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">金額影響</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.amountImpact}
              onChange={(e) => setForm({ ...form, amountImpact: e.target.value })}
            >
              <option>未算定</option>
              <option>なし</option>
              <option>あり</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-medium py-3 px-6 rounded-xl transition-colors text-sm shadow-sm"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AIエージェントに送信中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AIエージェントに作成を依頼
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

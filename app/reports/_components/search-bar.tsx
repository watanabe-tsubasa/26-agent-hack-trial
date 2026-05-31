"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SEARCHABLE_STATUSES } from "@/lib/report-search";
import { resolveStatusLabel } from "./report-list-utils";

export function ReportSearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [keyword, setKeyword] = useState(params.get("keyword") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");

  const apply = () => {
    const sp = new URLSearchParams();
    if (keyword.trim()) sp.set("keyword", keyword.trim());
    if (status && status !== "all") sp.set("status", status);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    const qs = sp.toString();
    router.replace(qs ? `/reports?${qs}` : "/reports");
  };

  const reset = () => {
    setKeyword("");
    setStatus("all");
    setFrom("");
    setTo("");
    router.replace("/reports");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-12 gap-3"
    >
      <input
        type="text"
        placeholder="キーワード（事故概要・場所・本文）"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        className="md:col-span-4 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">すべてのステータス</option>
        {SEARCHABLE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {resolveStatusLabel(s)}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="md:col-span-2 flex gap-2">
        <button
          type="submit"
          className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm rounded-lg px-3 py-2"
        >
          検索
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
        >
          リセット
        </button>
      </div>
    </form>
  );
}

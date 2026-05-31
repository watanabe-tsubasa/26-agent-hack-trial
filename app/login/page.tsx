"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const QUICK_LOGINS = [
  { loginId: "kanda", password: "goodjob", label: "神田事務所サイト" },
  { loginId: "mall", password: "goodjob", label: "イオンモール神田サイト" },
  { loginId: "admin", password: "goodjob", label: "管理者（全施設）" },
];

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (id: string, pw: string) => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: id, password: pw }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "ログインに失敗しました");
      }
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ログインに失敗しました");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-slate-200 p-8 space-y-6">
        <div className="text-center">
          <img
            src="/goodjob/goodjob-idle.png"
            alt="事故報お任せグッジョくん"
            className="w-24 h-24 mx-auto object-contain mb-3"
          />
          <h1 className="text-xl font-bold text-slate-800">事故報お任せグッジョくん</h1>
          <p className="text-sm text-slate-500 mt-1">サイトを選んでログインしてください</p>
        </div>

        <div className="space-y-2">
          {QUICK_LOGINS.map((q) => (
            <button
              key={q.loginId}
              type="button"
              disabled={submitting}
              onClick={() => submit(q.loginId, q.password)}
              className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <div className="text-sm font-semibold text-slate-800">{q.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                ID: {q.loginId} / PASS: {q.password}
              </div>
            </button>
          ))}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-slate-400">または手動でログイン</span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(loginId, password);
          }}
          className="space-y-3"
        >
          <input
            type="text"
            placeholder="ID"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="PASS"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="current-password"
          />
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl text-sm"
          >
            {submitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Send } from "lucide-react";
import { GoodjobAvatar } from "@/components/goodjob-avatar";
import { ReindexButton } from "./ReindexButton";

type ChatSource = {
  reportId: string;
  title: string;
  facilityId: string;
  siteName: string;
  url: string;
  createdAt: string;
};

type ChatMessage =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      mode?: "aggregate" | "search";
      sources?: ChatSource[];
    };

const SUGGESTED_QUESTIONS = [
  "事故報が多いサイトはどこですか？",
  "天井落下に関係する事故はありますか？",
  "転倒事故はありますか？",
  "神田事務所で救助対応が必要だった事故は？",
];

export function ReportRagChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (message: string) => {
    const text = message.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/report-rag/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "回答取得に失敗しました");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.answer ?? "",
          mode: data.mode,
          sources: (data.sources as ChatSource[]) ?? [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            "回答取得に失敗しました：" +
            (err instanceof Error ? err.message : "unknown error"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <GoodjobAvatar tone="investigating" size="md" />
        <div>
          <h2 className="text-xl font-bold text-slate-800">施設管理RAG</h2>
          <p className="text-sm text-slate-500 mt-1">
            グッジョくんに、確定済みの事故報を横断確認してもらいます。
            根拠の事故報も同時に確認できます。
          </p>
        </div>
      </div>

      <ReindexButton />

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="text-sm text-slate-500">
            <p className="mb-2">以下のような質問ができます:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-300 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m, i) => (
              <li key={i}>
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-blue-600 text-white px-4 py-2 text-sm whitespace-pre-wrap">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <GoodjobAvatar tone="thinking" size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">
                        {m.text || "..."}
                      </div>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <p className="text-xs text-slate-500">根拠となる事故報:</p>
                          {m.sources.map((s) => (
                            <Link
                              key={s.reportId}
                              href={s.url}
                              className="block px-3 py-2 rounded-lg border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-sm"
                            >
                              <div className="font-medium text-slate-800 truncate">
                                {s.title}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {s.siteName} · {s.reportId}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
            {loading && (
              <li className="flex gap-3">
                <GoodjobAvatar tone="thinking" size="sm" />
                <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-500">
                  グッジョくんが事故報を確認中...
                </div>
              </li>
            )}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 pt-2 border-t border-slate-100"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="グッジョくんに質問する..."
            disabled={loading}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-medium"
          >
            <Send className="w-4 h-4" />
            送信
          </button>
        </form>
      </div>
    </div>
  );
}

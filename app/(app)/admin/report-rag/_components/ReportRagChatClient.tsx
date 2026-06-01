"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { GoodjobAvatar } from "@/components/goodjob-avatar";
import { ReindexButton } from "./ReindexButton";
import { ChatInputForm } from "./ChatInputForm";
import { AppEnv } from "@/lib/env";

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
      isFollowUp?: boolean;
    };

const SUGGESTED_QUESTIONS = [
  "事故報が多いサイトはどこですか？",
  "天井落下に関係する事故はありますか？",
  "転倒事故はありますか？",
  "神田事務所で救助対応が必要だった事故は？",
];

const HISTORY_LIMIT = 6;

function buildHistoryPayload(messages: ChatMessage[]) {
  return messages.slice(-HISTORY_LIMIT).map((m) => ({
    role: m.role,
    content: m.text,
  }));
}

function findLatestAssistantSources(messages: ChatMessage[]): ChatSource[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role === "assistant" && m.sources && m.sources.length > 0) {
      return m.sources;
    }
  }
  return [];
}

interface ReportRagChatClientProps {
  env: AppEnv;
}

export function ReportRagChatClient({ env }: ReportRagChatClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (message: string) => {
    const text = message.trim();
    if (!text || loading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const previousSources = findLatestAssistantSources(messages).map((s) => ({
        reportId: s.reportId,
        facilityId: s.facilityId,
      }));
      const history = buildHistoryPayload(messages);
      const res = await fetch("/api/admin/report-rag/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, previousSources }),
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
          isFollowUp: data.isFollowUp === true,
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

  const resetConversation = () => {
    if (loading) return;
    setMessages([]);
    setInput("");
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex-1 min-h-0 flex flex-col gap-6">
      <div className="flex items-center gap-3 shrink-0">
        <GoodjobAvatar tone="investigating" size="md" />
        <div>
          <h2 className="text-xl font-bold text-slate-800">施設管理チャットボット</h2>
          <p className="text-sm text-slate-500 mt-1">
            グッジョくんに、確定済みの事故報を横断確認してもらいます。
            根拠の事故報も同時に確認できます。
          </p>
        </div>
      </div>

      {env === "local" && (
        <div className="shrink-0">
          <ReindexButton />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 flex-1 min-h-0 flex flex-col gap-4">
        {messages.length == 0 || (
          <div className="flex items-center justify-between shrink-0">
            <p className="text-xs text-slate-500">
              {`会話 ${messages.length} 件`}
            </p>
          <button
            type="button"
            onClick={resetConversation}
            disabled={loading || messages.length === 0}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            新しい会話を開始
          </button>
        </div>)}

        {messages.length === 0 ? (
          <div className="flex-1 min-h-0 overflow-y-auto text-sm text-slate-500">
            <div className="justify-center h-full flex flex-col gap-4">
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
              <ChatInputForm
                value={input}
                onChange={setInput}
                onSubmit={() => send(input)}
                disabled={loading}
              />
            </div>
            
          </div>
        ) : (
          <ul className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
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
                      {m.isFollowUp && (
                        <div className="mb-1.5 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          前回の事故報に絞って検索
                        </div>
                      )}
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
                              target="_blank"
                              rel="noopener noreferrer"
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

        {messages.length === 0 || (
          <ChatInputForm
            value={input}
            onChange={setInput}
            onSubmit={() => send(input)}
            disabled={loading}
          />
        )}
      </div>
    </div>
  );
}

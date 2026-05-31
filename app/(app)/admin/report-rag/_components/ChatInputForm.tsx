"use client";

import { Send } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
};

export function ChatInputForm({ value, onChange, onSubmit, disabled }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex gap-2 pt-2 px-2 border-t border-slate-100 shrink-0"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="グッジョくんに質問する..."
        disabled={disabled}
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-medium"
      >
        <Send className="w-4 h-4" />
        送信
      </button>
    </form>
  );
}

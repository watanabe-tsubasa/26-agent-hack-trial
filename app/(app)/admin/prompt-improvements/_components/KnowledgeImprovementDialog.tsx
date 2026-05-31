"use client";

import { GoodjobAvatar } from "@/components/goodjob-avatar";
import {
  KNOWLEDGE_DIALOG_LEAD,
  KNOWLEDGE_HEADLINE_COMPLETE,
  KNOWLEDGE_HEADLINE_FAILED,
  KNOWLEDGE_HEADLINE_RUNNING,
} from "@/lib/prompt-improvement/knowledge-copy";
import type {
  KnowledgeStepSnapshot,
} from "@/lib/prompt-improvement/knowledge-improvement-steps";
import type { GoodjobTone } from "@/lib/generation-steps";

type Props = {
  open: boolean;
  steps: KnowledgeStepSnapshot[];
  tone: GoodjobTone;
  failed: boolean;
  done: boolean;
  errorMessage?: string;
  onClose?: () => void;
};

export function KnowledgeImprovementDialog({
  open,
  steps,
  tone,
  failed,
  done,
  errorMessage,
  onClose,
}: Props) {
  if (!open) return null;

  const activeStep = steps.find((s) => s.state === "in_progress");
  const currentDescription = activeStep?.step.description ?? "";

  const headline = failed
    ? KNOWLEDGE_HEADLINE_FAILED
    : done
      ? KNOWLEDGE_HEADLINE_COMPLETE
      : KNOWLEDGE_HEADLINE_RUNNING;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/40 bg-white/75 p-7 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <GoodjobAvatar tone={tone} size="lg" className="flex-shrink-0 drop-shadow" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-700 tracking-wide">
              {KNOWLEDGE_DIALOG_LEAD}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{headline}</h2>
            {!failed && !done && currentDescription && (
              <p className="mt-2 text-sm leading-6 text-slate-600">{currentDescription}</p>
            )}
          </div>
        </div>

        {failed && errorMessage && (
          <p className="mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMessage}
          </p>
        )}

        <ol className="mt-6 space-y-2.5">
          {steps.map(({ step, state }) => (
            <li key={step.key} className="flex items-center gap-3">
              <span className="flex-shrink-0">
                {state === "completed" ? (
                  <span className="inline-flex w-5 h-5 rounded-full bg-emerald-500 text-white items-center justify-center text-[10px]">
                    ✓
                  </span>
                ) : state === "in_progress" ? (
                  <span className="inline-flex w-5 h-5 rounded-full bg-amber-500 text-white items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  </span>
                ) : state === "failed" ? (
                  <span className="inline-flex w-5 h-5 rounded-full bg-red-500 text-white items-center justify-center text-[10px]">
                    !
                  </span>
                ) : (
                  <span className="inline-block w-5 h-5 rounded-full border border-slate-300 bg-white" />
                )}
              </span>
              <span
                className={`text-sm ${
                  state === "completed"
                    ? "text-slate-600"
                    : state === "in_progress"
                      ? "text-slate-900 font-semibold"
                      : state === "failed"
                        ? "text-red-700 font-semibold"
                        : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>

        {(failed || done) && onClose && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-white"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

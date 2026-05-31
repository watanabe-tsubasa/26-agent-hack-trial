"use client";

import { GoodjobAvatar } from "@/components/goodjob-avatar";
import {
  GOODJOB_COMPLETE_COPY,
  GOODJOB_FAILED_COPY,
  GOODJOB_HEADLINE,
  GOODJOB_NAME,
} from "@/lib/goodjob-copy";
import type { StepStatusSnapshot, GoodjobTone } from "@/lib/generation-steps";

type Props = {
  steps: StepStatusSnapshot[];
  tone: GoodjobTone;
  failed: boolean;
  done: boolean;
  errorMessage?: string;
};

export function AgentProgressDialog({ steps, tone, failed, done, errorMessage }: Props) {
  const activeStep = steps.find((s) => s.state === "in_progress");
  const currentDescription = activeStep?.step.description ?? "";

  return (
    <div className="w-full max-w-lg rounded-3xl border border-white/40 bg-white/70 shadow-2xl backdrop-blur-xl p-7">
      <div className="flex items-start gap-4">
        <div className="shrink-0 perspective-midrange">
          <GoodjobAvatar
            tone={tone}
            size="lg"
            className={`drop-shadow ${!failed && !done ? "animate-[spinY_2s_linear_infinite]" : ""}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-700 tracking-wide">{GOODJOB_NAME}</p>
          <h2 className="text-base font-bold text-slate-800 mt-0.5">
            {failed ? GOODJOB_FAILED_COPY : done ? GOODJOB_COMPLETE_COPY : GOODJOB_HEADLINE}
          </h2>
          {!failed && !done && currentDescription && (
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{currentDescription}</p>
          )}
        </div>
      </div>

      {failed && errorMessage && (
        <p className="mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errorMessage}
        </p>
      )}

      <ol className="mt-5 space-y-2.5">
        {steps.map(({ step, state }) => (
          <li key={step.key} className="flex items-center gap-3">
            <span className="shrink-0">
              {state === "completed" ? (
                <span className="inline-flex w-5 h-5 rounded-full bg-emerald-500 text-white items-center justify-center text-[10px]">
                  ✓
                </span>
              ) : state === "in_progress" ? (
                <span className="inline-flex w-5 h-5 rounded-full bg-blue-500 text-white items-center justify-center">
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

      {done && (
        <p className="mt-5 text-center text-sm text-emerald-700 font-medium">
          画面を更新しています…
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { deriveStepStates, pickActiveGoodjobTone } from "@/lib/generation-steps";
import { ReportSkeletonBackground } from "./ReportSkeletonBackground";
import { AgentProgressDialog } from "./AgentProgressDialog";

const POLL_INTERVAL_MS = 1000;

export function ProcessingScreen({ reportId }: { reportId: string }) {
  const [status, setStatus] = useState<string>("queued");
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    let aborted = false;
    const poll = async () => {
      const res = await fetch(`/api/reports/${reportId}/status`);
      if (!res.ok || aborted) return;
      const data = await res.json();
      setStatus(data.status);
      if (!data.isProcessing) {
        if (data.status === "failed") {
          setFailed(true);
          setErrorMessage(data.errorMessage ?? "不明なエラーが発生しました");
        } else {
          setDone(true);
        }
      }
    };
    poll();
    const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
    const elapsedTimer = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);
    return () => {
      aborted = true;
      clearInterval(pollTimer);
      clearInterval(elapsedTimer);
    };
  }, [reportId]);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => window.location.reload(), 600);
      return () => clearTimeout(t);
    }
  }, [done]);

  const snapshots = deriveStepStates(failed ? "failed" : status, elapsedMs);
  const tone = pickActiveGoodjobTone(snapshots);

  return (
    <div className="relative min-h-[70vh]">
      <ReportSkeletonBackground />
      <div className="relative z-10 flex items-center justify-center min-h-[70vh]">
        <AgentProgressDialog
          steps={snapshots}
          tone={tone}
          failed={failed}
          done={done}
          errorMessage={errorMessage}
        />
      </div>
    </div>
  );
}

import type { AnalysisJson, Override, Run } from "./types";

export const CATEGORY_LABELS: Record<string, string> = {
  leakage: "雨漏り・浸水",
  construction: "工事・改修",
  layout: "レイアウト",
  equipment: "設備",
  incident_history: "事故既往",
  maintenance_note: "保守・点検",
  naming: "正式名称",
  other: "その他",
};

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function parseAnalysis(json: string | null): AnalysisJson | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AnalysisJson;
  } catch {
    return null;
  }
}

export function isInFlight(run: Run | null): boolean {
  if (!run) return false;
  return run.status === "queued" || run.status === "running";
}

export function selectOverrideGroups(overrides: Override[]) {
  const active = overrides.find((o) => o.status === "active") ?? null;
  const latestDraft =
    overrides.filter((o) => o.status === "draft").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
  const archived = overrides.filter((o) => o.status === "archived");
  return { active, latestDraft, archived };
}

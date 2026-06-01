export function defaultOccurredAt(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T10:00`;
}

export const DEFAULT_FORM = {
  summary: "",
  occurredAt: "",
  location: "",
  note: "",
  hasVictim: false,
  recoveryStatus: "未復旧",
  amountImpact: "未算定",
};

export type NewReportForm = typeof DEFAULT_FORM;

export function createInitialForm(now: Date = new Date()): NewReportForm {
  return { ...DEFAULT_FORM, occurredAt: defaultOccurredAt(now) };
}

export function validateRequired(form: NewReportForm): string | null {
  if (!form.summary || !form.occurredAt || !form.location) {
    return "事故概要・発生日時・発生場所は必須です。";
  }
  return null;
}

export function buildCreateReportPayload(form: NewReportForm) {
  return {
    ...form,
    occurredAt: new Date(form.occurredAt).toISOString(),
  };
}

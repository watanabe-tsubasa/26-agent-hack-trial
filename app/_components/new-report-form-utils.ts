export const DEFAULT_FORM = {
  summary: "本館3階 南側廊下で天井ボードが落下していた。",
  occurredAt: "2025-05-20T10:15",
  location: "本館 3階 南側廊下",
  note: "現時点で人的被害は確認されていない。",
  hasVictim: false,
  recoveryStatus: "未復旧",
  amountImpact: "未算定",
  facilityId: "store-001",
};

export type NewReportForm = typeof DEFAULT_FORM;

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

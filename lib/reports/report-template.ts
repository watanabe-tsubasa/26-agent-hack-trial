import type { CreateReportInput, FiveWTwoH, Photo, Victim } from "../types";

function formatJapaneseDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
    return `${get("year")}年${get("month")}月${get("day")}日 ${get("hour")}時${get("minute").padStart(2, "0")}分頃`;
  } catch {
    return isoString;
  }
}

type GeneratedContent = {
  title: string;
  victim: Victim;
  fiveWTwoH: FiveWTwoH;
  cause: string;
  treatment: string;
  preventiveAction: string;
  body: string;
};

function generateCeilingTemplate(
  input: CreateReportInput,
  photos: Photo[],
  imageObservation: string
): GeneratedContent {
  const whenStr = formatJapaneseDateTime(input.occurredAt);
  const hasImages = photos.length > 0;
  const howDesc = hasImages
    ? "監視カメラ画像上、廊下床面に天井材が複数散乱している"
    : "現場担当者の報告によると、廊下床面に天井材が散乱していた";

  return {
    title: "事故報告書",
    victim: {
      hasVictim: input.hasVictim,
      category: input.hasVictim ? "来館者" : "なし",
      gender: null,
      age: null,
      damageLevel: input.hasVictim ? "軽傷" : "人的被害なし",
      note: input.note ?? "",
    },
    fiveWTwoH: {
      when: whenStr,
      where: input.location,
      who: input.hasVictim ? "来館者が天井材に接触した可能性がある" : "通行者への接触は確認されていない",
      what: "天井ボードの一部が落下し、床面に散乱した",
      why: "天井ボード固定部の劣化、下地部材の緩み、漏水等の可能性がある",
      how: howDesc,
      howMuch: input.amountImpact === "なし" ? "金額影響なし" : `現時点では金額影響は${input.amountImpact}`,
    },
    cause:
      "天井ボード固定部の経年劣化、下地部材の緩み、または天井裏設備からの漏水等により、天井ボードが落下した可能性がある。",
    treatment:
      "該当エリアを一時立入禁止とし、カラーコーン等で区画した。担当者が現地確認を実施し、落下物の撤去および周辺天井の安全確認を行う。",
    preventiveAction:
      "同一フロアおよび類似箇所の天井ボード固定状態を点検する。天井裏の漏水、設備振動、下地部材の劣化有無を確認する。必要に応じて補修計画を作成する。",
    body: `${whenStr.replace("頃", "")}、${input.location}にて天井ボードの落下が確認された。${hasImages ? `取得画像では、${imageObservation.split("\n")[0].replace(/。$/, "")}。` : ""}現時点で人的被害は${input.hasVictim ? "確認されている" : "確認されていない"}が、二次被害防止のため該当エリアを一時立入禁止とし、担当者による現地確認を実施する。`,
  };
}

function generateEscalatorTemplate(
  input: CreateReportInput,
  photos: Photo[],
  imageObservation: string
): GeneratedContent {
  const whenStr = formatJapaneseDateTime(input.occurredAt);
  const hasImages = photos.length > 0;
  const howDesc = hasImages
    ? "監視カメラ画像上、エスカレーター側面にアクリルボードの欠損および落下物が確認されている"
    : "現場担当者の報告によると、エスカレーター側面のアクリルボードが落下していた";

  return {
    title: "事故報告書",
    victim: {
      hasVictim: input.hasVictim,
      category: input.hasVictim ? "来館者" : "なし",
      gender: null,
      age: null,
      damageLevel: input.hasVictim ? "軽傷" : "人的被害なし",
      note: input.note ?? "",
    },
    fiveWTwoH: {
      when: whenStr,
      where: input.location,
      who: input.hasVictim ? "来館者が落下したアクリルボードに接触した可能性がある" : "通行者への接触は確認されていない",
      what: "エスカレーター側面のアクリルボードが落下し、周辺に散乱した",
      why: "アクリルボード固定部の劣化、振動による緩み、または経年劣化の可能性がある",
      how: howDesc,
      howMuch: input.amountImpact === "なし" ? "金額影響なし" : `現時点では金額影響は${input.amountImpact}`,
    },
    cause:
      "エスカレーター側面アクリルボードの固定部材の経年劣化または振動による緩みにより、アクリルボードが落下した可能性がある。",
    treatment:
      "エスカレーターを停止し、周辺エリアを一時立入禁止とした。担当者が現地確認を実施し、落下物の撤去および周辺アクリルボードの安全確認を行う。",
    preventiveAction:
      "同一エスカレーターおよび類似設備のアクリルボード固定状態を点検する。固定部材の劣化・緩み有無を確認し、必要に応じて交換計画を作成する。",
    body: `${whenStr.replace("頃", "")}、${input.location}にてエスカレーターのアクリルボード落下が確認された。${hasImages ? `取得画像では、${imageObservation.split("\n")[0].replace(/。$/, "")}。` : ""}現時点で人的被害は${input.hasVictim ? "確認されている" : "確認されていない"}が、二次被害防止のためエスカレーターを停止し、担当者による現地確認を実施する。`,
  };
}

function generateGenericTemplate(
  input: CreateReportInput,
): GeneratedContent {
  const whenStr = formatJapaneseDateTime(input.occurredAt);

  return {
    title: "事故報告書",
    victim: {
      hasVictim: input.hasVictim,
      category: input.hasVictim ? "来館者" : "なし",
      gender: null,
      age: null,
      damageLevel: input.hasVictim ? "軽傷" : "人的被害なし",
      note: input.note ?? "",
    },
    fiveWTwoH: {
      when: whenStr,
      where: input.location,
      who: input.hasVictim ? "関係者への接触が確認されている" : "関係者への接触は確認されていない",
      what: input.summary,
      why: "詳細については現在調査中",
      how: "担当者の報告による",
      howMuch: input.amountImpact === "なし" ? "金額影響なし" : `現時点では金額影響は${input.amountImpact}`,
    },
    cause: "詳細については現在調査中。施設設備の点検結果をもとに原因を特定する予定。",
    treatment: "該当エリアを確認し、安全確保のための措置を実施した。担当者による現地確認を実施する。",
    preventiveAction: "類似箇所の安全点検を実施する。必要に応じて補修・改善計画を作成する。",
    body: `${whenStr.replace("頃", "")}、${input.location}にて${input.summary}現時点で人的被害は${input.hasVictim ? "確認されている" : "確認されていない"}。担当者が現地確認を実施し、安全確保のための初動対応を行う。`,
  };
}

export function generateReportContent(
  input: CreateReportInput,
  photos: Photo[],
  imageObservation: string
): GeneratedContent {
  const text = input.location + " " + input.summary;
  if (["天井", "天板"].some((k) => text.includes(k))) {
    return generateCeilingTemplate(input, photos, imageObservation);
  }
  if (["エスカレーター", "エスカレータ"].some((k) => text.includes(k))) {
    return generateEscalatorTemplate(input, photos, imageObservation);
  }
  return generateGenericTemplate(input);
}

import type { Photo, Report } from "../types";

type PhotoNormalized = {
  id: string;
  photoLocationName: string;
  selected: boolean;
  candidateRank: number | null;
  selectionReason: string | null;
  exclusionReason: string | null;
};

function normalizePhoto(p: Photo): PhotoNormalized {
  return {
    id: p.id,
    photoLocationName: p.photoLocationName,
    selected: p.selected !== false,
    candidateRank: p.candidateRank ?? null,
    selectionReason: p.selectionReason ?? null,
    exclusionReason: p.exclusionReason ?? null,
  };
}

export function normalizeReportForDirtyCheck(report: Report) {
  return {
    summary: report.summary,
    fiveWTwoH: report.fiveWTwoH,
    cause: report.cause,
    treatment: report.treatment,
    preventiveAction: report.preventiveAction,
    body: report.body,
    photos: report.photos.map(normalizePhoto),
  };
}

export function isReportDirty(a: Report, b: Report): boolean {
  return (
    JSON.stringify(normalizeReportForDirtyCheck(a)) !==
    JSON.stringify(normalizeReportForDirtyCheck(b))
  );
}

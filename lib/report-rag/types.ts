export type ReportSearchDocument = {
  id: string;
  documentType: "accident_report";
  reportId: string;
  facilityId: string;
  siteKey: string;
  siteName: string;
  status: string;
  title: string;
  incidentTypes: string[];
  locations: string[];
  occurredAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceUpdatedAt: string;
  indexedAt: string;
  text: string;
  embedding: number[];
  metadata: {
    hasPhotos: boolean;
    photoCount: number;
    humanEdited: boolean;
    riskKeywords: string[];
  };
};

export const INDEXABLE_STATUSES = ["confirmed"] as const;
export type IndexableStatus = (typeof INDEXABLE_STATUSES)[number];

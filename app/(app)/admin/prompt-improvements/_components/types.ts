export type Override = {
  id: string;
  locationKey: string;
  title: string;
  overrideText: string;
  source: "manual" | "ai_proposed";
  status: "draft" | "active" | "archived";
  analysisJson: string | null;
  createdAt: string;
  approvedAt: string | null;
};

export type ObservedPattern = {
  fieldPath: string;
  pattern: string;
  recommendation: string;
};

export type FacilityKnowledgeCandidate = {
  category: string;
  title: string;
  content: string;
  confidence: number;
  evidence: { reportId: string; fieldPath: string; quotedCorrection: string }[];
  shouldApplyToGeneration: boolean;
  riskNotes: string[];
};

export type IgnoredStyleCorrection = {
  fieldPath: string;
  reason: string;
};

export type AnalysisJson = {
  summary?: string;
  facilityKnowledgeCandidates?: FacilityKnowledgeCandidate[];
  ignoredStyleCorrections?: IgnoredStyleCorrection[];
  observedCorrectionPatterns?: ObservedPattern[];
  riskNotes?: string[];
};

export type RunStatus = "queued" | "running" | "completed" | "failed" | "superseded";
export type Run = {
  id: string;
  locationKey: string;
  status: RunStatus;
  inputCorrectionCount: number | null;
  proposedOverrideId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

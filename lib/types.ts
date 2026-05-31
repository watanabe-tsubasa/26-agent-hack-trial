export type ReportStatus =
  | "processing"
  | "review"
  | "updated"
  | "confirmed"
  | "queued"
  | "generating_report"
  | "waiting_human_review"
  | "failed";

export type Victim = {
  hasVictim: boolean;
  category: "なし" | "従業員" | "協力会社" | "来館者" | "テナント関係者" | "その他";
  gender?: "男性" | "女性" | "その他" | null;
  age?: number | null;
  damageLevel: string;
  note?: string;
};

export type FiveWTwoH = {
  when: string;
  where: string;
  who: string;
  what: string;
  why: string;
  how: string;
  howMuch: string;
};

export type PhotoSourceType = "camera_frame" | "uploaded_photo";

export type Photo = {
  id: string;
  imageUrl: string;
  cameraName: string;
  capturedAt: string;
  photoLocationName: string;
  sourceType?: PhotoSourceType;
  blobContainer?: string;
  blobName?: string;
  caption?: string;
  relevanceScore?: number;
  observedFacts?: string[];
};

export type Feedback = {
  id: string;
  reportId: string;
  fieldName: string;
  before: string;
  after: string;
  diffSummary: string;
  savedAt: string;
};

export type AiOutput = {
  victim: Victim;
  fiveWTwoH: FiveWTwoH;
  cause: string;
  treatment: string;
  preventiveAction: string;
  body: string;
  photos: Photo[];
};

export type Report = {
  id: string;
  status: ReportStatus;
  title: string;
  summary: string;
  occurredAt: string;
  location: string;
  note?: string;
  reportedAt: string;
  reporter: string;
  department: string;
  recoveredAt?: string | null;
  amount?: string;
  victim: Victim;
  fiveWTwoH: FiveWTwoH;
  cause: string;
  treatment: string;
  preventiveAction: string;
  body: string;
  photos: Photo[];
  originalAiOutput: AiOutput;
  feedbacks: Feedback[];
  createdAt: string;
  updatedAt: string;
};

export type CreateReportInput = {
  summary: string;
  occurredAt: string;
  location: string;
  note?: string;
  hasVictim: boolean;
  recoveryStatus: string;
  amountImpact: string;
  facilityId?: string;
};

export type FrameAsset = {
  id: string;
  videoAssetId: string | null;
  facilityId: string;
  cameraId: string;
  cameraName: string;
  locationName: string;
  floorLabel: string | null;
  capturedAt: string;
  frameOffsetSeconds: number | null;
  frameIndex: number | null;
  blobContainer: string;
  blobName: string;
  scenarioTags: string[];
  description: string | null;
  createdAt: string;
};

export type ProcessingStep = {
  label: string;
  status: "pending" | "in_progress" | "completed";
};

export const PROCESSING_STEPS = [
  "入力内容を確認中",
  "発生日時・場所から関連カメラを検索中",
  "カメラ画像を取得中",
  "画像を解析中",
  "事故報告書フォーマットに整理中",
  "写真台帳を作成中",
  "事故報告書ドラフトを生成中",
] as const;

export const STEP_DURATION_MS = 700;
export const TOTAL_PROCESSING_MS = PROCESSING_STEPS.length * STEP_DURATION_MS;
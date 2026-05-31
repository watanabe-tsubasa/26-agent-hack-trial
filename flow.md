# 事故報作成フロー

このドキュメントは、現状のコードベースにおける事故報告書ドラフト作成フローをまとめたものです。対象は「事故報の作成、画像候補取得、画像評価、ドラフト生成、確認・修正・確定」です。

RAG の検索・チャット・索引化ロジックはここでは扱いません。

## 全体像

事故報作成は、画面からの `POST /api/reports` で即座にドラフトを作るのではなく、Service Bus と Worker を使って非同期に実行されます。

```text
サイトユーザーが事故概要を入力
  -> POST /api/reports
  -> reports に queued レコードを作成
  -> Service Bus に { reportId } を送信
  -> Worker が report.generate message を受信
  -> reports.status = generating_report
  -> reports.input_json から CreateReportInput を復元
  -> parse_input step event を記録
  -> frame_assets から画像候補を検索
  -> 画像評価 AI または mock で imageObservation を作成
  -> 事故報 AI またはテンプレートで本文ドラフトを生成
  -> reports.ai_draft_json を保存
  -> reports.status = waiting_human_review
  -> ユーザーが画面で確認・修正・確定
```

主な実装ファイルは次の通りです。

| 領域 | ファイル | 主な責務 |
| --- | --- | --- |
| 新規作成ページ | `app/(app)/page.tsx` | ログイン・権限確認後にフォームを表示 |
| 新規作成フォーム | `app/(app)/_components/new-report-form.tsx` | 入力値を `/api/reports` に送信 |
| 入力整形 | `app/_components/new-report-form-utils.ts` | 必須チェック、日時の ISO 変換 |
| 作成 API | `app/api/reports/route.ts` | queued レコード作成、Service Bus enqueue |
| 永続化 | `lib/reports/report-repository.ts` | `reports` テーブル操作 |
| Queue 送信 | `lib/service-bus.ts` | report generation message 送信 |
| Worker 起動 | `worker/report-worker.ts` | Service Bus receiver 起動 |
| Worker handler | `worker/handlers.ts` | report message 処理、step event 記録 |
| ドラフト生成本体 | `lib/agent/mock-agent.ts` | 画像検索、画像評価、本文生成を束ねる |
| 画像候補検索 | `lib/agent/camera-search.ts`, `lib/agent/frame-asset-repository.ts` | `frame_assets` から `Photo[]` を取得 |
| Blob URL / SAS | `lib/blob-storage.ts` | 表示用 Blob URL と AI 評価用 SAS URL を生成 |
| 画像評価 AI | `lib/agent/image-evaluation-ai.ts` | Azure OpenAI Vision に画像を渡して評価 |
| 事故報 AI | `lib/agent/accident-report-ai.ts` | `imageObservation` を含む入力から事故報本文を生成 |
| fallback テンプレート | `lib/reports/report-template.ts` | AI 無効時・失敗時の本文生成 |
| 生成進捗 | `lib/generation-steps.ts` | 生成 step 定義、event からの状態復元 |
| step event | `lib/agent-events/agent-event-log.ts` | Cosmos DB へ生成 step event を保存・取得 |
| 進捗画面 | `app/(app)/reports/[id]/_components/ProcessingScreen.tsx` | status と event を polling |

## 1. 入力から queued レコード作成まで

### ページとフォーム

事故報作成ページは `app/(app)/page.tsx` です。未ログインなら `/login`、サイトユーザー以外なら管理者向け画面へ redirect し、サイトユーザーだけに `NewReportForm` を表示します。

```ts
// app/(app)/page.tsx
// 抜粋
const session = await getCurrentSessionFromCookies();
if (!session) redirect("/login");
return <NewReportForm />;
```

フォーム送信は `app/(app)/_components/new-report-form.tsx` の `handleSubmit()` です。

```ts
const res = await fetch("/api/reports", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(buildCreateReportPayload(form)),
});
const { reportId } = await res.json();
router.push(`/reports/${reportId}`);
```

入力値は `app/_components/new-report-form-utils.ts` で必須チェックされ、`datetime-local` の値は ISO 文字列に変換されます。

```ts
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
```

作成 API に渡る型は `lib/types.ts` の `CreateReportInput` です。

```ts
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
```

### 作成 API

`POST /api/reports` は `app/api/reports/route.ts` にあります。

```ts
const site = await getCurrentSiteFromCookies();
if (!site) return Response.json({ error: "unauthorized" }, { status: 401 });

const body = (await request.json()) as CreateReportInput;
const scopedInput: CreateReportInput = { ...body, facilityId: site.facilityId };

const reportId = await createQueuedReport(scopedInput);
await enqueueReportGeneration(reportId);

return Response.json({ reportId, status: "queued" }, { status: 202 });
```

重要な点は、`facilityId` をリクエスト body から信用せず、Cookie の現在サイトから上書きしていることです。この `facilityId` が後続の画像候補検索条件になります。

`createQueuedReport()` は `lib/reports/report-repository.ts` にあり、`reports` に `queued` レコードを作成します。

```ts
export async function createQueuedReport(input: CreateReportInput): Promise<string> {
  const id = `report_${randomUUID()}`;

  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .input("status", sql.NVarChar, "queued")
    .input("summary", sql.NVarChar, input.summary)
    .input("inputJson", sql.NVarChar, JSON.stringify(input))
    .query(`
      insert into reports (id, status, summary, input_json)
      values (@id, @status, @summary, @inputJson)
    `);

  return id;
}
```

この段階では `ai_draft_json` は未作成です。Worker が後で保存します。

## 2. Service Bus と Worker

`enqueueReportGeneration()` は `lib/service-bus.ts` で `{ reportId }` を Service Bus に送信します。

```ts
await sender.sendMessages({
  body: { reportId },
  contentType: "application/json",
  subject: "report.generate",
  messageId: reportId,
});
```

Worker は `worker/report-worker.ts` で report queue を購読し、message body を `handleReportMessage()` に渡します。

```ts
receivers.push(
  startReceiver(client, reportQueueName!, "[report]", handleReportMessage)
);
```

report message の本体処理は `worker/handlers.ts` です。現在は、ドラフト生成だけでなく、生成 step event もここで記録します。

```ts
export async function handleReportMessage(body: unknown, deps: WorkerDeps = defaultDeps): Promise<void> {
  const parsed = deps.parseReportMsg(body);
  if (!parsed) return;

  const { reportId } = parsed;
  let currentStep: GenerationStepKey = "parse_input";

  const emit = async (...) => {
    await deps.appendEvent({
      entityType: "report",
      reportId,
      runId: null,
      stepKey,
      stepLabel: stepLabel(stepKey),
      state,
      goodjobTone: stepTone(stepKey),
      metadata: extra?.metadata,
      errorMessage: extra?.errorMessage,
    });
  };

  const onStep: GenerationStepReporter = async (e) => {
    currentStep = e.stepKey;
    await emit(e.stepKey, e.state, { metadata: e.metadata, errorMessage: e.errorMessage });
  };

  try {
    await deps.updateStatus(reportId, "generating_report");

    currentStep = "parse_input";
    await emit("parse_input", "started");
    const input = await deps.getInput(reportId);
    if (!input) throw new Error(`input not found: ${reportId}`);
    await emit("parse_input", "completed");

    const draft = await deps.generateDraft(input, onStep);
    draft.id = reportId;
    draft.status = "waiting_human_review";

    currentStep = "prepare_review";
    await emit("prepare_review", "started");
    await deps.saveDraft(reportId, draft);
    await emit("prepare_review", "completed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    await emit(currentStep, "failed", { errorMessage: msg });
    await deps.updateStatus(reportId, "failed", msg);
    throw err;
  }
}
```

状態遷移は以下です。

| タイミング | `reports.status` |
| --- | --- |
| API が作成した直後 | `queued` |
| Worker が処理開始 | `generating_report` |
| AI draft 保存完了 | `waiting_human_review` |
| Worker 内で例外 | `failed` |
| ユーザーが保存 | `updated` |
| ユーザーが確定 | `confirmed` |

## 3. 生成 step event と進捗表示

現在の進捗表示は、以前の「elapsedMs による疑似進捗」だけではなく、Cosmos DB に記録された実 step event を優先して使います。

### step 定義

`lib/generation-steps.ts` の step は以下です。

```ts
export type GenerationStepKey =
  | "parse_input"
  | "search_camera_frames"
  | "evaluate_images"
  | "generate_report"
  | "prepare_review";
```

`deriveStepStatesFromEvents()` は、`started` を `in_progress`、`completed` を `completed`、`failed` を `failed` に変換します。

```ts
export function deriveStepStatesFromEvents(events: AgentEventLike[]): StepStatusSnapshot[] {
  const lastByStep = new Map<string, AgentEventLike>();
  for (const e of events) lastByStep.set(e.stepKey, e);
  return GENERATION_STEPS.map((step) => {
    const e = lastByStep.get(step.key);
    const state: StepState = !e
      ? "pending"
      : e.state === "started"
        ? "in_progress"
        : e.state === "completed"
          ? "completed"
          : "failed";
    return { step, state };
  });
}
```

event がない場合は従来通り `deriveStepStates(status, elapsedMs)` による疑似進捗に fallback します。

### event の保存先

`lib/agent-events/agent-event-log.ts` は Cosmos DB を使って step event を保存します。Cosmos の設定がない場合は何も保存せず、処理は継続します。

```ts
export async function appendAgentEvent(event: AppendAgentEventInput): Promise<void> {
  const container = getCosmosContainer();
  if (!container) return;

  const doc = buildAgentEventDoc(event);
  if (!doc) return;

  try {
    await container.items.create(doc);
  } catch (err) {
    console.warn("appendAgentEvent failed", err);
  }
}
```

report の event は `reportId` を partition key 相当の `entityId` として保存・取得します。

```ts
export function listAgentEventsByReport(reportId: string): Promise<AgentEvent[]> {
  return listEventsByEntity(reportId);
}
```

### 画面側の polling

`app/(app)/reports/[id]/_components/ProcessingScreen.tsx` は、1 秒ごとに status と events を同時に取得します。

```ts
const [statusRes, eventsRes] = await Promise.all([
  fetch(`/api/reports/${reportId}/status`),
  fetch(`/api/reports/${reportId}/events`),
]);
```

event が 1 件以上あれば event ベースの進捗を使い、なければ status と経過時間の疑似進捗を使います。

```ts
const snapshots =
  events.length > 0
    ? deriveStepStatesFromEvents(events)
    : deriveStepStates(failed ? "failed" : status, elapsedMs);
```

`GET /api/reports/[id]/events` は `app/api/reports/[id]/events/route.ts` です。

```ts
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const events = await listAgentEventsByReport(id);
  return Response.json({ events });
}
```

`GET /api/reports/[id]/status` は `queued` と `generating_report` を処理中として返します。

```ts
const processingStatuses = ["queued", "generating_report"];
const isProcessing = processingStatuses.includes(row.status);
```

## 4. ドラフト生成本体

Worker から呼ばれる本体は `lib/agent/mock-agent.ts` の `generateReportDraft()` です。ファイル名は `mock-agent` ですが、現在も実際の画像候補検索、画像評価 AI、事故報 AI の呼び出しをここで束ねています。

```ts
export async function generateReportDraft(
  input: CreateReportInput,
  onStep?: GenerationStepReporter
): Promise<Report> {
  await onStep?.({ stepKey: "search_camera_frames", state: "started" });
  const photoCandidates = await searchCameraFrames(input);
  await onStep?.({
    stepKey: "search_camera_frames",
    state: "completed",
    metadata: { candidateCount: photoCandidates.length },
  });

  await onStep?.({ stepKey: "evaluate_images", state: "started" });
  const { photos, imageObservation, usedFallback } = await resolvePhotosAndObservation(
    input,
    photoCandidates
  );
  await onStep?.({
    stepKey: "evaluate_images",
    state: "completed",
    metadata: { photosUsed: photos.length, usedFallback },
  });

  await onStep?.({ stepKey: "generate_report", state: "started" });
  ...
  await onStep?.({ stepKey: "generate_report", state: "completed" });
}
```

`generateReportDraft()` は次の順序で処理します。

1. `searchCameraFrames(input)` で画像候補を取得する。
2. `resolvePhotosAndObservation()` で画像評価 AI または mock 所見を作る。
3. `generateAccidentReportWithAI()` または `generateReportContent()` で事故報本文を作る。
4. `Report` オブジェクトを組み立て、`originalAiOutput` に AI 初期出力を保持する。
5. Worker 側で `saveAiDraft()` され、レビュー待ちになる。

`originalAiOutput` は修正差分の比較元です。

```ts
const aiOutput = {
  victim: content.victim,
  fiveWTwoH: content.fiveWTwoH,
  cause: content.cause,
  treatment: content.treatment,
  preventiveAction: content.preventiveAction,
  body: content.body,
  photos,
};
```

## 5. 画像取得ロジック

画像候補取得は `lib/agent/camera-search.ts` から始まります。

```ts
const photoCandidates = await searchCameraFrames(input);
```

### scenario tag 推定

`searchCameraFrames()` は、事故概要と発生場所に含まれるキーワードから scenario tag を推定します。

```ts
const CEILING_KEYWORDS = ["天井", "天板", "ボード"];
const ESCALATOR_KEYWORDS = ["エスカレーター", "エスカレータ"];

function detectScenarioTag(input: CreateReportInput): string | null {
  const text = `${input.location} ${input.summary}`;
  if (CEILING_KEYWORDS.some((k) => text.includes(k))) return "ceiling";
  if (ESCALATOR_KEYWORDS.some((k) => text.includes(k))) return "escalator";
  return null;
}
```

現状の tag 推定は次の範囲です。

| 入力中のキーワード | 推定 tag |
| --- | --- |
| `天井`, `天板`, `ボード` | `ceiling` |
| `エスカレーター`, `エスカレータ` | `escalator` |
| それ以外 | `null` |

`転倒` などの語は、現状ここでは tag に変換されません。その場合は tag 検索ではなく、施設全体のフレーム検索に fallback します。

### 検索順序

`facilityId` がなければ画像候補は空です。`facilityId` がある場合は、tag 検索を優先し、見つからなければ施設内検索に fallback します。

```ts
export async function searchCameraFrames(input: CreateReportInput): Promise<Photo[]> {
  if (!input.facilityId) return [];
  const tag = detectScenarioTag(input);
  const tagged = tag ? await searchFrameAssets(tag, input.facilityId) : [];
  if (tagged.length > 0) return tagged;
  return searchFrameAssets(null, input.facilityId);
}
```

### frame_assets 検索

DB 検索の本体は `lib/agent/frame-asset-repository.ts` の `searchFrameAssets()` です。

```ts
export async function searchFrameAssets(
  scenarioTag: string | null,
  facilityId: string
): Promise<Photo[]> {
  const request = pool.request().input("facilityId", sql.NVarChar, facilityId);

  let where = "facility_id = @facilityId";
  if (scenarioTag) {
    request.input("tag", sql.NVarChar, `%${scenarioTag}%`);
    where += " and scenario_tags like @tag";
  }

  const result = await request.query<FrameAssetRow>(`
    select top 8 *
    from frame_assets
    where ${where}
    order by captured_at asc
  `);

  return result.recordset.map(rowToPhoto);
}
```

現状の仕様は以下です。

| 項目 | 現状 |
| --- | --- |
| 検索対象 | `frame_assets` |
| 必須条件 | `facility_id = @facilityId` |
| tag 条件 | `scenario_tags like '%tag%'` |
| 最大件数 | `top 8` |
| 並び順 | `captured_at asc` |
| `occurredAt` による時刻近傍検索 | なし |
| カメラ位置の類似度検索 | なし |

つまり、現状は「事故発生日時に近い画像」を探しているわけではありません。施設と scenario tag で絞り、古い順に最大 8 件を取得します。

### FrameAsset から Photo への変換

DB row は `rowToPhoto()` で `Photo` に変換されます。

```ts
function rowToPhoto(row: FrameAssetRow): Photo {
  const asset = rowToFrameAsset(row);
  return {
    id: asset.id,
    imageUrl: getBlobUrl(asset.blobContainer, asset.blobName),
    cameraName: asset.cameraName,
    capturedAt: asset.capturedAt,
    photoLocationName: asset.locationName,
    blobContainer: asset.blobContainer,
    blobName: asset.blobName,
  };
}
```

`Photo` 型は `lib/types.ts` です。

```ts
export type Photo = {
  id: string;
  imageUrl: string;
  cameraName: string;
  capturedAt: string;
  photoLocationName: string;
  blobContainer?: string;
  blobName?: string;
  caption?: string;
  relevanceScore?: number;
  observedFacts?: string[];
};
```

`imageUrl` は画面表示用、`blobContainer` / `blobName` は AI 評価用 SAS URL を生成するための元情報です。

### 表示用 Blob URL

表示用 URL は `lib/blob-storage.ts` の `getBlobUrl()` が組み立てます。

```ts
export function getBlobUrl(container: string, blobName: string): string {
  const endpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT;
  if (!endpoint) throw new Error("AZURE_STORAGE_BLOB_ENDPOINT is not set");
  return `${endpoint.replace(/\/$/, "")}/${container}/${blobName}`;
}
```

これは SAS 付き URL ではありません。写真台帳画面と帳票プレビューは、この `imageUrl` を `<img>` にそのまま使います。

```tsx
<img
  src={photo.imageUrl}
  alt={photo.photoLocationName}
  className="absolute inset-0 w-full h-full object-cover"
/>
```

## 6. 画像評価ロジック

画像評価は `lib/agent/mock-agent.ts` の `resolvePhotosAndObservation()` に集約されています。

```ts
async function resolvePhotosAndObservation(
  input: CreateReportInput,
  photoCandidates: Photo[]
): Promise<{ photos: Photo[]; imageObservation: string; usedFallback: boolean }> {
  const aiEnabled = process.env.AI_IMAGE_EVALUATION_ENABLED === "true";

  if (!aiEnabled || photoCandidates.length === 0) {
    const imageObservation = await analyzeImagesMock(photoCandidates);
    return { photos: photoCandidates, imageObservation, usedFallback: false };
  }

  try {
    const evaluation = await evaluateImagesWithAI({ input, photos: photoCandidates });
    const photos = applyImageEvaluationToPhotos(photoCandidates, evaluation);
    const imageObservation = buildImageObservationText(evaluation);
    return { photos, imageObservation, usedFallback: false };
  } catch (err) {
    console.error("Image evaluation failed. Falling back to analyzeImagesMock.", err);
    const imageObservation = await analyzeImagesMock(photoCandidates);
    return { photos: photoCandidates, imageObservation, usedFallback: true };
  }
}
```

分岐は以下です。

| 条件 | 処理 | `usedFallback` |
| --- | --- | --- |
| `AI_IMAGE_EVALUATION_ENABLED !== "true"` | `analyzeImagesMock()` | `false` |
| 画像候補が 0 件 | `analyzeImagesMock([])` | `false` |
| AI 評価成功 | `evaluateImagesWithAI()` | `false` |
| AI 評価で例外 | `analyzeImagesMock()` | `true` |

`usedFallback` は「AI 評価を試したが失敗した」場合だけ `true` になります。

### AI 評価用 SAS URL

画像評価 AI には、画面表示用 `imageUrl` ではなく、読み取り専用の一時 SAS URL を渡します。

```ts
const photosWithSas = await Promise.all(
  photos.map(async (p) => {
    if (!p.blobContainer || !p.blobName) {
      throw new Error(`Photo ${p.id} has no blobContainer/blobName for SAS generation`);
    }
    const sasUrl = await generateBlobReadSasUrl(p.blobContainer, p.blobName);
    return { photo: p, sasUrl };
  })
);
```

SAS URL は `lib/blob-storage.ts` の `generateBlobReadSasUrl()` で生成されます。権限は読み取り `r`、デフォルト有効期限は 15 分です。

```ts
return blobClient.generateSasUrl({
  permissions: BlobSASPermissions.parse("r"),
  expiresOn,
});
```

`blobContainer` / `blobName` が欠けている画像は AI 評価できず、上位で mock fallback になります。

### Azure OpenAI Vision への入力

画像評価 AI の本体は `lib/agent/image-evaluation-ai.ts` の `evaluateImagesWithAI()` です。

AI には、事故入力と画像候補メタデータを JSON テキストとして渡します。

```ts
const contextText = JSON.stringify(
  {
    accidentInput: input,
    photoCandidates: photos.map((p) => ({
      id: p.id,
      cameraName: p.cameraName,
      capturedAt: p.capturedAt,
      photoLocationName: p.photoLocationName,
    })),
  },
  null,
  2
);
```

各画像は `input_text` で `imageId` を明示し、その直後に `input_image` で SAS URL を渡します。

```ts
const imageContents = photosWithSas.flatMap(({ photo, sasUrl }) => [
  {
    type: "input_text" as const,
    text: `[image] imageId=${photo.id}`,
  },
  {
    type: "input_image" as const,
    image_url: sasUrl,
    detail: "auto" as const,
  },
]);
```

Responses API の呼び出しは structured output です。

```ts
const response = await client.responses.create({
  model: deployment,
  instructions: IMAGE_EVALUATION_SYSTEM_PROMPT,
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: contextText },
        ...imageContents,
      ],
    },
  ],
  text: {
    format: {
      type: "json_schema",
      name: "image_evaluation_output",
      strict: true,
      schema: imageEvaluationOutputJsonSchema,
    },
  },
});
```

ログには件数と deployment 名は出しますが、SAS URL やプロンプト全文は出していません。

### 画像評価プロンプトと schema

`lib/agent/image-evaluation-prompt.ts` では、画像から客観的に観察できる事実だけを `observedFacts` に書き、原因・責任・時系列・人的被害を画像だけで断定しないように制約しています。

返却 schema は `lib/agent/image-evaluation-schema.ts` です。

```ts
export const imageEvaluationResultSchema = z.object({
  imageId: z.string(),
  relevanceScore: z.number().min(0).max(1),
  shouldUseInLedger: z.boolean(),
  observedFacts: z.array(z.string()),
  suggestedCaption: z.string(),
  riskNotes: z.array(z.string()),
});

export const imageEvaluationOutputSchema = z.object({
  summary: z.string(),
  results: z.array(imageEvaluationResultSchema),
});
```

戻り値は JSON parse 後に Zod で検証します。schema 不一致も例外になり、mock fallback の対象です。

```ts
const raw = response.output_text;
if (!raw) throw new Error("Azure OpenAI response content is empty");

const parsed = imageEvaluationOutputSchema.parse(JSON.parse(raw));
```

### 評価結果から imageObservation を作る

事故報本文生成 AI に渡す `imageObservation` は、評価結果を `buildImageObservationText()` で文字列化したものです。

```ts
lines.push(`総評: ${evaluation.summary}`);
for (const result of evaluation.results) {
  lines.push(
    `- imageId: ${result.imageId} (relevance=${result.relevanceScore.toFixed(2)}, useInLedger=${result.shouldUseInLedger})`
  );
  ...
}
```

この文字列に、総評、関連度、写真台帳採用可否、観察事実、キャプション案、注意点が含まれます。

### 評価結果を Photo に反映する

`applyImageEvaluationToPhotos()` は、画像評価結果を `Photo[]` に反映します。

```ts
const enriched = photos.map((photo) => {
  const result = resultsById.get(photo.id);
  if (!result) return photo;
  return {
    ...photo,
    caption: result.suggestedCaption || photo.caption,
    relevanceScore: result.relevanceScore,
    observedFacts: result.observedFacts,
  };
});

const usable = enriched.filter((photo) => {
  const result = resultsById.get(photo.id);
  if (!result) return true;
  return result.shouldUseInLedger;
});

usable.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
```

反映内容は以下です。

| 評価結果 | 反映 |
| --- | --- |
| `suggestedCaption` | `photo.caption` |
| `relevanceScore` | `photo.relevanceScore` |
| `observedFacts` | `photo.observedFacts` |
| `shouldUseInLedger = false` | 写真台帳候補から除外 |
| `relevanceScore` | 高い順に並び替え |

現状の UI では、`caption`, `relevanceScore`, `observedFacts` は `Report.photos` には保存されますが、写真台帳画面・帳票プレビューには直接表示されていません。

## 7. mock 画像所見 fallback

AI 画像評価が無効な場合、画像が 0 件の場合、または AI 評価で例外が発生した場合は、`lib/agent/mock-vision.ts` の `analyzeImagesMock()` を使います。

```ts
export async function analyzeImagesMock(photos: Photo[]): Promise<string> {
  if (photos.length === 0) return NO_IMAGE_OBSERVATION;

  const firstUrl = photos[0].imageUrl;
  if (firstUrl.includes("ceiling")) return CEILING_OBSERVATION;
  if (firstUrl.includes("escalator")) return ESCALATOR_OBSERVATION;
  return NO_IMAGE_OBSERVATION;
}
```

mock は 1 枚目の `imageUrl` に `ceiling` または `escalator` が含まれるかで固定所見を返します。これにより、Vision 呼び出しや SAS URL 生成に失敗しても、事故報ドラフト生成全体は継続しやすくなっています。

## 8. 事故報本文生成

画像評価または mock で作った `imageObservation` は、事故報本文生成に渡されます。

### AI による本文生成

`AI_REPORT_GENERATION_ENABLED === "true"` の場合は、`lib/agent/accident-report-ai.ts` の `generateAccidentReportWithAI()` を使います。

```ts
content = await generateAccidentReportWithAI({
  input,
  photos,
  imageObservation,
  locationKey: input.facilityId,
});
```

事故報 AI に渡す payload は、事故入力、画像所見、採用写真のメタデータです。ここでは画像そのものは渡しません。

```ts
const payload = {
  accidentInput: input,
  imageObservation,
  photoCandidates: photos.map((p) => ({
    id: p.id,
    cameraName: p.cameraName,
    capturedAt: p.capturedAt,
  })),
};
```

事故報 AI も JSON Schema の structured output で返します。

```ts
const response = await client.responses.create({
  model: deployment,
  instructions: systemPrompt,
  input: [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: JSON.stringify(payload, null, 2),
        },
      ],
    },
  ],
  text: {
    format: {
      type: "json_schema",
      name: "accident_report_content",
      strict: true,
      schema: generatedContentJsonSchema,
    },
  },
});
```

AI 本文生成が失敗した場合はテンプレート生成に fallback します。

```ts
try {
  content = await generateAccidentReportWithAI(...);
} catch (err) {
  console.error("AI report generation failed. Falling back to mock.", err);
  content = generateReportContent(input, photos, imageObservation);
}
```

### テンプレート fallback

AI 本文生成が無効または失敗した場合は、`lib/reports/report-template.ts` の `generateReportContent()` を使います。

```ts
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
```

天井・エスカレーター用テンプレートでは、画像がある場合に `imageObservation` の 1 行目を本文へ差し込みます。generic template は現状 `imageObservation` を本文に使っていません。

## 9. ドラフト保存と画面表示

`generateReportDraft()` が返した `Report` は、Worker 側で `reportId` と `waiting_human_review` を設定され、`saveAiDraft()` で DB に保存されます。

```ts
const draft = await deps.generateDraft(input, onStep);
draft.id = reportId;
draft.status = "waiting_human_review";
await deps.saveDraft(reportId, draft);
```

`saveAiDraft()` は `reports.ai_draft_json` に JSON を保存し、status を `waiting_human_review` にします。

```sql
update reports
set status = 'waiting_human_review',
    ai_draft_json = @aiDraftJson,
    updated_at = sysutcdatetime()
where id = @id
```

`/reports/[id]` 画面は `GET /api/reports/[id]` で report を取得し、`queued` または `generating_report` なら `ProcessingScreen`、それ以外なら編集画面を表示します。

```ts
if (isProcessingStatus(report.status)) {
  return <ProcessingScreen reportId={id} />;
}
```

写真台帳タブでは `report.photos` を最大 8 枠に表示します。ユーザーが編集できるのは現状 `photoLocationName` だけです。

```tsx
<input
  type="text"
  value={photo.photoLocationName}
  onChange={(e) => setPhotoName(photo.id, e.target.value)}
/>
```

保存時、写真については `id` と `photoLocationName` だけを PATCH します。

```ts
photos: editedReport.photos.map((p) => ({
  id: p.id,
  photoLocationName: p.photoLocationName,
})),
```

API 側では既存の `Photo` に patch を merge します。

```ts
function mergePhotos(
  current: { id: string; [key: string]: unknown }[],
  patches: { id?: string; [key: string]: unknown }[]
) {
  return current.map((photo) => {
    const patch = patches.find((p) => p.id === photo.id);
    return patch ? { ...photo, ...patch } : photo;
  });
}
```

## 10. 修正・確定

ユーザーが修正内容を保存すると、`PATCH /api/reports/[id]` が呼ばれます。

```ts
const newFeedbacks = recordFeedbacks(current, updates);
...
await saveUserDraft(id, updated);
```

`saveUserDraft()` は `user_draft_json` を保存し、status を `updated` にします。

```sql
update reports
set status = 'updated',
    user_draft_json = @userDraftJson,
    feedbacks_json = @feedbacksJson,
    updated_at = sysutcdatetime()
where id = @id
```

確定時は `POST /api/reports/[id]/confirm` です。AI draft と user draft が両方ある場合、本文系フィールドの JSON diff を `report_corrections` に保存します。

```ts
const diffItems = diffJson(extractContent(aiDraft), extractContent(userDraft));
if (diffItems.length > 0) {
  await saveReportCorrection({ reportId: id, aiDraftJson, userDraftJson, diffItems });
}

await confirmReport(id);
```

確定時の差分対象は本文系フィールドです。写真台帳の `photos` はこの `report_corrections` の対象には含まれていません。

```ts
const CONTENT_KEYS: (keyof Report)[] = [
  "title", "victim", "fiveWTwoH", "cause", "treatment", "preventiveAction", "body",
];
```

一方、通常保存時の `recordFeedbacks()` では、写真場所名称の変更も `feedbacks` に記録されます。

## 11. 関連する環境変数

事故報作成フローに関係する主な環境変数です。

| 環境変数 | 用途 |
| --- | --- |
| `DATABASE_URL` | Azure SQL 接続 |
| `SERVICE_BUS_CONNECTION_STRING` | Service Bus 接続 |
| `SERVICE_BUS_REPORT_QUEUE_NAME` | report generation queue 名 |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob 操作、SAS URL 生成 |
| `AZURE_STORAGE_BLOB_ENDPOINT` | 表示用 `imageUrl` の base URL |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | 画像評価・本文生成で使う deployment |
| `AI_IMAGE_EVALUATION_ENABLED` | `"true"` のとき画像評価 AI を使う |
| `AI_REPORT_GENERATION_ENABLED` | `"true"` のとき事故報本文生成 AI を使う |
| `COSMOS_CONNECTION_STRING` または `COSMOS_ENDPOINT` / `COSMOS_KEY` | 生成 step event 保存 |
| `COSMOS_DATABASE` | step event 保存 DB 名。未指定時は `agent-hack-trial` |
| `COSMOS_CONTAINER` | step event 保存 container 名。未指定時は `agent_events` |
| `NEXT_PUBLIC_BASE_URL` | preview page から report API を呼ぶ base URL |

## 12. 現状の制約と注意点

### 画像取得

- `searchCameraFrames()` は `occurredAt` に近い画像を検索していません。
- `frame_assets` 検索は `facility_id` と任意の `scenario_tags like` のみです。
- scenario tag 推定は `ceiling` と `escalator` のみです。
- tag が当たらない場合、施設内の `captured_at asc top 8` が返るため、事故と無関係な候補が混ざる可能性があります。

### 画像評価

- `AI_IMAGE_EVALUATION_ENABLED` が `"true"` でない限り、Azure OpenAI Vision は呼ばれません。
- `Photo.blobContainer` / `Photo.blobName` がない画像は AI 評価できず、mock fallback になります。
- AI 評価結果の `caption`, `relevanceScore`, `observedFacts` は `Report.photos` には保持されますが、現行 UI では直接表示されていません。
- 画像評価は「画像に写っている事実」の抽出に限定する設計です。原因・責任・時系列・人的被害の断定はプロンプトで抑制しています。

### 進捗表示

- Cosmos DB に step event が保存されていれば、実 event ベースで進捗表示します。
- Cosmos DB が未設定、または event 取得に失敗した場合は、従来通り status と elapsedMs による疑似進捗に fallback します。
- step event の保存失敗は Worker 全体の失敗にはしません。

### fallback

- 画像評価 AI が失敗しても `analyzeImagesMock()` に戻るため、ドラフト生成全体は継続します。
- 事故報本文生成 AI が失敗しても `generateReportContent()` に戻るため、ドラフト生成全体は継続します。
- Worker 全体で捕捉できない例外が出た場合のみ、`reports.status` は `failed` になります。

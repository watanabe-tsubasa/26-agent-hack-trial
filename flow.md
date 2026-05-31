# 事故報作成フロー

このドキュメントは、現状のコードベースにおける「事故報告書ドラフト作成」の処理経路を整理したものです。特に、カメラ画像候補の取得ロジックと、取得した画像を AI で評価する部分を中心に記述します。

## 全体像

事故報作成は同期処理ではなく、画面から作成依頼を出した後、Service Bus 経由で Worker が非同期にドラフトを生成する構成です。

```text
ユーザー入力
  -> POST /api/reports
  -> reports に queued レコード作成
  -> Service Bus に reportId を enqueue
  -> Worker が message を受信
  -> reports.status = generating_report
  -> input_json から CreateReportInput を復元
  -> 画像候補検索
  -> 画像評価または mock 画像所見生成
  -> 事故報本文生成 AI またはテンプレート生成
  -> reports.ai_draft_json に保存
  -> reports.status = waiting_human_review
  -> 画面で人間が確認・修正・確定
```

主な実装ファイルは次の通りです。

| 領域 | ファイル | 主な責務 |
| --- | --- | --- |
| 新規作成画面 | `app/page.tsx` | 入力フォーム送信、作成後の詳細画面遷移 |
| 作成 API | `app/api/reports/route.ts` | queued レコード作成、Service Bus enqueue |
| 永続化 | `lib/report-repository.ts` | `reports` テーブルの作成・取得・更新 |
| Queue | `lib/service-bus.ts` | report generation message を Service Bus に送信 |
| Worker 起動 | `worker/report-worker.ts` | Service Bus receiver の起動 |
| Worker handler | `worker/handlers.ts` | report message を処理してドラフト生成 |
| ドラフト生成本体 | `lib/mock-agent.ts` | 画像検索、画像評価、報告書本文生成を束ねる |
| 画像候補検索 | `lib/camera-search.ts`, `lib/frame-asset-repository.ts` | `frame_assets` から `Photo[]` を取得 |
| Blob URL / SAS | `lib/blob-storage.ts` | 表示用 Blob URL と AI 評価用 SAS URL を生成 |
| 画像評価 AI | `lib/image-evaluation-ai.ts` | Azure OpenAI Vision に画像を渡して評価 |
| 画像評価プロンプト | `lib/image-evaluation-prompt.ts` | 画像評価 AI の制約を定義 |
| 画像評価 schema | `lib/image-evaluation-schema.ts` | AI 応答 JSON の Zod / JSON Schema |
| 事故報 AI | `lib/accident-report-ai.ts` | 画像所見込みの事故報ドラフト本文を生成 |
| fallback テンプレート | `lib/report-template.ts` | AI 失敗時または無効時のテンプレート生成 |

## 1. ユーザー入力から queued レコード作成まで

### フロントエンド

`app/page.tsx` の `handleSubmit()` が新規事故報作成の入口です。

```ts
// app/page.tsx
const res = await fetch("/api/reports", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(buildCreateReportPayload(form)),
});
const { reportId } = await res.json();
router.push(`/reports/${reportId}`);
```

入力値は `app/_components/new-report-form-utils.ts` で必須チェックされます。

```ts
// app/_components/new-report-form-utils.ts
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

ここで作られる入力型は `lib/types.ts` の `CreateReportInput` です。

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

### API 側

`POST /api/reports` は `app/api/reports/route.ts` にあります。

```ts
// app/api/reports/route.ts
const site = await getCurrentSiteFromCookies();
if (!site) return Response.json({ error: "unauthorized" }, { status: 401 });

const body = (await request.json()) as CreateReportInput;
const scopedInput: CreateReportInput = { ...body, facilityId: site.facilityId };

const reportId = await createQueuedReport(scopedInput);
await enqueueReportGeneration(reportId);

return Response.json({ reportId, status: "queued" }, { status: 202 });
```

重要な点は、クライアントから渡された `facilityId` を信用せず、Cookie から取得したサイト情報で `facilityId` を上書きしていることです。サイト定義は `lib/demo-sites.ts` にあり、現状は `kanda-office` と `aeon-mall-kanda` が定義されています。

```ts
// lib/demo-sites.ts
export const DEMO_SITES: readonly DemoSite[] = [
  {
    siteKey: "kanda-office",
    facilityId: "kanda-office",
    locationKey: "kanda-office",
    name: "神田事務所サイト",
    mediaMode: "video_frames",
  },
  {
    siteKey: "aeon-mall-kanda",
    facilityId: "aeon-mall-kanda",
    locationKey: "aeon-mall-kanda",
    name: "イオンモール神田サイト",
    mediaMode: "sample_scenes",
  },
];
```

`createQueuedReport()` は `reports` テーブルに `queued` 状態のレコードを作ります。

```ts
// lib/report-repository.ts
export async function createQueuedReport(input: CreateReportInput): Promise<string> {
  const pool = await getDbPool();
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

この時点では `ai_draft_json` はまだありません。Worker が後続で埋めます。

## 2. Service Bus から Worker へ

`enqueueReportGeneration()` は `reportId` だけを Service Bus に送ります。

```ts
// lib/service-bus.ts
await sender.sendMessages({
  body: { reportId },
  contentType: "application/json",
  subject: "report.generate",
  messageId: reportId,
});
```

Worker 起動は `worker/report-worker.ts` です。

```ts
// worker/report-worker.ts
receivers.push(
  startReceiver(client, reportQueueName!, "[report]", handleReportMessage)
);
```

実際の report message 処理は `worker/handlers.ts` の `handleReportMessage()` です。

```ts
// worker/handlers.ts
export async function handleReportMessage(body: unknown, deps: WorkerDeps = defaultDeps): Promise<void> {
  const parsed = deps.parseReportMsg(body);
  if (!parsed) return;

  const { reportId } = parsed;
  try {
    await deps.updateStatus(reportId, "generating_report");
    const input = await deps.getInput(reportId);
    if (!input) throw new Error(`input not found: ${reportId}`);

    const draft = await deps.generateDraft(input);
    draft.id = reportId;
    draft.status = "waiting_human_review";

    await deps.saveDraft(reportId, draft);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    await deps.updateStatus(reportId, "failed", msg);
    throw err;
  }
}
```

ここでの状態遷移は次の通りです。

| タイミング | status |
| --- | --- |
| API が作成した直後 | `queued` |
| Worker が処理を開始 | `generating_report` |
| AI ドラフト保存完了 | `waiting_human_review` |
| 例外発生 | `failed` |

`saveAiDraft()` は DB の `status` を強制的に `waiting_human_review` に更新します。

```ts
// lib/report-repository.ts
update reports
set status = 'waiting_human_review',
    ai_draft_json = @aiDraftJson,
    updated_at = sysutcdatetime()
where id = @id
```

## 3. 画面上の進捗表示

作成後に遷移する `/reports/[id]` は、`report.status` が処理中なら `ProcessingScreen` を表示します。

```ts
// app/reports/[id]/page.tsx
if (isProcessingStatus(report.status)) {
  return <ProcessingScreen reportId={id} />;
}
```

`ProcessingScreen` は 1 秒ごとに `/api/reports/[id]/status` を polling します。

```ts
// app/reports/[id]/_components/ProcessingScreen.tsx
const res = await fetch(`/api/reports/${reportId}/status`);
const data = await res.json();
setStatus(data.status);
```

`GET /api/reports/[id]/status` は `queued` と `generating_report` を処理中として返します。

```ts
// app/api/reports/[id]/status/route.ts
const processingStatuses = ["queued", "generating_report"];
const isProcessing = processingStatuses.includes(row.status);
```

注意点として、進捗ステップそのものはバックエンドの実ステップを保存しているわけではありません。`lib/generation-steps.ts` の `deriveStepStates()` が `elapsedMs` によって疑似的に進めています。

```ts
// lib/generation-steps.ts
if (status === "generating_report") {
  const completed = Math.min(
    GENERATION_STEPS.length - 1,
    Math.floor(elapsedMs / STEP_PROGRESS_MS)
  );
  ...
}
```

つまり、ユーザーに見える「関連するカメラ画像を探しています」「画像から確認できる事実を整理しています」などのステップは、現状では UI 表示上の疑似ステップです。実処理の成功・失敗は `reports.status` と `error_message` で判断します。

## 4. ドラフト生成本体

Worker から呼ばれる本体は `lib/mock-agent.ts` の `generateReportDraft()` です。ファイル名は `mock-agent` ですが、現在は Blob / DB / Azure OpenAI Vision / 事故報 AI の実処理もここに集約されています。

```ts
// lib/mock-agent.ts
export async function generateReportDraft(input: CreateReportInput): Promise<Report> {
  const photoCandidates = await searchCameraFrames(input);
  const { photos, imageObservation, usedFallback } = await resolvePhotosAndObservation(
    input,
    photoCandidates
  );

  let content;
  if (process.env.AI_REPORT_GENERATION_ENABLED === "true") {
    try {
      content = await generateAccidentReportWithAI({
        input,
        photos,
        imageObservation,
        locationKey: input.facilityId,
      });
    } catch (err) {
      content = generateReportContent(input, photos, imageObservation);
    }
  } else {
    content = generateReportContent(input, photos, imageObservation);
  }

  ...
}
```

`generateReportDraft()` が大きく行うことは 4 つです。

1. `searchCameraFrames(input)` で画像候補を取得する。
2. `resolvePhotosAndObservation()` で画像評価 AI または mock 所見を作る。
3. `generateAccidentReportWithAI()` または `generateReportContent()` で事故報本文を作る。
4. `Report` オブジェクトとして組み立て、`originalAiOutput` に AI 初期出力を保存する。

`originalAiOutput` は後続の修正差分記録で使われます。

```ts
// lib/mock-agent.ts
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

画像取得は `lib/camera-search.ts` から始まります。

```ts
// lib/mock-agent.ts
const photoCandidates = await searchCameraFrames(input);
```

### 5.1 入力テキストから scenario tag を推定する

`searchCameraFrames()` はまず `detectScenarioTag()` で、事故概要と発生場所に含まれるキーワードから scenario tag を推定します。

```ts
// lib/camera-search.ts
const CEILING_KEYWORDS = ["天井", "天板", "ボード"];
const ESCALATOR_KEYWORDS = ["エスカレーター", "エスカレータ"];

function detectScenarioTag(input: CreateReportInput): string | null {
  const text = `${input.location} ${input.summary}`;
  if (CEILING_KEYWORDS.some((k) => text.includes(k))) return "ceiling";
  if (ESCALATOR_KEYWORDS.some((k) => text.includes(k))) return "escalator";
  return null;
}
```

現状の tag 推定は非常にシンプルで、認識できるのは主に以下です。

| 入力中のキーワード | 推定 tag |
| --- | --- |
| `天井`, `天板`, `ボード` | `ceiling` |
| `エスカレーター`, `エスカレータ` | `escalator` |
| 上記以外 | `null` |

たとえば神田事務所の転倒系フレームには `fall`, `person-fall`, `転倒` などの tag が seed されていますが、現状の `detectScenarioTag()` は `転倒` を tag に変換していません。その場合は tag 検索ではなく、施設全体のフレーム検索に fallback します。

### 5.2 facilityId がない場合は画像なし

`CreateReportInput.facilityId` は `POST /api/reports` で Cookie のサイト情報から付与されます。これがない場合、画像候補は空配列になります。

```ts
// lib/camera-search.ts
export async function searchCameraFrames(input: CreateReportInput): Promise<Photo[]> {
  if (!input.facilityId) return [];
  ...
}
```

### 5.3 tag が当たれば tag 検索、当たらなければ施設内検索

`searchCameraFrames()` の検索順序は次の通りです。

```ts
// lib/camera-search.ts
const tag = detectScenarioTag(input);
const tagged = tag ? await searchFrameAssets(tag, input.facilityId) : [];
if (tagged.length > 0) return tagged;
return searchFrameAssets(null, input.facilityId);
```

つまり、

1. tag が推定できる場合は、まず `facilityId + scenarioTag` で検索する。
2. tag 検索で 1 件以上見つかれば、それを採用する。
3. tag が推定できない、または tag 検索が 0 件なら、`facilityId` のみで検索する。

### 5.4 frame_assets から最大 8 件を取得する

DB 検索の本体は `lib/frame-asset-repository.ts` の `searchFrameAssets()` です。

```ts
// lib/frame-asset-repository.ts
export async function searchFrameAssets(
  scenarioTag: string | null,
  facilityId: string
): Promise<Photo[]> {
  const pool = await getDbPool();
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

重要な仕様は次の通りです。

| 項目 | 現状 |
| --- | --- |
| 検索対象 | `frame_assets` |
| 必須条件 | `facility_id = @facilityId` |
| tag 条件 | `scenario_tags like '%tag%'` |
| 最大件数 | `top 8` |
| 並び順 | `captured_at asc` |
| 発生日時による絞り込み | なし |
| camera location の距離・類似度検索 | なし |

現状は `occurredAt` に近い画像を選ぶ実装ではありません。施設と tag によって候補を絞り、古い順に最大 8 件を返します。

### 5.5 frame_assets の schema

`frame_assets` は `scripts/migrate.ts` で作成されます。

```sql
create table frame_assets (
  id                    nvarchar(80)  not null primary key,
  video_asset_id        nvarchar(80)  null,
  facility_id           nvarchar(80)  not null,
  camera_id             nvarchar(80)  not null,
  camera_name           nvarchar(200) not null,
  location_name         nvarchar(200) not null,
  floor_label           nvarchar(50)  null,
  captured_at           datetime2     not null,
  frame_offset_seconds  int           null,
  frame_index           int           null,
  blob_container        nvarchar(100) not null,
  blob_name             nvarchar(500) not null,
  scenario_tags         nvarchar(max) null,
  description           nvarchar(max) null,
  created_at            datetime2     not null default sysutcdatetime()
)
```

このテーブルの `blob_container` と `blob_name` が、後続の画像表示 URL と AI 評価用 SAS URL の元になります。

### 5.6 DB row から Photo へ変換する

DB から取った `FrameAssetRow` は `rowToPhoto()` で `Photo` に変換されます。

```ts
// lib/frame-asset-repository.ts
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

`Photo` 型は `lib/types.ts` に定義されています。

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

ここでのポイントは、`Photo` には 2 種類の URL 情報があることです。

| 情報 | 用途 |
| --- | --- |
| `imageUrl` | 画面表示用。`AZURE_STORAGE_BLOB_ENDPOINT/container/blobName` |
| `blobContainer` / `blobName` | AI 評価時に一時 SAS URL を作るための元情報 |

### 5.7 表示用 Blob URL

表示用の `imageUrl` は `getBlobUrl()` で組み立てます。

```ts
// lib/blob-storage.ts
export function getBlobUrl(container: string, blobName: string): string {
  const endpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT;
  if (!endpoint) throw new Error("AZURE_STORAGE_BLOB_ENDPOINT is not set");
  return `${endpoint.replace(/\/$/, "")}/${container}/${blobName}`;
}
```

これは SAS 付き URL ではありません。写真台帳画面やプレビュー画面では、この `imageUrl` がそのまま `<img src=...>` に使われます。

```tsx
// app/reports/[id]/page.tsx
<img
  src={photo.imageUrl}
  alt={photo.photoLocationName}
  className="absolute inset-0 w-full h-full object-cover"
/>
```

```tsx
// app/reports/[id]/preview/page.tsx
<img
  src={photo.imageUrl}
  alt={photo.photoLocationName}
  className="absolute inset-0 w-full h-full object-cover"
/>
```

そのため、現行の写真表示は `AZURE_STORAGE_BLOB_ENDPOINT` で組み立てた URL がブラウザから読めることを前提にしています。AI 評価用の SAS URL とは別です。

## 6. 画像評価ロジック

画像評価は `lib/mock-agent.ts` の `resolvePhotosAndObservation()` に集約されています。

```ts
// lib/mock-agent.ts
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

分岐は次の通りです。

| 条件 | 実行される処理 | `usedFallback` |
| --- | --- | --- |
| `AI_IMAGE_EVALUATION_ENABLED !== "true"` | `analyzeImagesMock(photoCandidates)` | `false` |
| 画像候補が 0 件 | `analyzeImagesMock([])` | `false` |
| AI 評価が成功 | `evaluateImagesWithAI()` | `false` |
| AI 評価が例外 | `analyzeImagesMock(photoCandidates)` | `true` |

`usedFallback` は「AI 評価を試したが失敗した」場合だけ `true` になります。AI 評価が無効な環境で mock を使った場合は `false` です。

### 6.1 AI 評価に渡す SAS URL

画像評価 AI には、表示用の `imageUrl` ではなく、一時的な読み取り SAS URL を渡します。

```ts
// lib/image-evaluation-ai.ts
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

SAS URL 生成は `lib/blob-storage.ts` です。

```ts
// lib/blob-storage.ts
export async function generateBlobReadSasUrl(
  container: string,
  blobName: string,
  expiresInMinutes = 15
): Promise<string> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(container);
  const blobClient = containerClient.getBlobClient(blobName);
  const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  return blobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse("r"),
    expiresOn,
  });
}
```

ここでは `AZURE_STORAGE_CONNECTION_STRING` が必要です。SAS は読み取り権限 `r` のみで、デフォルト有効期限は 15 分です。

`Photo` に `blobContainer` または `blobName` がない場合、`evaluateImagesWithAI()` は例外を投げます。その例外は `resolvePhotosAndObservation()` 側で捕捉され、mock 所見に fallback します。

### 6.2 Azure OpenAI Responses API への入力

画像評価 AI の本体は `evaluateImagesWithAI()` です。

```ts
// lib/image-evaluation-ai.ts
export async function evaluateImagesWithAI({
  input,
  photos,
}: EvaluateArgs): Promise<ImageEvaluationOutput> {
  if (photos.length === 0) {
    return { summary: "評価対象の画像はありません。", results: [] };
  }

  const client = getAzureOpenAIClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT_NAME is not set");
  ...
}
```

Azure OpenAI client は `lib/azure-openai.ts` で生成されます。

```ts
// lib/azure-openai.ts
return new OpenAI({
  apiKey,
  baseURL: `${endpoint.replace(/\/$/, "")}/openai/v1/`,
});
```

AI に渡すテキスト context は、事故入力と画像候補メタデータです。

```ts
// lib/image-evaluation-ai.ts
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

画像は、各画像ごとに `input_text` で `imageId` を明示し、その直後に `input_image` で SAS URL を渡します。

```ts
// lib/image-evaluation-ai.ts
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

最終的な `responses.create()` は次の形です。

```ts
// lib/image-evaluation-ai.ts
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

ログには画像件数、選択件数、deployment 名は出ますが、SAS URL やプロンプト全文は出していません。

```ts
console.log(
  `image evaluation start: imageCount=${photos.length}, deployment=${deployment}`
);

console.log(
  `image evaluation done: imageCount=${photos.length}, selectedCount=${selectedCount}`
);
```

### 6.3 画像評価プロンプトの制約

`lib/image-evaluation-prompt.ts` の `IMAGE_EVALUATION_SYSTEM_PROMPT` で、画像評価 AI には次の制約を与えています。

```ts
export const IMAGE_EVALUATION_SYSTEM_PROMPT = `
あなたは施設管理会社の事故報告書を支援する画像評価AIです。

役割:
- 画像に「写っている事実」を抽出し、事故報告書の写真台帳候補として評価する。

重要ルール:
- observedFacts には画像から客観的に観察できる事実だけを書く。
- 画像だけから原因・責任・時系列・人的被害の有無を断定しない。
- relevanceScore は 0.0〜1.0 の小数で、事故概要との関連度。
- shouldUseInLedger: 写真台帳に載せるべきかの最終判断。
- suggestedCaption: 写真台帳のキャプション案。
- riskNotes: 画像評価上の注意点。
- 出力は必ず指定された JSON Schema に従う。
- results は入力画像と同じ件数を返す。
- summary は全画像の総評を 2〜3 文で書く。
`.trim();
```

このプロンプトの目的は、画像 AI が「原因」「責任」「時系列」「人的被害」を断定しないようにすることです。事故報告書では、画像から見える客観的な事実だけを `observedFacts` に寄せ、推測や注意点は `riskNotes` に分離します。

### 6.4 画像評価の JSON Schema

AI 応答は `lib/image-evaluation-schema.ts` の schema で検証されます。

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

Responses API には JSON Schema として渡し、さらに戻り値を Zod で parse します。

```ts
// lib/image-evaluation-ai.ts
const raw = response.output_text;
if (!raw) throw new Error("Azure OpenAI response content is empty");

const parsed = imageEvaluationOutputSchema.parse(JSON.parse(raw));
```

つまり、AI が schema に合わない JSON を返した場合も例外になります。その例外は上位で捕捉され、画像評価は mock fallback になります。

### 6.5 評価結果を report 入力用テキストに変換する

画像評価結果は、そのまま事故報 AI に渡されるのではなく、`buildImageObservationText()` で文字列化されます。

```ts
// lib/image-evaluation-ai.ts
export function buildImageObservationText(evaluation: ImageEvaluationOutput): string {
  if (evaluation.results.length === 0) return evaluation.summary;

  const lines: string[] = [];
  lines.push(`総評: ${evaluation.summary}`);
  for (const result of evaluation.results) {
    lines.push("");
    lines.push(
      `- imageId: ${result.imageId} (relevance=${result.relevanceScore.toFixed(2)}, useInLedger=${result.shouldUseInLedger})`
    );
    if (result.observedFacts.length > 0) {
      lines.push(`  観察事実:`);
      for (const fact of result.observedFacts) lines.push(`    - ${fact}`);
    }
    if (result.suggestedCaption) {
      lines.push(`  キャプション案: ${result.suggestedCaption}`);
    }
    if (result.riskNotes.length > 0) {
      lines.push(`  注意:`);
      for (const note of result.riskNotes) lines.push(`    - ${note}`);
    }
  }
  return lines.join("\n");
}
```

この `imageObservation` が後続の事故報告書生成 AI に渡されます。

### 6.6 評価結果を写真台帳候補に反映する

`applyImageEvaluationToPhotos()` は、画像評価結果を `Photo[]` に反映します。

```ts
// lib/image-evaluation-ai.ts
export function applyImageEvaluationToPhotos(
  photos: Photo[],
  evaluation: ImageEvaluationOutput
): Photo[] {
  const resultsById = new Map(evaluation.results.map((r) => [r.imageId, r]));

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
  return usable;
}
```

反映内容は次の通りです。

| 評価結果 | `Photo` への反映 |
| --- | --- |
| `suggestedCaption` | `photo.caption` |
| `relevanceScore` | `photo.relevanceScore` |
| `observedFacts` | `photo.observedFacts` |
| `shouldUseInLedger = false` | 写真台帳候補から除外 |
| relevanceScore | 降順に並び替え |

現状の UI では、`caption`, `relevanceScore`, `observedFacts` は `Report.photos` には保存されますが、写真台帳画面や帳票プレビューには直接表示されていません。表示されているのは主に `photoLocationName`, `cameraName`, `capturedAt`, `imageUrl` です。

## 7. mock 画像所見 fallback

AI 画像評価が無効、画像が 0 件、または AI 評価で例外が出た場合は `lib/mock-vision.ts` の `analyzeImagesMock()` が使われます。

```ts
// lib/mock-vision.ts
export async function analyzeImagesMock(photos: Photo[]): Promise<string> {
  if (photos.length === 0) return NO_IMAGE_OBSERVATION;

  const firstUrl = photos[0].imageUrl;
  if (firstUrl.includes("ceiling")) return CEILING_OBSERVATION;
  if (firstUrl.includes("escalator")) return ESCALATOR_OBSERVATION;
  return NO_IMAGE_OBSERVATION;
}
```

mock は 1 枚目の `imageUrl` に `ceiling` または `escalator` が含まれるかで所見を返します。`scripts/seed-frames.ts` には、この mock 判定が動くように Blob path に `ceiling` / `escalator` を含めるコメントがあります。

```ts
// scripts/seed-frames.ts
// Blob パスに "ceiling" / "escalator" を含めることで mock-vision.ts のURL判定が継続動作する
```

mock 所見は簡易的な固定文です。

```ts
const CEILING_OBSERVATION = `廊下の床面に天井ボードと思われる建材が複数散乱している。
天井面の一部に破損または開口が確認できる。
周辺に人の転倒や接触を示す明確な様子は確認できない。`;
```

この fallback によって、Azure OpenAI Vision や Blob SAS 生成に失敗しても、事故報ドラフト生成フロー全体は止まりにくくなっています。

## 8. 事故報告書本文生成

画像評価または mock から得た `imageObservation` は、事故報本文生成に渡されます。

### 8.1 AI による事故報生成

`AI_REPORT_GENERATION_ENABLED === "true"` の場合、`generateAccidentReportWithAI()` を使います。

```ts
// lib/mock-agent.ts
content = await generateAccidentReportWithAI({
  input,
  photos,
  imageObservation,
  locationKey: input.facilityId,
});
```

事故報 AI に渡す payload は `lib/accident-report-ai.ts` で作られます。

```ts
// lib/accident-report-ai.ts
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

ここで渡しているのは、画像そのものではありません。画像 AI が作った `imageObservation` と、採用された `photos` のメタデータです。事故報本文生成 AI は Vision ではなくテキスト入力だけを見ます。

事故報 AI も JSON Schema の structured output で返します。

```ts
// lib/accident-report-ai.ts
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

事故報生成プロンプトは `lib/accident-report-prompt.ts` です。ここでも断定を避ける制約があります。

```ts
export const ACCIDENT_REPORT_SYSTEM_PROMPT = `
あなたは施設管理会社の事故報告書作成支援AIです。

重要ルール:
- 事実と推測を混同しない。
- 不明な情報は「確認中」「不明」「要確認」と書く。
- 原因を断定しない。「〜の可能性がある」「〜と推測される」という表現を用いる。
- お客さま・従業員・協力会社への影響を過度に断定しない。
- 人間が最終確認する前提で、読みやすく簡潔に書く。
- 出力は必ず指定されたJSON Schemaに従う。
`.trim();
```

また、`locationKey` がある場合は `location_prompt_overrides` の承認済み施設ナレッジを追加します。

```ts
// lib/accident-report-ai.ts
const override = await getActiveLocationPromptOverride(locationKey);
if (override) {
  systemPrompt = [
    ACCIDENT_REPORT_SYSTEM_PROMPT,
    [
      "",
      "# 施設固有の参考情報",
      "以下はこの施設に関する既知情報です。事故概要と関連する場合のみ参考にしてください。",
      "確定原因として断定しないでください。",
      "",
      override.overrideText,
    ].join("\n"),
  ].join("\n");
}
```

### 8.2 テンプレート fallback

事故報 AI が無効、または例外が出た場合は `lib/report-template.ts` の `generateReportContent()` を使います。

```ts
// lib/mock-agent.ts
content = generateReportContent(input, photos, imageObservation);
```

テンプレート側も入力テキストから事故種別を簡易判定します。

```ts
// lib/report-template.ts
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

天井・エスカレーターのテンプレートでは、画像がある場合に `imageObservation` の 1 行目を本文に差し込みます。

```ts
body: `${whenStr.replace("頃", "")}、${input.location}にて天井ボードの落下が確認された。${hasImages ? `取得画像では、${imageObservation.split("\n")[0].replace(/。$/, "")}。` : ""}...`
```

一方、generic template は現状 `imageObservation` を本文に使っていません。

## 9. 写真台帳と画面表示

AI 評価後の `photos` は `Report.photos` と `originalAiOutput.photos` に入ります。

```ts
// lib/mock-agent.ts
return {
  ...
  photos,
  originalAiOutput: aiOutput,
  ...
};
```

`/reports/[id]` の写真台帳タブでは、最大 8 枠に `report.photos` を表示します。

```tsx
// app/reports/[id]/page.tsx
const slots = Array.from({ length: 8 });
const photo = report.photos[i];
...
<img src={photo.imageUrl} alt={photo.photoLocationName} ... />
```

ユーザーが編集できるのは、現状では `photoLocationName` だけです。

```tsx
// app/reports/[id]/page.tsx
<input
  type="text"
  value={photo.photoLocationName}
  onChange={(e) => setPhotoName(photo.id, e.target.value)}
/>
```

保存時も `photos` については `id` と `photoLocationName` だけを PATCH しています。

```ts
// app/reports/[id]/page.tsx
photos: editedReport.photos.map((p) => ({ id: p.id, photoLocationName: p.photoLocationName })),
```

API 側は既存 `Photo` に patch を merge します。

```ts
// app/api/reports/[id]/route.ts
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

帳票プレビューも `report.photos` を使って画像、写真場所名称、カメラ名、撮影日時を表示します。

```tsx
// app/reports/[id]/preview/page.tsx
<span className="text-xs text-slate-600 truncate">{photo.photoLocationName}</span>
<img src={photo.imageUrl} alt={photo.photoLocationName} ... />
<div>{photo.cameraName}</div>
<div>{photo.capturedAt.slice(0, 16).replace("T", " ")}</div>
```

現状、画像評価 AI が作った `suggestedCaption` は `photo.caption` に保存されますが、プレビュー画面ではまだ使われていません。

## 10. 修正・確定とフィードバック保存

ユーザーがドラフトを修正して保存すると、`PATCH /api/reports/[id]` が呼ばれます。

```ts
// app/api/reports/[id]/route.ts
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
// app/api/reports/[id]/confirm/route.ts
const diffItems = diffJson(extractContent(aiDraft), extractContent(userDraft));
if (diffItems.length > 0) {
  await saveReportCorrection({ reportId: id, aiDraftJson, userDraftJson, diffItems });
}

await confirmReport(id);
```

`extractContent()` の対象は本文系フィールドです。写真台帳の `photos` はこの confirm 時の `report_corrections` 差分対象には入っていません。

```ts
const CONTENT_KEYS: (keyof Report)[] = [
  "title", "victim", "fiveWTwoH", "cause", "treatment", "preventiveAction", "body",
];
```

一方、通常保存時の `recordFeedbacks()` では、写真場所名称の変更も `feedbacks` に記録されます。

```ts
// lib/diff.ts
if (
  origPhoto &&
  updatedPhoto.photoLocationName !== undefined &&
  updatedPhoto.photoLocationName !== origPhoto.photoLocationName
) {
  results.push(
    makeFeedback(
      report.id,
      `写真場所名称（${updatedPhoto.id}）`,
      origPhoto.photoLocationName,
      updatedPhoto.photoLocationName
    )
  );
}
```

## 11. 環境変数

このフローに関係する主な環境変数は次の通りです。

| 環境変数 | 用途 |
| --- | --- |
| `DATABASE_URL` | Azure SQL 接続 |
| `SERVICE_BUS_CONNECTION_STRING` | Service Bus 接続 |
| `SERVICE_BUS_REPORT_QUEUE_NAME` | report generation queue 名 |
| `AZURE_STORAGE_CONNECTION_STRING` | SAS URL 生成、Blob upload |
| `AZURE_STORAGE_BLOB_ENDPOINT` | 表示用 `imageUrl` の base URL |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | 画像評価・事故報生成で使う deployment |
| `AI_IMAGE_EVALUATION_ENABLED` | `"true"` のとき画像評価 AI を使う |
| `AI_REPORT_GENERATION_ENABLED` | `"true"` のとき事故報本文生成 AI を使う |
| `NEXT_PUBLIC_BASE_URL` | preview page から report API を呼ぶ base URL |

## 12. 現状の制約と注意点

### 画像取得の制約

- `searchCameraFrames()` は `occurredAt` に近い画像を探していません。
- `frame_assets` 検索は `facility_id` と任意の `scenario_tags like` のみです。
- tag 推定は `ceiling` と `escalator` に偏っており、`転倒` や `照明` などの tag は現状自動推定されません。
- tag が当たらない場合は施設内の `captured_at asc top 8` になるため、事故と無関係な候補が混ざる可能性があります。

### 画像評価の制約

- `AI_IMAGE_EVALUATION_ENABLED` が `"true"` でない限り、Azure OpenAI Vision は呼ばれません。
- `Photo.blobContainer` / `Photo.blobName` がない画像は AI 評価できず、mock fallback になります。
- AI 評価結果の `suggestedCaption`, `relevanceScore`, `observedFacts` は `Report.photos` には保存されますが、現行 UI では直接表示されません。
- AI 評価は画像に写った事実抽出に限定する設計です。原因・責任・時系列・人的被害の断定はプロンプトで抑制しています。

### 進捗表示の制約

- UI の生成ステップは `elapsedMs` による疑似進捗で、Worker の実ステップイベントではありません。
- `agent_runs` テーブルは migration で作成されますが、現状の report generation フローでは詳細 step 保存に使われていません。

### fallback の考え方

- 画像評価 AI が失敗しても `analyzeImagesMock()` に戻るため、ドラフト生成全体は継続します。
- 事故報本文生成 AI が失敗しても `generateReportContent()` に戻るため、ドラフト生成全体は継続します。
- Worker 全体で捕捉できない例外が出た場合のみ、`reports.status` は `failed` になります。

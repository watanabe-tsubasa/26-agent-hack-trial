いいですね。Phase 3 は、実装の順番を間違えなければかなり安全に進められます。

まず結論として、Phase 3 は **Azure OpenAI を直接 Worker から呼ぶ構成** で始めるのがよさそうです。Foundry Agent Service まで入れると見栄えはありますが、今の構成では `report-agent-worker` の中の `mock-agent` を差し替える方が確実です。

```text id="hbx9nk"
report-agent-worker
  ↓
事故情報を取得
  ↓
frame_assets から写真候補を取得
  ↓
mock-vision で画像解析結果を作る
  ↓
Azure OpenAI structured outputs で事故報告書JSON生成
  ↓
Azure SQL reports.ai_draft_json に保存
  ↓
status = waiting_human_review
```

Azure OpenAI / Foundry の Structured outputs は、推論API呼び出し時に渡した JSON Schema に従ってモデル出力を生成させる機能です。従来の JSON mode は「有効なJSON」を保証するだけでしたが、Structured outputs は指定スキーマへの準拠を狙えるので、今回のようなフロント連携にはかなり合います。([Microsoft Learn][1])

## Phase 3 のゴール

Phase 3 の完了条件はこれでいいと思います。

```text id="clpkhf"
- 既存の Report 型 / UI 表示に合わせた JSON Schema を固定する
- Azure OpenAI 呼び出し用の lib/azure-openai.ts を作る
- mock-agent.ts の report body 生成だけを AI に差し替える
- AI出力を zod などで再検証する
- 失敗時は mock report generation に fallback する
- フロントは壊さず、既存の human correction flow を維持する
```

大事なのは、**いきなり全部AI化しない**ことです。

Phase 3ではまず、

```text id="rm77sa"
画像探索: 既存の searchCameraFrames
画像解析: 既存の analyzeImagesMock
報告書JSON生成: Azure OpenAI
```

で十分です。

画像解析までAzure OpenAI Visionにすると、入力画像・SAS・モデル対応・画像サイズなどの沼が一気に来ます。そこはPhase 3.5かPhase 4でOKです。

## 実装方針

おすすめのファイル構成はこれです。

```text id="v7bxsl"
lib/
  ai/
    accident-report-schema.ts
    accident-report-prompt.ts
    azure-openai-client.ts
    generate-accident-report.ts
```

または既存構成に合わせて軽くするなら、

```text id="7xerzc"
lib/azure-openai.ts
lib/accident-report-ai.ts
lib/accident-report-schema.ts
```

## 1. まず固定するべきもの

最初に固定するのは **AIに返させるJSON** です。

ここは既存の `Report` / `AccidentReportBody` / `Photo` 型に合わせるのが最重要です。たとえば既存UIが `Report` を見ているなら、AIに返させるのは `Report` 全体ではなく、**報告書本文部分だけ** にするのが安全です。

```text id="dy7lpo"
AIに生成させる:
  reportContent / body 部分

アプリ側で付与する:
  id
  status
  createdAt
  updatedAt
  photos
  processingSteps
```

AIに `id` や `status` まで生成させると事故ります。そこはアプリの責務です。

## 2. JSON Schema のイメージ

実際の型名は既存コードに合わせる必要がありますが、考え方はこうです。

```ts id="9on7wf"
export const accidentReportContentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    accidentType: { type: "string" },
    occurredAt: { type: "string" },
    location: { type: "string" },
    summary: { type: "string" },
    cause: { type: "string" },
    initialResponse: { type: "string" },
    recurrencePrevention: { type: "string" },
    customerImpact: { type: "string" },
    damageStatus: { type: "string" },
    injuryStatus: { type: "string" },
    reportNotes: { type: "string" },
  },
  required: [
    "title",
    "accidentType",
    "occurredAt",
    "location",
    "summary",
    "cause",
    "initialResponse",
    "recurrencePrevention",
    "customerImpact",
    "damageStatus",
    "injuryStatus",
    "reportNotes",
  ],
} as const;
```

Structured outputs では、オブジェクトに `additionalProperties: false` を設定する必要があります。また、スキーマのネストは最大5階層、オブジェクトプロパティ数は最大100個という制限があります。([Microsoft Learn][2])

なので、報告書JSONは深くしすぎない方がいいです。

## 3. Azure OpenAI 呼び出し

Node / TypeScript なら、まずは OpenAI SDK 経由で Azure OpenAI endpoint を呼ぶ構成が扱いやすいです。Microsoft のTypeScript向けAzure OpenAIドキュメントでも、`openai` と `@azure/openai` の利用が案内されています。([Microsoft Learn][3])

環境変数はこのくらいです。

```env id="bahupm"
AZURE_OPENAI_ENDPOINT="https://<your-resource>.openai.azure.com"
AZURE_OPENAI_API_KEY="..."
AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o-mini"
AZURE_OPENAI_API_VERSION="2024-10-21"
```

`DEPLOYMENT_NAME` はモデル名ではなく、Azure上で作った **deployment name** です。ここ混ざりがちです。

## 4. 実装イメージ

たとえば `lib/azure-openai.ts`。

```ts id="mw7775"
import OpenAI from "openai";

export function getAzureOpenAIClient() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";

  if (!endpoint) throw new Error("AZURE_OPENAI_ENDPOINT is not set");
  if (!apiKey) throw new Error("AZURE_OPENAI_API_KEY is not set");

  return new OpenAI({
    apiKey,
    baseURL: `${endpoint.replace(/\/$/, "")}/openai/deployments`,
    defaultQuery: { "api-version": apiVersion },
    defaultHeaders: { "api-key": apiKey },
  });
}
```

生成関数はこんな感じです。

```ts id="quf9dy"
import { getAzureOpenAIClient } from "./azure-openai";
import { accidentReportContentJsonSchema } from "./accident-report-schema";
import type { CreateReportInput, Photo } from "./types";

type GenerateAccidentReportArgs = {
  input: CreateReportInput;
  photos: Photo[];
  imageObservation: string;
};

export async function generateAccidentReportWithAI({
  input,
  photos,
  imageObservation,
}: GenerateAccidentReportArgs) {
  const client = getAzureOpenAIClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

  if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT_NAME is not set");

  const response = await client.chat.completions.create({
    model: deployment,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "あなたは施設管理会社の事故報告書作成支援AIです。",
          "出力は必ず指定されたJSON Schemaに従ってください。",
          "不明な事実は断定せず、「確認中」「不明」「要確認」と記載してください。",
          "原因欄では推測を断定しないでください。",
          "人間の確認・修正を前提としたドラフトを作成してください。",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            accidentInput: input,
            imageObservation,
            photoCandidates: photos.map((p) => ({
              id: p.id,
              caption: p.caption,
              url: p.url,
            })),
          },
          null,
          2,
        ),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "accident_report_content",
        strict: true,
        schema: accidentReportContentJsonSchema,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Azure OpenAI response content is empty");

  return JSON.parse(content);
}
```

## 5. 失敗時 fallback は必須

ハッカソンでは、Azure OpenAI 呼び出しが落ちてもデモが死なないようにしましょう。

```ts id="1fio6h"
let content;

try {
  content = await generateAccidentReportWithAI({
    input,
    photos,
    imageObservation,
  });
} catch (err) {
  console.error("AI report generation failed. Falling back to mock.", err);
  content = generateReportContent(input, photos, imageObservation);
}
```

これ、地味ですが超重要です。AIまわりはキー、デプロイ名、リージョン、レート制限、スキーマ不一致で普通に転びます。デモを守るエアバッグです。

## 6. zod で二重チェック

Structured outputs を使っても、アプリ側では必ず検証した方がいいです。

```bash id="s5o77j"
pnpm add zod openai
```

```ts id="d2twto"
import { z } from "zod";

export const accidentReportContentSchema = z.object({
  title: z.string(),
  accidentType: z.string(),
  occurredAt: z.string(),
  location: z.string(),
  summary: z.string(),
  cause: z.string(),
  initialResponse: z.string(),
  recurrencePrevention: z.string(),
  customerImpact: z.string(),
  damageStatus: z.string(),
  injuryStatus: z.string(),
  reportNotes: z.string(),
});

export type AccidentReportContent = z.infer<typeof accidentReportContentSchema>;
```

AIレスポンス後に：

```ts id="2mah5x"
const parsed = JSON.parse(content);
return accidentReportContentSchema.parse(parsed);
```

これでフロント破壊をかなり防げます。

## 7. 現行 `mock-agent.ts` の差し替えイメージ

今の流れがこうなら、

```ts id="4o72s0"
const photos = await searchCameraFrames(input);
const imageObservation = await analyzeImagesMock(photos);
const content = generateReportContent(input, photos, imageObservation);
```

Phase 3ではこうです。

```ts id="a7t53w"
const photos = await searchCameraFrames(input);
const imageObservation = await analyzeImagesMock(photos);

let content;

if (process.env.AI_REPORT_GENERATION_ENABLED === "true") {
  try {
    content = await generateAccidentReportWithAI({
      input,
      photos,
      imageObservation,
    });
  } catch (err) {
    console.error("AI report generation failed:", err);
    content = generateReportContent(input, photos, imageObservation);
  }
} else {
  content = generateReportContent(input, photos, imageObservation);
}
```

環境変数で切り替えられるようにするのがいいです。

```env id="lqyxue"
AI_REPORT_GENERATION_ENABLED="true"
```

これで、もしAzure側で不安定になっても、すぐモックに戻せます。

## 8. prompt は最初から別ファイル化

`lib/accident-report-prompt.ts` に分けておくと、Phase 5 のプロンプト改善につながります。

```ts id="tawxsg"
export const ACCIDENT_REPORT_SYSTEM_PROMPT = `
あなたは施設管理会社の事故報告書作成支援AIです。

目的:
- 事故概要、画像解析結果、写真台帳候補から、業務担当者が確認・修正しやすい事故報告書ドラフトを作成する。

重要ルール:
- 事実と推測を混同しない。
- 不明な情報は「確認中」「不明」「要確認」と書く。
- 原因を断定しない。
- お客様・従業員・協力会社への影響を過度に断定しない。
- 人間が最終確認する前提で、読みやすく簡潔に書く。
- 出力は必ず指定されたJSON Schemaに従う。
`;
```

## 9. Azure側で必要な設定

Azure OpenAI / Foundry Models のリソースを作ったら、Container Apps に env を入れます。

```bash id="q6d2yc"
az containerapp secret set \
  --name "$WORKER_CONTAINER_APP_NAME" \
  --resource-group "$APP_RESOURCE_GROUP" \
  --secrets azure-openai-api-key="$AZURE_OPENAI_API_KEY"

az containerapp update \
  --name "$WORKER_CONTAINER_APP_NAME" \
  --resource-group "$APP_RESOURCE_GROUP" \
  --set-env-vars \
    AI_REPORT_GENERATION_ENABLED=true \
    AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
    AZURE_OPENAI_API_KEY=secretref:azure-openai-api-key \
    AZURE_OPENAI_DEPLOYMENT_NAME="$AZURE_OPENAI_DEPLOYMENT_NAME" \
    AZURE_OPENAI_API_VERSION="2024-10-21"
```

`az containerapp update` が例の API version 問題で詰まるなら、先にAzure Portalから環境変数を入れてもいいです。ここでCLI沼に落ちるのはもったいないです。

## 10. Phase 3 の作業順

おすすめ順はこれです。

```text id="9p0w13"
1. 既存の Report / content 型を確認
2. AIに生成させる範囲を決める
3. zod schema を作る
4. JSON Schema を作る
5. generateReportContent の代替として generateAccidentReportWithAI を作る
6. AI_REPORT_GENERATION_ENABLED で切り替え
7. ローカルWorkerで動作確認
8. Azure OpenAI env を Worker に入れる
9. Azure本番Workerで確認
10. 失敗時fallbackを確認
```

## ここは注意

AIに返させるJSONは、**今のフロントが読む形に合わせる** のが絶対です。

なので次に見るべきコードはこのあたりです。

```text id="e9fugp"
lib/types.ts
lib/report-template.ts
lib/mock-agent.ts
components/*Report*
app/reports/[id]/*
```

特に `Report` の `content` や `photos` の型がどうなっているかで、スキーマが決まります。

## Phase 3の一言方針

```text id="ui1e9i"
AIは文章を作る。
アプリは構造を守る。
```

この切り分けができていれば、フロントは壊れにくいです。
まずは **画像解析はmockのまま、事故報告書本文だけAzure OpenAI structured outputsに差し替える** のが一番安全です。

[1]: https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs?utm_source=chatgpt.com "How to use structured outputs with Azure OpenAI in ..."
[2]: https://learn.microsoft.com/ja-jp/azure/ai-foundry/openai/how-to/structured-outputs?pivots=programming-language-csharp&tabs=python%2Cdotnet-entra-id&view=foundry-classic&utm_source=chatgpt.com "Microsoft Foundry モデルで Azure OpenAI で構造化出力を ..."
[3]: https://learn.microsoft.com/ja-jp/javascript/api/overview/azure/openai-readme?view=azure-node-latest&utm_source=chatgpt.com "TypeScript 用 Azure OpenAI ライブラリ - 2.0.0 | Microsoft Learn"

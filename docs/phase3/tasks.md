# Phase 3 タスク管理 — Azure OpenAI Structured Outputs による報告書生成

> 方針: 画像探索・画像解析はモックのまま。事故報告書本文の生成だけ Azure OpenAI Structured Outputs に差し替える。  
> `AI_REPORT_GENERATION_ENABLED` 環境変数で切り替え可能にし、AI失敗時はモックにフォールバック。  
> フロント（UI）・既存 human correction flow は変更しない。

---

## 1. パッケージ追加

- [x] `pnpm add openai`

---

## 2. Azure OpenAI クライアント

- [x] `lib/azure-openai.ts` — Azure OpenAI endpoint 向け `OpenAI` クライアントファクトリ
  - 環境変数: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION`
  - baseURL を `/openai/deployments` 形式に構築
  - `defaultQuery` に `api-version` を付与

---

## 3. システムプロンプト

- [x] `lib/accident-report-prompt.ts` — `ACCIDENT_REPORT_SYSTEM_PROMPT`
  - 事実・推測の混同禁止ルール
  - 不明情報は「確認中」「要確認」と記載するルール
  - victim フィールドの記載ルール（hasVictim=false → category=「なし」, gender/age=null）

---

## 4. Zod スキーマ + JSON Schema

- [x] `lib/accident-report-schema.ts`
  - `generatedContentSchema` — Zod で AI レスポンスを検証
  - `generatedContentJsonSchema` — Structured Outputs 用 JSON Schema（`additionalProperties: false`, 全フィールド `required`）
  - 対象フィールド: title, victim（7項目）, fiveWTwoH（7項目）, cause, treatment, preventiveAction, body

```
AI が生成する:
  title / victim / fiveWTwoH / cause / treatment / preventiveAction / body

アプリが付与する:
  id / status / createdAt / updatedAt / photos / originalAiOutput / feedbacks
```

---

## 5. AI 生成関数

- [x] `lib/accident-report-ai.ts` — `generateAccidentReportWithAI`
  - 引数: `{ input: CreateReportInput, photos: Photo[], imageObservation: string }`
  - `response_format: { type: "json_schema", json_schema: { strict: true, schema: ... } }` で構造化出力
  - レスポンスを `generatedContentSchema.parse()` で再検証
  - 戻り値は `GeneratedContent`（report-template.ts の戻り値型と同一）

---

## 6. mock-agent.ts への組み込み

- [x] `lib/mock-agent.ts` 更新
  - `AI_REPORT_GENERATION_ENABLED === "true"` の場合、`generateAccidentReportWithAI` を呼ぶ
  - 失敗時は `generateReportContent`（既存モック）にフォールバック
  - 戻り値の `Report` 型・構造は変更なし → フロント壊れない

```
画像探索:   searchCameraFrames（Phase 2 実装、変更なし）
画像解析:   analyzeImagesMock（Phase 3.5 で差し替え予定）
報告書生成: generateAccidentReportWithAI（NEW）→ fallback: generateReportContent
```

---

## 7. 動作確認（ユーザー対応）

- [ ] `.env.local` に Azure OpenAI 環境変数を追加

```env
AZURE_OPENAI_ENDPOINT="https://<your-resource>.openai.azure.com"
AZURE_OPENAI_API_KEY="..."
AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o-mini"   # Azure上で作ったデプロイ名
AZURE_OPENAI_API_VERSION="2024-10-21"
AI_REPORT_GENERATION_ENABLED="true"
```

- [ ] `pnpm worker:report` を再起動（`AI_REPORT_GENERATION_ENABLED=true` で起動）
- [ ] フォームから事故内容を送信 → Worker ログで `AI report generation` の呼び出しを確認
- [ ] フロント上でAI生成の報告書内容が表示されることを確認
- [ ] Azure OpenAI キーを意図的に間違え、フォールバックが動くことを確認
- [ ] `AI_REPORT_GENERATION_ENABLED` を `"false"` にしてモック動作に戻ることを確認

---

## 8. Container Apps デプロイ（ユーザー対応）

- [ ] Worker Container App にシークレット + 環境変数を追加

```bash
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

> `az containerapp update` が API version 問題で詰まる場合は Azure Portal から環境変数を手動追加してもよい。

- [ ] Worker イメージを再ビルド・プッシュ（`openai` パッケージ追加分）
  - Phase 2 の `@azure/storage-blob` 追加分もここで一緒にビルド
- [ ] 本番Workerで AI 生成が動くことを確認

---

## 将来フェーズとの接続

| Phase | 変更内容 | 触るファイル |
|---|---|---|
| Phase 3.5 | Azure OpenAI Vision で画像解析 | `lib/mock-vision.ts` を差し替え → `accident-report-ai.ts` に画像URL渡し |
| Phase 5 | 動画→フレーム自動抽出 Worker 追加 | `worker/video-frame-extractor.ts` NEW、`frame_assets` は変更なし |

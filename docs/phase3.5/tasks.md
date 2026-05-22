# Phase 3.5 タスク管理 — 画像評価エージェント

> 目的: `analyzeImagesMock` を Azure OpenAI Vision 対応の画像評価エージェントに置き換え、
> 写真台帳に使うべき画像・観察事実・キャプション案を AI が生成できるようにする。
>
> 重要方針:
> - 画像評価AIは画像に写っている観察事実だけを抽出する（原因・責任・時系列を断定しない）
> - 事故概要との関連度を relevanceScore で評価する
> - Structured Outputs (JSON Schema strict) + Zod validation を使う
> - 失敗時は既存の `analyzeImagesMock` に fallback して報告書生成フローを止めない
> - 新しい Azure サービスは作らない（既存の OpenAI / Storage を使う）
> - 画像は **SAS URL** で OpenAI に渡す（Photo.imageUrl は public URL のまま）

---

## 1. 画像評価 schema 定義

- [x] `lib/image-evaluation-schema.ts`
  - Zod schema: `imageEvaluationOutputSchema`
  - JSON Schema (strict): `imageEvaluationOutputJsonSchema`
  - 型:
    ```ts
    type ImageEvaluationResult = {
      imageId: string;
      relevanceScore: number;       // 0-1
      shouldUseInLedger: boolean;
      observedFacts: string[];
      suggestedCaption: string;
      riskNotes: string[];
    };
    type ImageEvaluationOutput = {
      summary: string;
      results: ImageEvaluationResult[];
    };
    ```

---

## 2. 画像評価プロンプト

- [x] `lib/image-evaluation-prompt.ts` — `IMAGE_EVALUATION_SYSTEM_PROMPT`
  - 観察事実のみを書く（原因・責任は書かない）
  - 事故概要との関連度を 0-1 の relevanceScore で返す
  - shouldUseInLedger は 写真台帳に使うべきかを true/false で返す
  - suggestedCaption は写真台帳のキャプション案
  - 発生日時と撮影日時のズレ・画質などの注意点は riskNotes に書く

---

## 3. SAS URL 生成

- [x] `lib/blob-storage.ts` に `generateBlobReadSasUrl(container, blobName, expiresInMinutes?)` を追加
  - `BlobClient.generateSasUrl({permissions: r, expiresOn})` を使用
  - 読み取り専用 / 短期間（デフォルト 15 分）
  - 接続文字列の SharedKey を使うため、本番では Worker 側でも実行可能

---

## 4. 画像評価AI 実装

- [x] `lib/image-evaluation-ai.ts` — `evaluateImagesWithAI({input, photos})`
  - 各 Photo から `blobContainer`/`blobName` を解決して SAS URL を発行
  - Azure OpenAI Responses API に
    - `input[0].content` に user text（事故概要 / 発生日時 / 発生場所）
    - `input[1].content` に `type:"input_image"` を画像枚数分
  - `text.format` で JSON Schema を指定して Structured Output を強制
  - 失敗時は `throw` してフロー側で fallback させる

- [x] Photo の SAS URL 発行に必要な情報がアプリ Photo 型にないため、
  `Photo` 型に `blobContainer?: string` / `blobName?: string` を追加（または評価関数で frame_assets を再取得）
  - **採用**: `Photo` 型にオプショナルで `blobContainer` / `blobName` を追加し、
    `searchFrameAssets` が値を埋めるようにする（再取得を避ける）

---

## 5. 事故報告書生成フローへの組み込み

- [x] `lib/mock-agent.ts`
  - `AI_IMAGE_EVALUATION_ENABLED === "true"` のとき `evaluateImagesWithAI` を呼ぶ
  - 結果から `imageObservation` テキストを生成
  - 結果から `Photo.caption` 相当（`suggestedCaption`）を反映するために
    Photo 型に `caption?: string` フィールドを追加
  - `shouldUseInLedger=false` の画像は写真台帳候補から除外、または relevanceScore 順に並べる
  - 失敗時は `analyzeImagesMock` に fallback
  - フラグ無効時は従来通り `analyzeImagesMock` を呼ぶ

- [x] `buildImageObservationText(evaluation)` ヘルパーで
  observedFacts / suggestedCaption / riskNotes を結合した報告書AI入力用テキストを生成

---

## 6. ログ・観測性

- [x] worker / API 経路から見える形で
  - `image evaluation start`
  - `image count` / `selected image count`
  - `fallback used` の有無
  をログ出力する
- [x] 画像URL本体・プロンプト全文・SAS トークン・secret はログに出さない

---

## 7. 型・ビルド確認

- [x] `npx tsc --noEmit`
- [ ] dev サーバー起動 → 新規報告書作成 → 写真台帳キャプションが AI 生成された内容になることを確認

---

## 8. デプロイ・本番動作確認（ユーザー対応）

- [ ] `.env.local` / 本番 Container Apps env に下記を反映
  - `AI_IMAGE_EVALUATION_ENABLED=true`
- [ ] `git push origin main` で Container Apps にデプロイ
- [ ] 本番 worker ログで
  - SAS URL が発行されていること
  - relevanceScore / shouldUseInLedger が出力されていること
  - 失敗時に fallback が動くこと
  を確認

---

## 設計メモ

### Photo 型の拡張
Photo 型は API レスポンス・DB シリアライズで広く使われているため、
`blobContainer`/`blobName`/`caption` は **optional** で追加する。
既存の Photo を生成しているコード（mock 系）は影響なし。

### imageObservation の互換性
既存の `generateAccidentReportWithAI` は `imageObservation: string` を受け取るので、
画像評価結果を **文字列に整形** してから渡す。schema 側の変更は不要。

### Fallback の責務
- evaluateImagesWithAI 内では throw する
- fallback の判断は `mock-agent.ts` が行う（既存の `generateAccidentReportWithAI` 失敗時 fallback と同じパターン）

### SAS URL の有効期限
画像評価1回のみ使用するので 15 分で十分。
本番 worker でもジョブ実行中に切れない長さに収める。

# Phase 5 タスク管理 — 店舗・施設別プロンプト補正ルール生成

> 方針: `report_corrections.diff_json` を店舗・施設単位で集計し、AIが補正ルール案（draft）を生成。  
> 人間が承認した override だけを事故報告書生成時に追記する。  
> `ACCIDENT_REPORT_SYSTEM_PROMPT` 自体は固定のまま変更しない。

---

## 1. 型定義更新

- [x] `lib/types.ts` — `CreateReportInput` に `facilityId?: string` 追加
  - フォームから送信時に store-001 などを識別するキーとして使用

---

## 2. DBマイグレーション

- [x] `scripts/migrate.ts` — 2 テーブル追加

```sql
-- 店舗・施設別補正ルール管理
location_prompt_overrides (
  id, location_key, title, override_text, source, status,
  analysis_json, created_at, approved_at
)
-- source: manual / ai_proposed
-- status: draft / active / archived

-- 補正ルール生成 Job 実行履歴
prompt_improvement_runs (
  id, location_key, status, input_correction_count,
  summary_json, proposed_override_id, created_at, completed_at, error_message
)
```

- [x] `bun scripts/migrate.ts` を実行（本番 Azure SQL に反映済み）

---

## 3. location_prompt_overrides リポジトリ

- [x] `lib/location-prompt-override-repository.ts`
  - `getActiveLocationPromptOverride(locationKey)` — active な override を取得
  - `createDraftLocationPromptOverride({locationKey, title, overrideText, source, analysisJson})` — draft 保存
  - `approveLocationPromptOverride(id)` — 同 location_key の既存 active を archived に、対象を active 化
  - `listLocationPromptOverrides(locationKey?)` — 一覧取得

---

## 4. prompt_improvement_runs リポジトリ

- [x] `lib/prompt-improvement-run-repository.ts`
  - `createPromptImprovementRun({locationKey})` — 実行開始レコード
  - `completePromptImprovementRun({id, inputCorrectionCount, summaryJson, proposedOverrideId})`
  - `failPromptImprovementRun({id, errorMessage})`

---

## 5. AI 生成スキーマ・プロンプト

- [x] `lib/location-prompt-override-schema.ts`
  - Zod schema: `locationPromptOverrideProposalSchema`
  - JSON Schema (strict): `locationPromptOverrideProposalJsonSchema`
  - 型: `LocationPromptOverrideProposal { title, summary, observedCorrectionPatterns[], overrideText, riskNotes[] }`

- [x] `lib/location-prompt-override-prompt.ts` — `PROMPT_IMPROVEMENT_SYSTEM_PROMPT`
  - 共通ルールを上書きしない指示
  - 施設固有の表現傾向・重点箇所だけを補正ルールに含める指示

---

## 6. 補正ルール生成関数

- [x] `lib/generate-location-prompt-override.ts`
  - `buildCorrectionSummary(locationKey, diffSets)` — diff を集計して AI 入力 JSON を構築
    - frequentFields: 修正頻度上位5フィールド
    - examples: 最大10件の修正例（before/after）
  - `generateLocationPromptOverride(summary)` — Azure OpenAI Responses API で補正ルール案生成

---

## 7. 事故報告書生成への組み込み

- [x] `app/page.tsx` — `DEFAULT_FORM` に `facilityId: "store-001"` を追加
- [x] `lib/accident-report-ai.ts` — `GenerateArgs` に `locationKey?: string` を追加
  - active override があれば `ACCIDENT_REPORT_SYSTEM_PROMPT + 補正ルール` を結合
  - override 取得失敗時は共通プロンプトのみで fallback
- [x] `lib/mock-agent.ts` — `input.facilityId` を `locationKey` として渡す

```
事故報告書生成フロー（Phase 5以降）:
  ACCIDENT_REPORT_SYSTEM_PROMPT（固定）
  + active override があれば追記
  + 事故概要・画像解析・写真候補
  ↓
  事故報告書 JSON 生成
```

---

## 8. API ルート

- [x] `POST /api/admin/run-prompt-improvement` — 補正ルール生成 Job 手動実行
  - body: `{ locationKey: string }`
  - report_corrections を集計 → AI 生成 → draft 保存 → 実行履歴保存
  - corrections が 0 件の場合は 422 を返す

- [x] `GET /api/location-prompt-overrides?locationKey=xxx` — 補正ルール一覧
- [x] `POST /api/location-prompt-overrides/:id/approve` — draft を active 化

---

## 9. 動作確認（ユーザー対応）

- [ ] いくつかの報告書を `facilityId: "store-001"` で作成・修正・確定して `report_corrections` を蓄積
- [ ] `POST /api/admin/run-prompt-improvement` に `{ "locationKey": "store-001" }` を送信
- [ ] レスポンスで `proposal.overrideText` の内容を確認
- [ ] `GET /api/location-prompt-overrides?locationKey=store-001` で draft が1件入っていることを確認
- [ ] `POST /api/location-prompt-overrides/:id/approve` で承認
- [ ] 新規報告書を作成 → Worker ログで "店舗・施設別の補正ルール" が instructions に追記されていることを確認
- [ ] 2回目の approve で古い active が archived になることを確認

---

## 10. Container Apps デプロイ（ユーザー対応）

- [ ] `git push origin main` でデプロイ（CI/CD 自動実行）
- [ ] 本番 Worker が facilityId を受け取り、active override を読み込んで生成することを確認

---

## 将来フェーズとの接続

| 改善案 | 内容 |
|---|---|
| report_corrections に location_key カラム追加 | JOIN なしで集計できるようにする |
| correction_reason UI 追加 | 修正理由を人間が入力できるようにする |
| 定期実行 cron | 蓄積件数が一定を超えたら自動生成 Job を起動 |
| 管理画面 | override の一覧・承認・アーカイブをUIから操作（Phase 5.5 で実装済み） |

---

## 将来案: 週1自動 draft 生成

現状は管理画面の「改善案を生成」ボタンで手動実行のみだが、将来的には週1回など
定期的に施設ごとの report_corrections を集計して draft を自動生成する想定。

- active 化は人間承認後のみ（自動 active 化はしない）
- 候補となる実行基盤:
  - Azure Container Apps Jobs (cron)
  - Azure Functions Timer Trigger
  - GitHub Actions schedule
- 通知（Slack 等）に draft 作成完了を流すことで、管理者がレビューに気づける運用にする

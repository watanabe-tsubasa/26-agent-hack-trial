# Phase 6.7 タスク管理 — Cosmos DB エージェントイベントログ

> 方針: SQL の正本データや既存フローを置き換えず、**Worker の各ステップで Cosmos DB に
> `appendAgentEvent` する** 横付け実装。失敗しても本線処理は止めない。
> UI は events が取れたら表示、なければ既存の疑似ステップ表示でフォールバック。
>
> 依存: Phase 6.4（生成画面 UI）、Phase 5 の非同期 Worker。
> Azure 側変更: **必要**（Cosmos DB アカウント / DB / コンテナの作成 → ユーザー対応）。

---

## 1. Azure 側準備（ユーザー対応）

- [x] Cosmos DB アカウント作成（NoSQL / Serverless 推奨）
- [x] データベース作成: `agent-hack-trial`
- [x] コンテナ作成: `agent_events`
  - パーティションキー: `/entityId` （report / prompt_improvement_run の両方を 1 コンテナで扱うため）
- [x] Container Apps の環境変数追加（Worker / Web 両方）:
  - `COSMOS_ENDPOINT`
  - `COSMOS_KEY`
  - `COSMOS_DATABASE`
  - `COSMOS_CONTAINER`

---

## 1.5. entityType / entityId 対応（パーティション統一）

- [x] `lib/agent-event-log.ts`
  - `AgentEvent` に `entityType: "report" | "prompt_improvement_run"` と `entityId: string` を追加
  - `entityType === "report"` → `entityId = reportId`
  - `entityType === "prompt_improvement_run"` → `entityId = runId`
  - `reportId` / `runId` は検索・表示用に保持
  - クエリは `WHERE c.entityId = @id` + `partitionKey: entityId` で発行
  - doc 構築を `buildAgentEventDoc()` 純粋関数に抽出（テスト容易性）
- [x] `worker/handlers.ts`
  - 事故報イベントは `entityType: "report"` を付与
  - 施設ナレッジイベントは `entityType: "prompt_improvement_run"` を付与
- [x] `lib/__tests__/agent-event-log.test.ts`
  - report event → `entityId === reportId`
  - prompt_improvement event → `entityId === runId`
  - 該当 id 欠落時 null
  - Cosmos 未設定で `appendAgentEvent` / `list*` が no-op

---

## 2. 依存追加

- [x] `pnpm add @azure/cosmos` → `^4.9.3`

---

## 3. Cosmos クライアント

- [x] `lib/cosmos.ts`（新規）
  - 環境変数が揃っていれば `CosmosClient` を初期化、無ければ `null` を返す
  - lazy singleton、`getCosmosContainer()` を export
  - 接続失敗時は console.warn のみで例外を投げない

---

## 4. イベントログ抽象

- [x] `lib/agent-event-log.ts`（新規）
  - 型定義: `AgentEvent`, `AgentEventState = "started" | "completed" | "failed"`
  - `appendAgentEvent(event)` — Cosmos 無効なら no-op、失敗しても警告のみ
  - `listAgentEventsByReport(reportId)` / `listAgentEventsByRun(runId)` — `occurredAt` ASC
  - `deriveStepStateFromEvent` helper

---

## 5. Worker からのイベント記録

- [x] `lib/mock-agent.ts` `generateReportDraft` に optional `onStep: GenerationStepReporter`
  - `search_camera_frames` / `evaluate_images` / `generate_report` の started/completed を emit
- [x] `lib/prompt-improvement-processor.ts` `runPromptImprovementJob` に optional `onStep: KnowledgeStepReporter`
  - `collect_corrections` / `analyze_patterns` / `generate_knowledge` / `prepare_review` の started/completed を emit
  - 例外時は currentStep に failed イベント
- [x] `worker/handlers.ts`
  - `handleReportMessage`: parse_input / prepare_review を worker 側で emit、generateDraft に onStep 渡す
  - 例外時は最後のステップに failed event
  - `handlePromptImprovementMessage`: onStep を runPromptJob に渡す
  - `appendAgentEvent` を deps に追加（既存テストは `as any` のため影響なし）

---

## 6. API

- [x] `app/api/reports/[id]/events/route.ts` — GET で `listAgentEventsByReport(id)` を返す
- [x] `app/api/prompt-improvement-runs/[id]/events/route.ts` — GET で `listAgentEventsByRun(id)` を返す
- Cosmos 未設定時は `events: []` を返す（API は常に 200）

---

## 7. UI: 事故報生成画面

- [x] `app/reports/[id]/_components/ProcessingScreen.tsx`
  - 既存の status polling と並列で `/api/reports/[id]/events` も polling
  - events 由来 (`deriveStepStatesFromEvents`) があれば優先、空なら既存疑似ステップ (`deriveStepStates`) にフォールバック

---

## 8. UI: 施設ナレッジ改善画面（Phase 6.6 連携）

- [x] `PromptImprovementsClient`
  - `/api/prompt-improvement-runs/{runId}/events` を polling
  - events 由来 (`deriveKnowledgeStepStatesFromEvents`) があれば優先、空ならフォールバック
  - 新規 run 投入時に events を初期化

---

## 9. テスト

- [x] `lib/__tests__/generation-steps.test.ts` — `deriveStepStatesFromEvents` の 3 ケース追加
- [x] `lib/__tests__/knowledge-improvement-steps.test.ts` — `deriveKnowledgeStepStatesFromEvents` の 2 ケース追加
- [x] 既存テスト含めて 36 件 pass

---

## 10. 動作確認

- [x] env 未設定でローカル起動 → 既存通り動く（events 系は 200 で `[]` を返す）
- [x] Cosmos 環境変数設定 → Worker 実行で agent_events コンテナにレコードが入る
- [ ] 事故報生成画面で events 由来のステップ進行が表示される
- [ ] 失敗時に failed イベントが記録され、UI に warning が出る
- [ ] Cosmos が一時的に落ちても本線（SQL 更新）は完走する

---

## 11. デプロイ

- [x] `git push origin main`
- [x] Container Apps の env を Cosmos 用に更新（ユーザー対応）
- [x] 本番でイベントログが蓄積されることを確認

---

## 12. デモ向けポイント

- [ ] デモ説明で「SQL は正本、Cosmos はエージェント実行ログ」と二層分離を説明できるようにする
- [ ] Cosmos が無くてもデモ動線は壊れない（Phase 6.4 の疑似ステップにフォールバック）

Phase 6.7 の Cosmos DB エージェントイベントログについて、Azure 側の Cosmos DB container は partition key `/entityId` で作成済みです。

以下の観点で実装を確認し、必要なら最小差分で修正してください。

## 前提

Cosmos DB:

* Database: `agent-hack-trial`
* Container: `agent_events`
* Partition key: `/entityId`

Container Apps env は Web / Worker の両方に設定済みです。

* `COSMOS_ENDPOINT`
* `COSMOS_KEY`
* `COSMOS_DATABASE`
* `COSMOS_CONTAINER`

## やりたいこと

`agent_events` には、事故報生成イベントと施設ナレッジ改善イベントの両方を保存します。

そのため、全イベントに必ず以下を持たせたいです。

```ts
entityType: "report" | "prompt_improvement_run";
entityId: string; // reportId または runId
```

事故報生成イベントでは:

```ts
entityType = "report"
entityId = reportId
reportId = reportId
```

施設ナレッジ改善イベントでは:

```ts
entityType = "prompt_improvement_run"
entityId = runId
runId = runId
```

## 確認・修正してほしいファイル

主に以下を確認してください。

* `lib/agent-event-log.ts`
* `lib/cosmos.ts`
* `worker/handlers.ts`
* `lib/mock-agent.ts`
* `lib/prompt-improvement-processor.ts`
* `app/api/reports/[id]/events/route.ts`
* `app/api/prompt-improvement-runs/[id]/events/route.ts`
* 関連 tests

## 修正方針

1. `appendAgentEvent` に渡されるイベントが必ず `entityId` を持つようにしてください。
2. `reportId` 系イベントでは `entityId = reportId` にしてください。
3. `runId` 系イベントでは `entityId = runId` にしてください。
4. Cosmos DB query は `/entityId` partition key に合うようにしてください。

   * report events の取得では `entityId = reportId`
   * prompt improvement run events の取得では `entityId = runId`
5. 既存の fallback 設計は維持してください。

   * Cosmos env 未設定なら no-op
   * Cosmos 書き込み失敗は `console.warn` のみ
   * 本線処理は止めない
   * UI は events が空なら疑似ステップ表示に fallback
6. 既存の `reportId` / `runId` フィールドは検索・表示用に残してください。
7. partition key を `/reportId` 前提にした実装が残っていれば `/entityId` 前提に直してください。

## テスト

既存テストに加えて、可能なら以下を確認するテストを追加してください。

* report event append 時に `entityId === reportId`
* prompt improvement event append 時に `entityId === runId`
* `listAgentEventsByReport(reportId)` が `entityId = reportId` で取得する
* `listAgentEventsByRun(runId)` が `entityId = runId` で取得する
* Cosmos 無効時は no-op で例外にならない

最後に以下を実行して、すべて通ることを確認してください。

```bash
npx tsc --noEmit
pnpm test
pnpm build
```

実装後、変更内容と確認結果を簡潔にまとめてください。

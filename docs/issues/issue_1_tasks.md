# issue_1 タスク管理 — 施設ナレッジ/プロンプト改善フローの worker 非同期化

> 対応 issue: `docs/issues/issue_1.md`
>
> 方針:
> - Service Bus queue を **分離**（事故報告書生成 / プロンプト改善 を別 queue に）
> - Worker Container App は **1つのまま**で、両 queue を listen（issue_1 末尾の案A採用）
> - Web API は queued status の run を作って enqueue するだけ、AI は呼ばない
> - UI は runId を受け取って polling で completed / failed まで待つ
> - 既存の事故報告書生成フローは壊さない（後方互換: 旧 reportId-only message も処理可能）

---

## 1. 型定義

- [ ] `lib/job-messages.ts`（新規）
  - `ReportGenerationJobMessage = { reportId: string }`
  - `PromptImprovementJobMessage = { runId: string; locationKey: string }`
  - `parseReportGenerationMessage(body)` — 旧形式 string / `{ reportId }` 双方を受け入れる
  - `parsePromptImprovementMessage(body)` — strict に validate

---

## 2. Service Bus 送信

- [ ] `lib/service-bus.ts`
  - `enqueuePromptImprovement({ runId, locationKey })` を追加
  - 既存 `enqueueReportGeneration(reportId)` はそのまま（message body は `{ reportId }` のまま）
  - 新規 env: `SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME`
  - 既存 env: `SERVICE_BUS_REPORT_QUEUE_NAME`（変更なし）

---

## 3. prompt-improvement-runs status 拡張

- [ ] `lib/prompt-improvement-run-repository.ts`
  - `createPromptImprovementRun` の挿入時 status を **`queued`** に変更
  - `markPromptImprovementRunRunning(id)` を追加（queued → running）
  - `getPromptImprovementRun(id)` を追加（UI polling 用）
  - 既存 `completePromptImprovementRun` / `failPromptImprovementRun` はそのまま使う

---

## 4. AI 処理の lib 抽出

- [ ] `lib/prompt-improvement-processor.ts`（新規）
  - 既存 `/api/admin/run-prompt-improvement` の中身（corrections 集計 → AI 生成 → draft 保存 → run 完了）を関数化
  - `runPromptImprovementJob({ runId, locationKey })` として公開
  - corrections が 0 件の場合は failPromptImprovementRun する

---

## 5. /api/admin/run-prompt-improvement を enqueue-only に変更

- [ ] `app/api/admin/run-prompt-improvement/route.ts`
  - body から locationKey 取得
  - `createPromptImprovementRun` で queued レコード作成
  - `enqueuePromptImprovement` で Service Bus に enqueue
  - `{ runId, locationKey, status: "queued" }` を 202 で返す
  - 既存の AI 同期処理は削除（lib に移動済み）

---

## 6. worker を 2 queue listen 化

- [ ] `worker/report-worker.ts`
  - Receiver を2つ作る
    - report 用: 既存 `SERVICE_BUS_REPORT_QUEUE_NAME`
    - prompt-improvement 用: `SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME`
  - `prompt improvement queue env` 未設定時は **prompt improvement 側だけ skip + 警告ログ**（report 側は通常起動）
  - prompt-improvement message 受信時:
    - `markPromptImprovementRunRunning`
    - `runPromptImprovementJob({ runId, locationKey })`
    - 失敗時は `failPromptImprovementRun`
  - ログ prefix
    - report: `[report:<reportId>] start/completed/failed`
    - improvement: `[prompt-improvement:<runId>] start/completed/failed locationKey=...`
  - SIGTERM では両 receiver を close

---

## 7. UI polling

- [ ] `app/api/prompt-improvement-runs/[id]/route.ts`（新規）
  - GET で runId / locationKey / status / inputCorrectionCount / proposedOverrideId / errorMessage / createdAt / completedAt を返す

- [ ] `app/admin/prompt-improvements/page.tsx`
  - 生成ボタン押下後、runId と queued バッジを表示
  - 数秒おき（3秒間隔）に GET /api/prompt-improvement-runs/:id を polling
  - status が `completed` / `failed` になったら polling 停止
  - completed なら override list を refetch して draft を表示
  - failed なら errorMessage を表示

---

## 8. ログ・観測性

- [ ] worker のログに job type / runId / locationKey / status を含める
- [ ] prompt 本文・API key・SAS URL は出力しない（既存方針）

---

## 9. 型・ビルド確認

- [ ] `npx tsc --noEmit`

---

## 10. Azure 側作業（ユーザー対応）

> 新しい Service Bus queue を1つ追加するだけ。新サービスはなし。

```bash
# queue 追加
az servicebus queue create \
  --resource-group rg-agent-hack-trial \
  --namespace-name sb-agent-hack-trial-29739 \
  --name prompt-improvement-requests

# 確認
az servicebus queue list \
  --resource-group rg-agent-hack-trial \
  --namespace-name sb-agent-hack-trial-29739 \
  -o table

# Web app に env 追加
az containerapp update \
  --name agent-hack-trial \
  --resource-group AdLabo \
  --set-env-vars \
    SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME="prompt-improvement-requests"

# Worker に env 追加
az containerapp update \
  --name agent-hack-trial-worker \
  --resource-group AdLabo \
  --set-env-vars \
    SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME="prompt-improvement-requests"
```

- [ ] `.env.local` にも `SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME=prompt-improvement-requests` を追加

---

## 11. 動作確認（ユーザー対応）

- [ ] ローカル: web から「改善案を生成」 → 即 runId が返ること
- [ ] ローカル: worker ログに `[prompt-improvement:<id>] start` → `completed` が出ること
- [ ] ローカル: UI が polling で completed を検知し draft を再取得すること
- [ ] 旧 message 形式（`{ reportId }`）を投入しても worker が処理できること（後方互換）
- [ ] `git push origin main` でデプロイ → 本番 worker ログでも同様に動くこと

---

## 設計メモ

### message schema の決定
- queue が分かれているので message に `type` discriminator は不要
- 各 queue は専用 schema を持つ
- ただし worker 内で parse 失敗時は明確にログを出して dead-letter させる

### Worker 構成（案A）
- 1プロセスで 2 receiver を持つ
- `Promise.all` で並行に subscribe
- `processError` / SIGTERM ハンドリングは共有

### 後方互換性
- 旧 report message は `{ reportId: "..." }` で投入されてきた
- 新 message も同じ schema なので report 側は変更不要
- 将来 `{ type: "generate_report", reportId }` に揃えたいなら別 issue で対応

### prompt_improvement_runs テーブル
- スキーマ変更は不要（status は nvarchar(32) なので 'queued' も入る）
- 既存 running データがあっても問題なし
- migration の追加は不要

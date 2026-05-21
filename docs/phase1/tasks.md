# Phase 1 タスク管理 — モック同期処理 → Azure非同期ジョブ化

> 方針: `POST /api/reports` を即時返却 → Service Bus キュー → Worker → Azure SQL 更新 → フロントポーリング  
> Azureリソース作成はユーザー対応。このリポジトリで必要な実装のみ追跡する。

---

## 0. 事前準備（Azureリソース — ユーザー対応）

- [ ] Azure SQL Database 作成
- [ ] `reports` / `agent_runs` テーブル作成（`scripts/migrate.ts` を実行）
- [ ] Service Bus Namespace + Queue 作成（キュー名: `report-generation-requests`）
- [ ] 環境変数を `.env.local` に設定（下記参照）

```env
DATABASE_URL=Server=tcp:xxx.database.windows.net,1433;Initial Catalog=xxx;...
SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://xxx.servicebus.windows.net/;...
SERVICE_BUS_REPORT_QUEUE_NAME=report-generation-requests
```

---

## 1. パッケージ追加

- [x] `pnpm add @azure/service-bus mssql zod`
- [x] `pnpm add -D tsx @types/mssql`

---

## 2. 型定義更新

- [x] `lib/types.ts` — `ReportStatus` に Phase 1 ステータス追加
  - 追加: `"queued"` / `"generating_report"` / `"waiting_human_review"` / `"failed"`

---

## 3. DB・Service Bus ライブラリ

- [x] `lib/db.ts` — mssql 接続プール（シングルトン）
- [x] `lib/report-repository.ts` — reports テーブル CRUD
  - `createQueuedReport(input)` — queued レコード作成
  - `updateReportStatus(id, status, errorMessage?)` — ステータス更新
  - `saveAiDraft(id, draft)` — AI生成ドラフト保存・status → waiting_human_review
  - `saveUserDraft(id, draft)` — ユーザー修正ドラフト保存・status → updated
  - `getReportById(id)` — レポート取得（user_draft → ai_draft 優先）
  - `getReportStatus(id)` — ステータスのみ取得
  - `getAllReports()` — 一覧取得（降順）
  - `confirmReport(id)` — status → confirmed
- [x] `lib/service-bus.ts` — Service Bus 送信クライアント
- [x] `scripts/migrate.ts` — DDL 実行スクリプト（ユーザーが手動実行）

---

## 4. API ルート更新

| メソッド | パス | 変更内容 |
|---|---|---|
| POST | `/api/reports` | [x] queued作成 + enqueue → 202 Accepted |
| GET | `/api/reports` | [x] DB参照に変更 |
| GET | `/api/reports/[id]` | [x] DB参照に変更 |
| PATCH | `/api/reports/[id]` | [x] DB参照・user_draft 保存 |
| GET | `/api/reports/[id]/status` | [x] DB ステータス参照 |
| POST | `/api/reports/[id]/confirm` | [x] DB confirmed 更新 |

---

## 5. Worker

- [x] `worker/report-worker.ts` — Service Bus 受信 → `generateReportDraft()` → DB更新
- [x] `package.json` — `scripts.worker:report` 追加

---

## 6. Dockerfile

- [x] `Dockerfile.worker` — Worker 用イメージ（案A: Webと分離）

---

## 7. フロントエンド

- [x] `app/reports/[id]/page.tsx` — `ProcessingScreen` を新ステータス対応
  - `queued` / `generating_report` → 処理中表示
  - `waiting_human_review` / `updated` → 編集画面
  - `failed` → エラー表示
- [x] `app/reports/page.tsx` — 一覧の STATUS_LABELS / STATUS_COLORS に新ステータス追加

---

## 8. 動作確認（ユーザー対応）

- [x] `.env.local` に接続文字列設定
- [x] `pnpm tsx scripts/migrate.ts` でテーブル作成
- [x] `pnpm dev` で Web 起動確認
- [x] `pnpm worker:report` で Worker 起動確認
- [x] `POST /api/reports` → `{"status":"queued"}` が返ること
- [x] Service Bus キューにメッセージが積まれること（Azureポータルで確認）
- [x] Worker がメッセージ受信してドラフト生成すること（ログ確認）
- [x] フロントのポーリングで `generating_report` → `waiting_human_review` と遷移すること
- [x] `waiting_human_review` で編集画面に遷移すること
- [x] Azure SQL にデータが保存されフロントから取得できること

---

## 9. Container Apps デプロイ（ユーザー対応）

- [ ] `acr push` — `report-web` / `report-worker` イメージをビルド・プッシュ
- [ ] Container Apps `ca-report-web` 作成（ingress: external, port: 3000）
- [ ] Container Apps `ca-report-worker` 作成（ingress: disabled, minReplicas: 1）
- [ ] 環境変数を各 Container App に設定
- [ ] Web → Queue → Worker → DB → Frontend polling 疎通確認

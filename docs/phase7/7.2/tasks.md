# Phase 7.2 タスク管理 — RAG インデックス (Cosmos DB)

> 方針: confirmed 事故報を Cosmos DB `report_search_documents` コンテナに upsert する。
> 検索用テキスト + embedding + メタデータを 1事故報 = 1 document の最小スキーマで構築。
> 同期はまず手動 reindex（管理者 API + script）。confirm 時の自動 upsert は best-effort。
>
> 依存: Phase 7.1 (admin role)、既存 Azure OpenAI クライアント。
> Azure 側変更: **必要**（Cosmos コンテナ追加、Azure OpenAI embedding deployment）。

---

## 1. Azure 側準備（ユーザー対応）

- [ ] Cosmos DB コンテナ `report_search_documents` 作成
  - パーティションキー: `/facilityId`
  - Vector policy 定義（`/embedding` 1536 次元 / cosine）
  - Vector index タイプ: `quantizedFlat` または `diskANN`
- [ ] Azure OpenAI embedding deployment 用意（例: `text-embedding-3-small`）
- [ ] Container Apps の環境変数追加（Web + Worker 両方）:
  - `COSMOS_RAG_CONTAINER = "report_search_documents"`
  - `AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME`
  - `RAG_EMBEDDING_DIMENSIONS = "1536"` （参考値、コードでは未使用）

---

## 2. RAG 用 Cosmos クライアント

- [x] `lib/report-rag/cosmos-rag.ts`
  - `getReportRagContainer()`: env 未設定なら null
  - `isReportRagEnabled()` ヘルパ
  - 既存 `lib/cosmos.ts` と同じ lazy singleton パターン

---

## 3. ドキュメント型と builder

- [x] `lib/report-rag/types.ts` — `ReportSearchDocument` / `INDEXABLE_STATUSES`
- [x] `lib/report-rag/build-report-document.ts`
  - `buildReportSearchText(report)`: 5W2H + cause + treatment + preventiveAction + body + 被害情報
  - `buildReportSearchDocument({report, site, embedding, text, indexedAt, sourceUpdatedAt})`
  - `RISK_KEYWORDS` から incidentTypes 抽出
- [x] `lib/__tests__/build-report-document.test.ts`（3 tests）

---

## 4. Embedding 生成

- [x] `lib/report-rag/embedding.ts`
  - `embedText(text)` — Azure OpenAI deployment 経由
  - `AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME` 未設定で例外

---

## 5. Upsert / list

- [x] `lib/report-rag/cosmos-report-search.ts`
  - `upsertReportSearchDocument(doc)`
  - `getReportSearchDocument(reportId, facilityId)` — 既存判定（partition key 指定）
  - `countReportSearchDocuments()` / `getLastIndexedAt()` — index-status 用

---

## 6. インデックス対象抽出と orchestrator

- [x] `lib/report-rag/list-reports-for-indexing.ts`
  - `listIndexableReports()` — `JSON_VALUE(input_json, '$.facilityId')` 含めて confirmed のみ
  - `getIndexableReport(reportId)` — confirm hook 用
- [x] `lib/report-rag/index-report.ts`
  - `indexReportForRag(reportId)` — best-effort（Cosmos 無効なら no-op）
  - `reindexAllReports({ force })` — `sourceUpdatedAt` 比較でスキップ判定、force で強制

---

## 7. Reindex バッチ

- [x] `scripts/reindex-report-rag.ts` — `--force` フラグ対応
- [x] `package.json` `rag:reindex` 登録

---

## 8. 管理者 API

- [x] `POST /api/admin/report-rag/reindex`
  - `requireAdminSession()` → 403
  - body: `{ force?: boolean }`
  - Cosmos 無効時は 503
  - レスポンス: `{ indexed, skipped, failed }`
- [x] `GET /api/admin/report-rag/index-status`
  - `requireAdminSession()` → 403
  - レスポンス: `{ enabled, indexedDocuments, lastIndexedAt }`

---

## 9. confirm 時の自動 upsert

- [x] `app/api/reports/[id]/confirm/route.ts`
  - `confirmReport` 後に `indexReportForRag(id)` を try/catch
  - 失敗しても confirm は成功

---

## 10. 動作確認

- [x] env 未設定で tsc / test / build pass
- [ ] Azure 設定後 `pnpm rag:reindex` で confirmed 件数分が Cosmos に入る
- [ ] index-status で件数が見える
- [ ] confirmed 1件追加 → 自動で Cosmos に upsert される

---

## 11. デプロイ

- [ ] `git push origin main`
- [ ] Container Apps の env を Cosmos / Azure OpenAI 用に更新（ユーザー対応）

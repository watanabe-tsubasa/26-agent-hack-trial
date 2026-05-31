# Phase 7.3 タスク管理 — RAG Chat API

> 方針: 自然言語クエリを `aggregate` / `search` に分類し、
> 集計系は Azure SQL、事例検索は Cosmos vector search で取得して LLM に整形させる。
> 分類はまず単純なキーワードルールでOK。会話履歴永続化はやらない。
>
> 依存: Phase 7.2 (RAG index)、Phase 7.1 (admin role)、既存 Azure OpenAI クライアント。
> Azure 側変更: 不要（embedding と chat deployment は既存または 7.2 で用意済）。

---

## 1. クエリ分類

- [x] `lib/report-rag/classify-query.ts`
  - `classifyAdminRagQuery(message): "aggregate" | "search"`
  - キーワード: 多い / 何件 / 件数 / ランキング / サイト別 / 施設別 / 上位 等
- [x] `lib/__tests__/classify-query.test.ts`（2 tests）

---

## 2. 集計クエリ (SQL)

- [x] `lib/report-rag/aggregate-reports.ts`
  - `aggregateReportsByFacility()` → `[{ facilityId, siteName, count }]`
  - `INDEXABLE_STATUSES` (confirmed) のみ
  - `JSON_VALUE(input_json, '$.facilityId')` で集計
  - `findSiteByKey` で siteName 解決

---

## 3. ベクトル検索 (Cosmos)

- [x] `lib/report-rag/search-reports.ts`
  - `searchReportsByText(message, k=5)`:
    1. `embedText(message)` で query embedding
    2. Cosmos `VectorDistance` + ORDER BY
    3. filter: `c.documentType = 'accident_report' AND c.status = 'confirmed'`
  - 結果: `{ reportId, title, facilityId, siteName, snippet (240文字), occurredAt, createdAt, distance }[]`
  - 失敗時は `[]` を返す

---

## 4. 回答生成

- [x] `lib/report-rag/answer.ts`
  - `generateRagAnswer({ mode, message, aggregate? | sources? })`
  - SYSTEM PROMPT: 「根拠のみ使う / 見つからない場合は推測しない / 結論→補足→該当事故報」
  - `AZURE_OPENAI_DEPLOYMENT_NAME` 経由 (既存と統一)

---

## 5. Chat API

- [x] `app/api/admin/report-rag/chat/route.ts`
  - `requireAdminSession()` → 403
  - body: `{ message: string }`
  - mode が aggregate → SQL 集計 (sources は空)
  - mode が search → vector search → sources
  - レスポンス: `{ answer, mode, sources: [{ reportId, title, facilityId, siteName, url, createdAt }] }`
  - エラー時は 500

---

## 6. 動作確認

- [x] tsc clean / 44 tests pass / build OK
- [ ] 集計クエリ「事故報が多いサイトは？」 → サイトごとの件数を含む回答
- [ ] 検索クエリ「天井落下に関する事故はある？」 → 該当事故報 + URL
- [ ] 該当なし時に推測せず「見つかりません」を返す

---

## 7. デプロイ

- [ ] `git push origin main`

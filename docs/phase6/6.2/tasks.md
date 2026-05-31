# Phase 6.2 タスク管理 — 事故報の検索機能

> 方針: ログイン中サイト (`facilityId`) で常に絞り込んだうえで、
> キーワード・ステータス・期間で絞れる検索バーを `/reports` に追加する。
> Azure SQL では JSON_VALUE / LIKE を併用し、最初は単純な実装で OK。
>
> 依存: Phase 6.1 でログイン Cookie から `facilityId` が取れること。

---

## 1. 検索パラメータ仕様

- [ ] `lib/report-search.ts`（新規） — クエリ仕様と SQL 構築
  - 入力型: `ReportSearchQuery { keyword?: string; status?: ReportStatus | "all"; from?: string; to?: string }`
  - keyword は `summary`, `input_json.location`, `ai_draft_json`, `user_draft_json` を対象に LIKE
  - status は `all` の場合 WHERE に入れない
  - from/to は `created_at` で比較
  - facilityId は常時付与（呼び出し側で必須）

---

## 2. リポジトリ拡張

- [ ] `lib/report-repository.ts` — `searchReports(query: ReportSearchQuery & { facilityId: string })` を追加
  - `getAllReports()` は内部的に `searchReports({ facilityId, status: "all" })` に書き換える形でも可
  - パラメータ化クエリ（SQL injection 回避）
  - LIMIT は当面 200 件程度
- [ ] `lib/__tests__/report-search.test.ts` — WHERE 句生成のユニットテスト（pure 関数化したもの）

---

## 3. 検索 API

- [ ] `GET /api/reports` を拡張
  - query: `keyword`, `status`, `from`, `to`
  - Cookie の `siteKey` → `facilityId` を必ず注入
  - レスポンス形式は既存 `Report[]` を維持（後方互換）

---

## 4. 検索 UI

- [ ] `app/reports/_components/search-bar.tsx`（新規, Client Component）
  - 入力欄: キーワード、ステータス select、期間 from / to
  - 「検索」ボタン押下で `router.replace` クエリパラメータを更新
  - 「リセット」ボタンでパラメータクリア
- [ ] `app/reports/page.tsx`
  - `Server Component` のまま、`searchParams` を受け取って `searchReports` を呼ぶ
  - 表示件数を「該当 N 件 / 全 M 件」に
  - 既存テーブルは流用

---

## 5. ステータス選択肢

- [ ] `app/reports/_components/report-list-utils.ts` に
  - `SEARCHABLE_STATUSES = ["queued","generating_report","waiting_human_review","confirmed","failed"]`
  - 既存 `resolveStatusLabel` を流用

---

## 6. 動作確認

- [ ] サイト A でログイン → 検索バーから「転倒」で検索 → サイト A の該当事故報のみ
- [ ] サイト B でログイン → 同じキーワードでもサイト B のレコードしか出ない
- [ ] ステータス select で `waiting_human_review` を選ぶと該当のみ
- [ ] 日付 from / to で期間絞り込み
- [ ] パラメータ無しでアクセスすると現サイトの全件

---

## 7. デプロイ

- [ ] `git push origin main`
- [ ] 本番でも検索が機能することを確認

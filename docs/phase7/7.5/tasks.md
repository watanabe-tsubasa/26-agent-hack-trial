# Phase 7.5 タスク管理 — 管理者RAGチャットの会話継続対応

> 方針: 現状の 1問1答 を「会話で深掘りできる」状態に拡張。
> `previous_response_id` は使わず、**自前で history + previousSources を保持**してアプリ側で
> 検索スコープを制御する。最小スコープ（mini）を優先し、UI/集計強化は後段オプション扱い。
>
> 依存: Phase 7.1〜7.4 (admin role / RAG index / chat API / chat UI)。
> Azure 側変更: 不要。

---

## 0. 最小スコープ (mini) — 今回実装

```text
1. chat API request に history / previousSources を渡せるようにする
2. follow-up 検出（「その中」「それ」「この事故」等）
3. follow-up 時は previousSources の reportId で検索を絞る
4. answer prompt に recentHistory を含める
5. UI に「新しい会話を開始」ボタン
```

---

## 1. follow-up 検出

- [x] `lib/report-rag/detect-follow-up.ts`（新規, pure 関数）
  - キーワード判定: `その中` / `それら?` / `それ` / `先ほど` / `さっき` / `前回` / `この事故` / `この件` / `同じ` / `そのうち` / `上記`
  - `detectFollowUp(message: string): boolean`
- [x] `lib/__tests__/detect-follow-up.test.ts`（2 tests: positive / negative）

---

## 2. 検索の scope 拡張

- [x] `lib/report-rag/search-reports.ts` `searchReportsByText`
  - 第2引数を `SearchOptions = { k?, scopeReportIds? }` に変更
  - `scopeReportIds` が non-empty なら Cosmos クエリに `AND ARRAY_CONTAINS(@scope, c.reportId)` を追加
  - chat route の呼び出しも更新

---

## 3. answer 生成への履歴注入

- [x] `lib/report-rag/answer.ts`
  - `AnswerInput` に optional `history?: ChatHistoryItem[]` を追加（`ChatHistoryItem = { role: "user" | "assistant"; content: string }`）
  - `buildInputItems` で履歴を `client.responses.create` の `input` に user/assistant 形式で並べる（直近 6 件 = `HISTORY_LIMIT`）
  - SYSTEM_PROMPT に「直前の会話文脈を踏まえつつ、回答の根拠は今回提示された事故報・集計データのみ」を追記

---

## 4. Chat API スキーマ拡張

- [x] `app/api/admin/report-rag/chat/route.ts`
  - request body: `{ message, history?, previousSources? }`
  - `sanitizeHistory` / `sanitizePreviousSources` で入力バリデーション
  - `detectFollowUp(message)` + `previousSources` が両方あれば `scopeReportIds` を組み立てて `searchReportsByText` に渡す
  - response body: `{ answer, mode, sources, isFollowUp }`
  - aggregate mode では history を answer に渡すのみ（scope 絞り込みは対象外）

---

## 5. UI 改修

- [x] `app/(app)/admin/report-rag/_components/ReportRagChatClient.tsx`
  - 送信時に `history` (直近 6 件の `{ role, content }`) と `previousSources` (直近 assistant message の sources を `{ reportId, facilityId }` に整形) を request に含める
  - 「新しい会話を開始」ボタン: 押下で `messages` と `input` をリセット（loading 中は無効）
  - follow-up と検出された assistant message に小バッジ「前回の事故報に絞って検索」を表示

---

## 6. 動作確認

- [x] tsc clean / pnpm test (**50/50 pass**) / pnpm build OK
- [x] 副次フィックス: `package.json` の test script が `(app)` 以前の旧パス (`app/reports/...` / `app/admin/...`) を指していて silent skip されていた問題を修正。`utils.test.ts` 4 件が復活
- [x] 単発質問（「天井落下の事故は？」）が従来通り動く
- [x] 追質問「その中で神田事務所だけ」が前回 sources の reportId に絞って回答される
- [x] 「新しい会話を開始」で履歴がリセットされる

---

## 7. デプロイ

- [x] `git push origin main`

---

## 8. フォローアップ: assistant 履歴の type 不整合修正

> 背景: 本番で 2 ターン目以降に `400 Invalid value: 'input_text'. Supported values are: 'output_text' and 'refusal'.`。
> 履歴を Responses API に渡す際、assistant role の content に `{ type: "input_text", text }` を使っていたのが原因。
> Responses API では assistant turn の content は `output_text` / `refusal` のみ許可される。
> ただし `ResponseOutputMessage` 型を満たすには `id` / `status` / `type: "message"` も必要で、毎ターン人工的に組み立てるのは脆い。

- [x] `lib/report-rag/answer.ts`
  - 履歴・current prompt とも **`EasyInputMessage` 形式 (plain string content)** に統一
  - `content: string | ContentList` のうち、`string` を選ぶことで input_text / output_text の指定問題を回避
  - role ごとの SDK 内部エンコーディングに委ねる（issue.md の方針より一段シンプル）
  - 型定義は最小化 (`{ role: "user" | "assistant"; content: string }`)
  - `toHistoryItem` を pure 関数として export（テスト用）
- [x] `lib/__tests__/answer-history.test.ts`（5 tests）
  - user/assistant の role 保持
  - 履歴 → current prompt の順序
  - `HISTORY_LIMIT=6` 上限
  - 全ての content が string であること（regression guard）

### 動作確認

- [x] tsc clean / **pnpm test 55/55 pass** / pnpm build OK
- [x] 本番デプロイ後、2 ターン目以降の質問が 400 にならずに回答される

---

## 9. 後続スコープ（今回はやらない）

> 余力でやる候補。要件が固まったら別タスクで切り出す。

- query rewrite を Responses API で実装（履歴+今回質問 → 検索クエリへ変換）
- 集計回答の structuredData 返却 + UI 表形式
- source card に「この事故について質問」「このサイトで絞る」アクション
- 送信中のグッジョくん表示リッチ化
- 検索 topK / score threshold 調整、回答本文で使った sources のみ返す（issue.md の追加観点 — 「転倒事故」query に天井落下が混入する件）

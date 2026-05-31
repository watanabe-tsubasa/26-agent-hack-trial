# Phase 6.6 タスク管理 — 施設ナレッジ管理UIのグッジョくん化

> 方針: `/admin/prompt-improvements` は内部用語（プロンプト改善、キュー投入、queued/running 等）が
> そのまま画面に出ているため、デモでは伝わりにくい。
> Phase 6.4/6.5 と同じ世界観（グッジョくん + グラスモーフィズム）に揃え、
> 「グッジョくんが人間の修正を振り返って施設ナレッジ候補を考えてくれる画面」として見せる。
>
> 依存: Phase 6.5（GoodjobAvatar / goodjob-copy）と Phase 5 の非同期化済みプロンプト改善フロー。
> Azure 側変更: 不要（純粋にフロント文言と UI 追加）。

---

## 1. ステップ定義

- [x] `lib/knowledge-improvement-steps.ts`（新規）
  - `KnowledgeImprovementStepKey = "collect_corrections" | "analyze_patterns" | "generate_knowledge" | "prepare_review"`
  - `KNOWLEDGE_IMPROVEMENT_STEPS`: 4 ステップ（label / description / goodjob tone）
  - `deriveKnowledgeStepStates(status: RunStatus, elapsedMs)` — generation-steps と同パターン
  - `pickKnowledgeGoodjobTone(snapshots)` — failed → warning / in_progress → step tone / 全完了 → success
- [x] `lib/__tests__/knowledge-improvement-steps.test.ts`（9 tests）

---

## 2. 文言定数

- [x] `lib/knowledge-copy.ts`（新規）
  - 画面タイトル / 説明文 / ボタン文言
  - `PROMPT_IMPROVEMENT_STATUS_COPY` （queued/running/completed/failed/superseded）
  - `OVERRIDE_STATUS_LABEL` （active=利用中 / draft=確認待ち / archived=過去）
  - セクション見出し / エラー文言

---

## 3. グラスモーフィズムダイアログ

- [x] `app/admin/prompt-improvements/_components/KnowledgeImprovementDialog.tsx`（新規）
  - `fixed inset-0 z-50 ... bg-slate-950/25 backdrop-blur-sm`
  - 内側: `rounded-3xl border border-white/40 bg-white/75 backdrop-blur-xl shadow-2xl`
  - `<GoodjobAvatar tone={tone} size="lg" />`
  - 「施設ナレッジ改善エージェント」見出し + 現在ステップ説明
  - ステップ一覧 (completed ✓ / in_progress … / failed ! / pending ・)
  - 完了 / 失敗時のみ閉じるボタン表示

---

## 4. PromptImprovementsClient リファクタ

- [x] `app/admin/prompt-improvements/_components/PromptImprovementsClient.tsx`
  - 画面タイトル: 「施設ナレッジ改善」
  - 説明文: グッジョくんによる施設ナレッジ整理の説明
  - ボタン文言: 「グッジョくんに改善案を考えてもらう」
  - 進行中ラベル: 「グッジョくんが分析中...」「順番待ち...」
  - latestRun が queued/running の間 `<KnowledgeImprovementDialog />` を全画面で重ねる
  - 完了通知文言を新文言に
  - run のメタ表示は `PROMPT_IMPROVEMENT_STATUS_COPY` 由来のラベル＋説明に置換
- [x] セクション見出し置換
  - 「現在適用中の施設ナレッジ」 → そのまま
  - 「施設ナレッジ draft」 → 「確認待ちの候補」
  - 「アーカイブ」 → 「過去の候補」

---

## 5. StatusBadge の文言更新

- [x] `app/admin/prompt-improvements/_components/StatusBadge.tsx`
  - `OVERRIDE_STATUS_LABEL` 経由で active=利用中 / draft=確認待ち / archived=過去

---

## 6. ヘッダーへのグッジョくん配置

- [x] `PromptImprovementsClient` 上部に小さな `<GoodjobAvatar size="sm" tone="idle" />` + 見出し
- [x] ボタン内アイコンも `<GoodjobAvatar size="xs" tone="thinking" />`

---

## 7. リロード時の継続表示

- [x] 画面ロード時に `latestRun.status === "queued" | "running"` ならダイアログを開いたまま
- [x] 完了/失敗後はダイアログを sticky にして、ユーザーが「閉じる」ボタンで明示的に閉じる

---

## 8. 動作確認

- [ ] 「グッジョくんに改善案を考えてもらう」を押すとダイアログが開く
- [ ] queued → running と進む過程でステップが順次チェックされる
- [ ] completed で候補が表示され、ダイアログに閉じるボタンが出る
- [ ] failed の場合は困ったグッジョくん + エラーメッセージ
- [ ] リロードしても queued/running 中はダイアログが表示される
- [ ] StatusBadge / 各セクション見出しが新文言になっている

---

## 9. デプロイ

- [ ] `git push origin main`
- [ ] 本番でも文言が反映されていることを確認

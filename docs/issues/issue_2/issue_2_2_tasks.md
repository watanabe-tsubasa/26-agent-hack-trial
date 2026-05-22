# issue_2_2 タスク管理 — 改善案 draft の重複表示防止（最新1件のみ）

> 対応 issue: `docs/issues/issue_2/issue_2_2.md`
>
> 既に **issue_2** で以下は実装済み:
> - 重複 run 防止（POST guard + worker supersede + transaction）
> - 新 draft 作成後に古い ai_proposed draft を archived にする処理
>   - 現在の関数名: `archiveOtherAiProposedDrafts(locationKey, keepId)`
>
> 本 issue (2_2) では、指定された関数名/シグネチャに合わせ、UI 側でも draft が
> 最新1件しか表示されないようにする。

---

## 1. リポジトリ関数のリネーム

- [ ] `lib/location-prompt-override-repository.ts`
  - 既存 `archiveOtherAiProposedDrafts(locationKey, keepId)` を **削除**
  - 新規 `archiveOlderDraftLocationPromptOverrides({ locationKey, keepId })` を追加
    - 条件:
      - `location_key = locationKey`
      - `source = 'ai_proposed'`
      - `status = 'draft'`
      - `id <> keepId`
    - 影響件数を返す（既存と同じ）

---

## 2. processor の呼び出し更新

- [ ] `lib/prompt-improvement-processor.ts`
  - import を新名に置換
  - 呼び出しを object 引数 `{ locationKey, keepId: overrideId }` に変更

---

## 3. UI: 最新 draft のみ表示

- [ ] `app/admin/prompt-improvements/page.tsx`
  - `drafts` を `status === "draft"` から **最新 createdAt の1件のみ**にする
  - section ヘッダーは「改善案 draft」に変更（カウント表記をやめる）
  - 説明文を追加: 「過去の draft は新しい draft 生成時に自動で archived になります」
  - archived セクションは既存どおり（折りたたみ表示）

---

## 4. 動作確認（ユーザー対応）

- [ ] draft が2件以上ある状態から `現在の修正履歴から改善案を生成` を押す
  - 新 draft 1件のみ表示される
  - 古い draft は archived セクション（折りたたみ）に移動
  - active 中のものはそのまま active のまま
- [ ] approve flow に変化がないこと（archived の中から approve しても期待通り active 化される）

---

## 5. 型・ビルド確認

- [ ] `npx tsc --noEmit`

---

## 設計メモ

### includeArchived クエリは見送り
- UI 側で `status === "archived"` を分離表示しているので API 変更は不要
- 必要になれば後で `?includeArchived=false` を追加

### active との関係
- archive 対象は `status='draft'` のみ
- `active` は触らない（approve API でのみ archived 化）
- approve したいときは「最新 draft を approve」がベースだが、archived セクションから手動操作する選択肢は将来 issue で

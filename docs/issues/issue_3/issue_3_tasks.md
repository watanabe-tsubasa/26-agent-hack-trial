# issue_3 タスク管理 — Phase 5 の責務を「施設ナレッジ蓄積」に修正

> 対応 issue: `docs/issues/issue_3.md`
>
> 方針:
> - 既存の `location_prompt_overrides` / approve flow / Service Bus / Worker はそのまま流用
> - **生成 AI の責務だけ**を「書きぶり補正ルール作成」から「施設固有ナレッジの抽出」に切り替える
> - DB スキーマ / テーブル名は変更しない（マイグレーション不要）
> - 報告書生成時、追記見出しを「補正ルール」から「施設固有の参考情報」に変更
> - UI 表記も「補正ルール」→「施設ナレッジ」に統一
> - 管理者認証は引き続き未実装

---

## 1. システムプロンプト書き換え

- [ ] `lib/location-prompt-override-prompt.ts`
  - 既存 `PROMPT_IMPROVEMENT_SYSTEM_PROMPT` を全面書き換え
  - 抽出対象 / 抽出しないものを明示
  - 書きぶり修正は `ignoredStyleCorrections` に逃がす指示を入れる
  - `overrideText` は「# store-XXX 施設ナレッジ」を見出しとする Markdown を要求

---

## 2. 出力スキーマ変更

- [ ] `lib/location-prompt-override-schema.ts`
  - 既存 `observedCorrectionPatterns` を **`facilityKnowledgeCandidates`** に置換
    - フィールド: `category` (enum) / `title` / `content` / `confidence` (0-1) / `evidence[]` / `shouldApplyToGeneration` / `riskNotes[]`
    - evidence: `{ reportId, fieldPath, quotedCorrection }`
  - 新規 `ignoredStyleCorrections` を追加
    - フィールド: `fieldPath` / `reason`
  - 既存の `title` / `summary` / `overrideText` / `riskNotes` は残す（テーブル列との互換のため）
  - JSON Schema (strict) も同期

---

## 3. AI入力 / 出力

- [ ] `lib/generate-location-prompt-override.ts`
  - 入力 examples に **`reportId`** を含める（evidence の出力に必要）
  - 出力 `overrideText` は「# store-XXX 施設ナレッジ」形式の Markdown を期待

- [ ] `lib/prompt-improvement-processor.ts`
  - `analysisJson` に保存するキーを新スキーマに合わせる
    - `summary`, `facilityKnowledgeCandidates`, `ignoredStyleCorrections`, `riskNotes`

---

## 4. 報告書生成時の挿入見出し

- [ ] `lib/accident-report-ai.ts`
  - Before:
    ```
    # 店舗・施設別の補正ルール
    ```
  - After:
    ```
    # 施設固有の参考情報
    以下はこの施設に関する既知情報です。事故概要と関連する場合のみ参考にしてください。
    確定原因として断定しないでください。
    ```

---

## 5. UI 表記変更

- [ ] `app/admin/prompt-improvements/page.tsx`
  - 見出し / コピー
    - 「補正ルール管理」→「施設ナレッジ管理」
    - 「現在適用中の補正ルール」→「現在適用中の施設ナレッジ」
    - 「補正ルール本文」→「施設ナレッジ本文」
    - 「この補正ルールを適用」→「この施設ナレッジを適用」
    - 「AIが見つけた修正傾向」→「AIが抽出した施設固有情報」
    - 「現在の修正履歴から改善案を生成」→「現在の修正履歴から施設ナレッジ候補を生成」
  - 分析ブロックを新スキーマ対応
    - `analysis.facilityKnowledgeCandidates` を表示（category / title / content / confidence）
    - `analysis.ignoredStyleCorrections` を「書きぶり修正のため施設ナレッジには含めない項目」として小さく表示
    - 旧 `observedCorrectionPatterns` も後方互換で読めるようにフォールバック表示
  - 説明文に「書きぶり・記法は全体共通ルールとして扱い、施設ナレッジには保存しません」を追加

---

## 6. ドキュメント

- [ ] `docs/phase5/tasks.md`
  - 目的を「プロンプト改善」→「施設ナレッジ蓄積」に書き換え
  - 「週次自動生成」は将来構想として残す
  - approve したものだけが active になる挙動は維持

---

## 7. 型・ビルド確認

- [ ] `npx tsc --noEmit`

---

## 8. 動作確認（ユーザー対応）

- [ ] `git push origin main` でデプロイ
- [ ] store-001 に修正履歴がある状態で「施設ナレッジ候補を生成」
- [ ] 生成された draft の overrideText が「# store-001 施設ナレッジ」見出しを含み、書きぶりルールではなく施設固有事実だけになっていることを確認
- [ ] analysis ブロックに facilityKnowledgeCandidates / ignoredStyleCorrections が表示されること
- [ ] approve → 報告書生成時のシステムプロンプトに「# 施設固有の参考情報」が追記されることを確認

---

## 設計メモ

### DB 互換性
- テーブル名 `location_prompt_overrides` は維持
- カラムも変更なし。`override_text` には施設ナレッジ Markdown を保存
- 既存 active レコードはそのまま動く（プロンプト挿入時の見出しだけが変わる）

### `confidence` の使い方
- 0.0-1.0 の小数
- UI では「信頼度」と表示
- 報告書生成では特に閾値は設けず active になっていれば挿入する（confidence をハードルにすると複雑になりすぎるため）

### evidence の reportId
- correction 入力 example に reportId を含めるよう変更
- AI 出力の evidence で「どの修正履歴から抽出したか」を辿れるようにする

### 後方互換
- 既存 draft / active レコードの analysis_json は旧スキーマ形式
- UI は新キー優先、なければ旧キー（observedCorrectionPatterns）も表示

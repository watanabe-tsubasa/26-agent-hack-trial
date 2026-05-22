# Phase 5.5 タスク管理 — 補正ルール改善 管理画面

> 目的: Phase 5 で実装した store-001 向けプロンプト補正ルール生成機能を、Web UI から
> 手動で操作できるようにする。「人間がAIを育てるUI」をデモで見せる。
>
> 重要方針:
> - 認証なしのデモ画面（route: `/admin/prompt-improvements`）
> - locationKey は **store-001 固定** （複数施設対応は今回やらない）
> - active 化は人間承認後のみ
> - draft のみ編集可能（active/archived は編集不可）
> - 週1 cron は今回実装しない（将来案として docs に追記）

---

## 1. 編集用 repository 関数

- [x] `lib/location-prompt-override-repository.ts` に `updateLocationPromptOverride` を追加
  - signature:
    ```ts
    updateLocationPromptOverride({
      id, title, overrideText
    }: { id: string; title?: string; overrideText?: string }): Promise<void>
    ```
  - 対象が draft でない場合は `Error("Only draft overrides can be updated")` を throw
  - title / overrideText の少なくとも1つは必須

---

## 2. PATCH API ルート

- [x] `app/api/location-prompt-overrides/[id]/route.ts`
  - `PATCH` ハンドラ
  - body: `{ title?: string; overrideText?: string }`
  - active/archived を編集しようとした場合は 400
  - 成功時は更新後のレコードを返す

- [x] `app/api/location-prompt-overrides/[id]/route.ts` に GET も追加
  - 単体取得（管理画面で使う）

---

## 3. 管理画面

- [x] `app/admin/prompt-improvements/page.tsx`
  - "use client" のシングルページ
  - 対象 locationKey は `store-001` 固定（上部に表示するだけ）
  - サーバ起動時に GET `/api/location-prompt-overrides?locationKey=store-001` を fetch して active / draft を分けて表示

### 上部：実行パネル
  - タイトル: "Phase 5: 店舗・施設別 補正ルール改善"
  - 対象施設ID: store-001
  - 「現在の修正履歴から改善案を生成」ボタン
  - 生成中 loading / 成功（draft 作成完了メッセージ）/ エラー表示
  - 成功時は一覧を再取得
  - 422 (corrections 0件) は「対象の修正履歴がありません」と表示

### 中段：Active 補正ルール
  - status = active の override を表示
  - title / approvedAt / overrideText（pre-wrap）
  - analysisJson があれば observedCorrectionPatterns / summary をパースして表示

### 下段：Draft 一覧
  - status = draft の override を新しい順に並べる
  - 各 card:
    - title（編集可）
    - createdAt
    - analysisJson summary（パースして表示）
    - overrideText（textarea で編集可）
    - 「保存」ボタン → PATCH /api/location-prompt-overrides/:id
    - 「適用」ボタン → POST /api/location-prompt-overrides/:id/approve → 一覧再取得
  - 各操作の loading / 成功 / エラー表示

### archived は一覧の最下段に折りたたみで簡易表示（オプション、最小実装で十分）

---

## 4. UI 説明文（注意書き）

- [x] 上部に注意文ブロックを置く
  - 「AIは改善案を draft として作成します」
  - 「適用するまで事故報告書生成には反映されません」
  - 「適用後、次回以降の同一施設の報告書生成時に補正ルールが追記されます」
  - 「本来は管理者権限が必要ですが、デモ実装では認証なしです」

---

## 5. レイアウト・ナビ

- [x] `app/layout.tsx` のヘッダー nav に "改善" or "管理" リンクを追加
  - `/admin/prompt-improvements` への遷移

---

## 6. 将来メモ

- [x] `docs/phase5/tasks.md` の末尾に将来案セクションを追記
  - 週1 cron で draft を自動生成
  - active 化は人間承認後のみ
  - Azure Functions / Container Apps Jobs / GitHub Actions cron など

---

## 7. 型・ビルド確認

- [x] `npx tsc --noEmit`
- [ ] dev で動作確認（ユーザー対応）
  - 改善案生成
  - draft 表示
  - draft 編集保存
  - approve
  - active 表示
  - 同 locationKey の旧 active が archived に変わる

---

## 8. デプロイ（ユーザー対応）

- [ ] `git push origin main`
- [ ] 本番でも /admin/prompt-improvements が動くことを確認

---

## やらないこと（明示）

- 認証 / 管理者権限
- 週1 cron 実行（将来案として記載のみ）
- locationKey の選択 UI
- 複数施設対応の作り込み
- 差分のグラフ化
- prompt_improvement_runs の詳細履歴画面

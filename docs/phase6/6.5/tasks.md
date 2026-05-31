az containerapp logs show \
  --name agent-hack-trial-worker \
  --resource-group AdLabo \
  --follow \
  --tail 200# Phase 6.5 タスク管理 — 事故報お任せグッジョくん演出

> 方針: 単なるマスコットではなく「事故報作成の相棒エージェント」として、
> ヘッダー・生成中ダイアログ・完了画面・確認画面の各所にグッジョくんを配置する。
> 画像素材が確定するまでは絵文字（👷 など）でフォールバック。
>
> 依存: Phase 6.4（生成画面 UI/UX）と密結合。

---

## 1. キャラ表示ユーティリティ

- [x] `components/goodjob-avatar.tsx`
  - props: `size = "sm" | "md" | "lg"`, `tone = "default" | "happy" | "thinking" | "alert"`
  - 画像があれば `/public/goodjob-kun.png` を表示、なければ絵文字フォールバック
  - 後で画像差し替えしやすいよう、画像パスを 1 箇所で管理
- [x] `public/goodjob-kun.png` — 暫定で透明 PNG、または絵文字スタイルの仮素材（ユーザー対応）

---

## 2. 文言定数

- [x] `lib/goodjob-copy.ts`
  - `GOODJOB_NAME = "事故報お任せグッジョくん"`
  - `GOODJOB_STEP_COPY[stepKey] = { label, description }` （6.4 と整合）
  - `GOODJOB_COMPLETE_COPY = "下書きが完成しました。グッジョくんの下書きを確認してください"`
  - `GOODJOB_FAILED_COPY = "ごめんなさい、グッジョくんが下書き作成に失敗しました"`
  - `GOODJOB_AFTER_CONFIRM_COPY = "確認ありがとうございます！今回の修正は、次回以降の施設ナレッジ改善に活用されます。"`

---

## 3. ヘッダーへの配置

- [x] `app/layout.tsx`
  - ヘッダー左に `<GoodjobAvatar size="sm" />` を配置
  - サブタイトルを「事故報お任せグッジョくんがサポートします」に変更

---

## 4. 生成中ダイアログへの配置

- [x] `app/reports/[id]/_components/agent-progress-dialog.tsx`
  - 6.4 の `<AgentAvatar />` プレースホルダを `<GoodjobAvatar size="lg" tone="thinking" />` に
  - ヘッドライン: `${GOODJOB_NAME}が確認中`
  - ステップ進行中は `tone="thinking"`、完了は `tone="happy"`、失敗は `tone="alert"`

---

## 5. 編集 / 確定画面への配置

- [x] `app/reports/[id]/page.tsx`
  - AI ノートのバナー（既存）に `<GoodjobAvatar size="sm" />` を表示
  - 確定ボタン押下後の完了表示で `GOODJOB_AFTER_CONFIRM_COPY` を出す

---

## 6. ログイン画面の演出

- [x] `app/login/page.tsx`
  - 中央に大きめのグッジョくんと「事故報お任せグッジョくんへようこそ」キャッチコピー
  - サイト選択ボタン2つの上にグッジョくんが立っているような構図

---

## 7. デモ用素材ガイドライン

- [ ] `docs/phase6/6.5/ASSETS.md`（任意） — 画像素材の利用権限・社内利用範囲のメモ（公開リポジトリには本物素材を含めない）

---

## 8. 動作確認

- [x] ヘッダー、ログイン画面、生成中ダイアログ、編集画面、確定画面でグッジョくんが見えること
- [x] 文言が「グッジョくん」基調に統一されていること
- [x] 画像素材が無い状態でも絵文字フォールバックで崩れないこと

---

## 9. デプロイ

- [x] `git push origin main`
- [x] 本番でも文言・素材が反映されることを確認

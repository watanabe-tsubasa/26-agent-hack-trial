# Phase 6.4 タスク管理 — 事故報生成画面 UI/UX 改善

> 方針: 「生成される事故報っぽい背景」の上に「グラスモーフィズム調の状況ダイアログ」が重なる演出にする。
> AI エージェントが今何をしているか（事故概要整理 / 画像探索 / 画像確認 / 報告書生成 / 確認準備）が
> 順にチェックされていく見え方にする。
>
> 依存: Phase 6.5（グッジョくん演出）と密結合。実装は同時に進めても良い。

---

## 1. ステップ定義の見直し

- [x] `lib/generation-steps.ts`（新規）
  ```ts
  export const GENERATION_STEPS = [
    { key: "parse_input",          label: "事故概要を整理しています",
      description: "入力された内容から、発生場所・状況・被害有無を読み取っています。" },
    { key: "search_camera_frames", label: "関連するカメラ画像を探しています",
      description: "発生場所や状況に近い画像候補を確認しています。" },
    { key: "evaluate_images",      label: "画像から確認できる事実を整理しています",
      description: "原因を断定せず、画像上で確認できる情報だけを抽出しています。" },
    { key: "generate_report",      label: "事故報告書の下書きを作成しています",
      description: "5W2Hと施設ナレッジを踏まえて報告書形式に整えています。" },
    { key: "prepare_review",       label: "人間確認用の画面を準備しています",
      description: "AI下書きと写真台帳を確認・修正できる状態にしています。" },
  ] as const;
  ```
- [x] 既存 `PROCESSING_STEPS`（`lib/types.ts`）は破棄せず、Server 側互換のため残す（または移行）

---

## 2. ステップ進行のフロント疑似演出

- [x] バックエンドが細かいステップを返さないため、フロントで polling 結果 (`status`) からステップ進行を推定する pure 関数を `lib/generation-steps.ts` に追加
  - `deriveStepStates(status, elapsedMs)`
  - `queued` → step 0 in_progress, 残り pending
  - `generating_report` → 経過時間で 1〜4 を順次 in_progress / completed
  - `waiting_human_review` → 全部 completed
  - `failed` → 進行中の step を failed に
- [x] `lib/__tests__/generation-steps.test.ts` — pure 関数のユニットテスト

---

## 3. UI コンポーネント分割

- [x] `app/reports/[id]/_components/report-skeleton-background.tsx`
  - 事故報のレイアウトをスケルトン表示（タイトル、5W2H、写真台帳の枠だけ）
  - 透過度 70%, 軽い blur で背景に置く
- [x] `app/reports/[id]/_components/agent-progress-dialog.tsx`
  - グラスモーフィズム調のダイアログ
  - `backdrop-blur-xl bg-white/60 border-white/30 rounded-3xl shadow-2xl`
  - グッジョくんアイコン領域（6.5 で差し替え可能なように `<AgentAvatar />` で分離）
  - ステップ一覧、現在ステップの説明文、失敗時の表示

---

## 4. ProcessingScreen 差し替え

- [x] `app/reports/[id]/page.tsx`
  - 既存 `ProcessingScreen` を新コンポーネント (`ReportSkeletonBackground` + `AgentProgressDialog`) で置き換え
  - polling 間隔は 1500ms から 1000ms へ（短くし演出を滑らかに）
  - 経過時間（startTime）をフロントで保持し `deriveStepStates` に渡す

---

## 5. 文言調整

- [x] 6.5 と連動して全文言を「グッジョくんが…」に変更
- [x] 完了文言: 「下書きが完成しました。グッジョくんの下書きを確認してください」
- [x] 失敗文言: 「グッジョくんが下書き作成に失敗しました」

---

## 6. 動作確認

- [x] 新規事故報作成 → 5ステップが順に進む演出が見える
- [x] 約10秒以内に最後のステップまで完了 → 編集画面に遷移
- [x] 途中で `failed` になった場合、失敗表示が出る
- [x] モバイル幅でもダイアログがはみ出さない

---

## 7. デプロイ

- [x] `git push origin main`
- [x] 本番で動作確認

# Phase 8.4 タスク管理 — 写真レビュー体験と確定制御の改善

> 方針: AIが勝手に8枚確定するのではなく、「AIが候補を整理 → 人間が採用/除外を選び → 保存 → 確定」というフローにする。
> あわせて、神田事務所の時刻検索窓を `15:20` 入力にも耐える広さに拡大する。
>
> 依存: Phase 8.1〜8.3 が完了していること
> Azure 側変更: なし（seed 再実行も不要）

---

## 1. dirty判定 + 未保存時の確定disabled

- [x] `lib/reports/dirty-check.ts`（新規, pure）
  - `normalizeReportForDirtyCheck(report: Report): { ... }` を export
    - 比較対象: `summary, fiveWTwoH, cause, treatment, preventiveAction, body, photos`
  - `isReportDirty(a: Report, b: Report): boolean` を export
- [x] `app/(app)/reports/[id]/page.tsx`
  - `isDirty = isReportDirty(editedReport, report)` を導出
  - 確定ボタンを `disabled={confirming || isDirty || hasTooManyPhotos}` にする
  - `isDirty` 時の警告（amber）と、ボタン文言切替（"保存後に確定できます" / "この内容で確定"）

---

## 2. Photo型に selected を導入

- [x] `lib/types.ts`
  - `Photo` に `selected?: boolean; candidateRank?: number; selectionReason?: string; exclusionReason?: string;` を追加
- [x] `lib/photos/photo-selection.ts`（新規, pure）
  - `isSelectedPhoto(p: Photo): boolean` — `p.selected !== false`（既存写真互換）
  - `countSelectedPhotos(photos: Photo[]): number`

---

## 3. AI評価後に8枚で切らず全候補を保持

- [x] `lib/agent/image-evaluation-ai.ts`
  - `applyImageEvaluationToPhotos`:
    - **全候補を返す**（`shouldUseInLedger=false` を除外しない）
    - `selected = result.shouldUseInLedger ?? true` を設定
    - `candidateRank` を relevance降順で付与（1-based）
    - `selectionReason`/`exclusionReason` を `riskNotes` / `suggestedCaption` から導出
    - 並び順: 採用 → 未採用 / それぞれ relevance 降順

---

## 4. PhotosTab を採用/除外UIへ変更

- [x] `app/(app)/reports/[id]/page.tsx`
  - `PhotosTab` を全面書き換え
    - 8スロット固定 → `report.photos` 全件をカードで列挙
    - 採用済みは上段に CIRCLE_NUMS 付きで表示、未採用は下段に greyed で表示
    - 各カードに「採用 / 除外」トグル
    - 採用カウンタ「採用: X / 8」を表示
    - X > 8 のとき red warning
    - 採用済みカードのみ上下移動可
    - アップロードボタンは常に表示（report.photos.length に依らず）、追加された写真は `selected: true`
  - `selectedPhotoCount = countSelectedPhotos(editedReport.photos)`
  - `hasTooManyPhotos = selectedPhotoCount > 8`
  - 確定ボタンの disabled に `hasTooManyPhotos` を追加

---

## 5. 保存payload / upload に selected を反映

- [x] `app/(app)/reports/[id]/page.tsx` の PATCH payload に
  - `selected, candidateRank, selectionReason, exclusionReason, sourceType` を含める
- [x] `app/api/reports/[id]/photos/upload/route.ts`
  - 返却 Photo に `selected: true` を付与

---

## 6. preview を採用写真のみ表示

- [x] `app/(app)/reports/[id]/preview/page.tsx`
  - `report.photos.filter(isSelectedPhoto).slice(0, 8)` で 8 枚分のスロットを描画

---

## 7. 神田事務所の検索窓を T-60s〜T+90s に拡大

- [x] `lib/agent/frame-asset-repository.ts`
  - `searchFrameAssetsByTimeWindow` のシグネチャを変更
    - 削除: `targetOffsets`, `pickClosestToTargets`
    - 追加: `maxCandidates: number`
  - In-memory: タグ一致を優先、その中で occurredAt との時間距離が近い順に sort → 上位 `maxCandidates` 件
- [x] `lib/agent/camera-search.ts`
  - kanda-office の `time_window_frames` 戦略で
    - `beforeSeconds: 60, afterSeconds: 90, maxCandidates: 30`

---

## 8. テスト

- [x] `lib/__tests__/photo-selection.test.ts`（新規, pure）
  - `selected=true` → 採用
  - `selected=false` → 除外
  - `selected=undefined` → 採用（既存写真互換）
  - `countSelectedPhotos` の動作
- [x] `lib/__tests__/dirty-check.test.ts`（新規, pure）
  - 本文変更で dirty
  - 写真 selected 変更で dirty
  - 写真追加で dirty
  - 同一内容で not dirty
- [x] `lib/__tests__/apply-image-evaluation.test.ts`（新規, pure）
  - 全候補が返る（`shouldUseInLedger=false` も含む）
  - `selected = shouldUseInLedger`
  - `candidateRank` が relevance降順で付与
  - relevance 降順で並ぶ（採用が先、未採用が後）
- [x] `package.json` の test script に上記 3 件を追加

---

## 9. 動作確認

- [x] tsc clean
- [x] pnpm test 全通過
- [x] pnpm build OK
- [x] イオンモール神田で従来挙動（固定4枚）
- [x] 神田事務所で `occurredAt = 2026-05-26T15:20` 入力でも転倒・救助フレームが候補に入る
- [x] 写真候補が8枚超でもすべて表示される
- [x] 採用 > 8 の間は確定 disabled
- [x] 文書編集後、保存前は確定 disabled
- [x] 保存後、採用 ≤ 8 なら確定可能
- [x] preview / 確定レポートには採用写真のみ出る

---

## 10. デプロイ

- [ ] `git push origin main`

---

## 11. 後続スコープ（今回はやらない）

- `category: before_incident | incident_moment | after_incident | site_condition | not_useful` への分類
- UI に「検索条件サマリ」（施設・タグ・時刻範囲・候補数・採用数）の可視化
- カメラ時刻オフセット (`cameraTimeOffsetSeconds`) 対応
- 候補一覧のフィルタ・ソート切替UI

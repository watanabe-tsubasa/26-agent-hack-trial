# Phase 6.3 タスク管理 — 神田事務所サイトの動画フレーム抽出導線

> 方針: 本番で ffmpeg を回さず、**ローカルで ffmpeg 抽出 → Blob にアップロード → frame_assets に seed** する Option A。
> 神田事務所サイト (`kanda-office`) の `frame_assets` を構築し、事故報生成時の画像候補として使う。
>
> 依存: Phase 6.1 で `facilityId = "kanda-office"` が事故報入力に注入されていること。

---

## 1. 既存スキーマ確認

- [x] `frame_assets.facility_id` は既に存在（`scripts/migrate.ts:48-65`）→ DDL 追加は不要

---

## 2. 動画ファイル配置とディレクトリ準備

- [x] `videos/` を `.gitignore` に追加（大きいので入れない）
- [ ] 神田事務所動画を `videos/kanda-office-demo.mp4` として配置（ユーザー対応）
- [x] 出力先: `public/generated-frames/kanda-office/` （gitignore）

---

## 3. ffmpeg 抽出スクリプト

- [x] `scripts/extract-kanda-office-frames.sh`
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  mkdir -p public/generated-frames/kanda-office
  ffmpeg -y -i ./videos/kanda-office-demo.mp4 \
    -vf "fps=1/3" \
    public/generated-frames/kanda-office/frame-%03d.png
  ```
- [x] 実行権限: `chmod +x scripts/extract-kanda-office-frames.sh`

---

## 4. seed スクリプト

- [x] `scripts/seed-kanda-office-frames.ts`
  - `public/generated-frames/kanda-office/*.png` を走査
  - 各画像を Blob `frames/kanda-office/frame-XXX.png` にアップロード
  - `upsertFrameAsset()` で `frame_assets` に登録
    - `facility_id = "kanda-office"`
    - `camera_id = "camera-kanda-office-corridor"` （仮）
    - `camera_name = "神田事務所 廊下監視カメラ"`
    - `location_name = "神田事務所 廊下"`
    - `floor_label`, `captured_at` (現在時刻ベースまたはファイル名から推定), `frame_index`, `frame_offset_seconds`
    - `scenario_tags = ["fall"]` （まずは転倒タグ。後で画像評価AIで上書き）
    - `blob_container = "frames"`, `blob_name = "kanda-office/frame-XXX.png"`
- [x] `package.json` scripts に追加:
  - `"extract:frames:kanda": "bash scripts/extract-kanda-office-frames.sh"`
  - `"seed:frames:kanda": "bun scripts/seed-kanda-office-frames.ts"`

---

## 5. カメラ検索ロジックの facilityId 対応

- [x] `lib/camera-search.ts`
  - 現在は `scenarioTag` のみで検索 → `facilityId` も渡してフィルタ
- [x] `lib/frame-asset-repository.ts`
  - `searchFrameAssets(scenarioTag, facilityId)` シグネチャに変更
  - SQL に `and facility_id = @facilityId` を追加
- [x] `lib/mock-agent.ts` / 呼び出し側 — `input.facilityId` を `searchCameraFrames` に渡す
- [x] 神田事務所サイトでは scenario タグ未指定でも全 kanda-office 用フレームから上位を返す fallback ロジックを追加（タグ判定にヒットしない事故概要でも画像が出るようにする）

---

## 6. 画像評価 AI の流用

- [x] 既存の `AI_IMAGE_EVALUATION_ENABLED=true` フローに乗せる
  - `evaluateImagesWithAI` → `relevanceScore` 順に並び替え
  - 既存と同じ `applyImageEvaluationToPhotos` を使うので追加実装は不要

---

## 7. 動作確認 (ユーザー対応)

- [ ] `pnpm extract:frames:kanda` で `public/generated-frames/kanda-office/` にPNGが出ること
- [ ] `pnpm seed:frames:kanda` で Blob と DB に登録されること
- [ ] Azure Portal で `frames/kanda-office/...` が見えること
- [ ] 神田事務所サイトでログインし新規事故報作成 → 写真台帳に動画由来フレームが表示されること
- [ ] イオンモール神田サイトでログイン → 既存4シーンのみが候補に出ること

---

## 8. デプロイ

- [x] `git push origin main`（コード変更のみ）
- [ ] seed は手動 (`bun scripts/seed-kanda-office-frames.ts`) で本番 DB / Blob に向けて実行（ユーザー対応）

---

## 9. Azure 側で必要になる可能性のあるもの (確認)

- [ ] `frames` コンテナの存在確認 — 既存 `seed-frames.ts` で使っているので恐らくOK
- [ ] 容量や CORS の見直し — 多数の PNG が増えるため

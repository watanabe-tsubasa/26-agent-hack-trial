# Phase 8.3 タスク管理 — 画像検索の施設別最適化

> 方針: `facilityId` ごとに画像検索戦略を分ける。
> - `aeon-mall-kanda`: 生成AIで作った固定4枚 → 4枚すべてをAI評価
> - `kanda-office`: occurredAt 基準で T-12s〜T+15s の10枚 → AI評価で最大8枚に絞る
>
> 動画左上時刻と DB の `captured_at` を整合させるため、neda-office フレームの
> seed を「2026-05-26 15:05:21 JST スタート, 3秒間隔」に変更。これによりメイン事故 T を
> `2026-05-26 15:20:36 JST` = `frame-306.jpg` に位置付ける。
> JPEG ファイル自体の再アップロードは不要（メタデータ更新のみ）。
>
> 依存: なし（Phase 8.1, 8.2 と独立）
> Azure 側変更: 既存 frames コンテナのみ。seed 再実行で frame_assets を update。

---

## 1. 検索戦略の分離

- [x] `lib/agent/camera-search-strategy.ts`（新規, pure 関数）
  - `type CameraSearchStrategy = "fixed_generated_images" | "time_window_frames"`
  - `resolveCameraSearchStrategy(facilityId: string): CameraSearchStrategy`
    - `aeon-mall-kanda` → `"fixed_generated_images"`
    - `kanda-office` → `"time_window_frames"`
    - その他 → `"fixed_generated_images"`（既存挙動互換）

---

## 2. frame_asset_repository: 時刻近傍検索の追加

- [x] `lib/agent/frame-asset-repository.ts`
  - 既存 `searchFrameAssets(scenarioTag, facilityId)` はそのまま（後方互換）
  - 新規 `searchFrameAssetsByTimeWindow({ facilityId, occurredAt, beforeSeconds, afterSeconds, intervalSeconds, scenarioTags })`
    - SQL: `where facility_id = @facilityId and captured_at between @from and @to`
    - `order by abs(datediff(second, captured_at, @occurredAt)) asc`
    - 取得後 in-memory で「各 target offset (`[-12, -9, -6, -3, 0, 3, 6, 9, 12, 15]`) に最も近いフレームを1枚ずつ」選定
    - tag 補助: `scenarioTags` 配列があれば、JSON 文字列を `like` で OR 結合（最低 1tag マッチを優先）
    - 戻り値 `Photo[]`、最大10枚

---

## 3. camera-search.ts の strategy 分岐

- [x] `lib/agent/camera-search.ts`
  - `searchCameraFrames(input)` の中で `resolveCameraSearchStrategy(input.facilityId)` を呼ぶ
  - `fixed_generated_images`: 既存ロジック（タグマッチ → fallback で全件）。limit=4 で十分。
  - `time_window_frames`: `searchFrameAssetsByTimeWindow` を呼ぶ。`occurredAt = input.occurredAt`。
    - `scenarioTags` は `detectScenarioTags(input)` から導出（fall / rescue / ceiling / escalator）
    - `beforeSeconds: 12, afterSeconds: 15, intervalSeconds: 3`
  - 既存タグ判定は `detectScenarioTag` → 複数返す `detectScenarioTags` に拡張
    - 既存の ceiling / escalator に加え fall / rescue / water-leak / glass-damage を追加（記述レベルのみ、テストで担保）

---

## 4. kanda-office フレームの再 seed

- [x] `scripts/seed-kanda-office-frames.ts`
  - `BASE_CAPTURED_AT` を `new Date("2026-05-26T06:05:21Z")` (= 15:05:21 JST) に変更
  - `MAIN_INCIDENT_FRAME_INDEX = 306`
  - `buildScenarioTags(frameIndex)` を実装
    - 全フレーム共通: `["office", "open-space", "kanda-office", "事務所", "オープンスペース"]`
    - `298 <= frameIndex <= 320` のみ メイン事故タグを追加:
      `["fall", "person-fall", "unable-to-stand", "assistance", "rescue", "main-demo-incident", "転倒", "起き上がれない", "救助", "メイン事故"]`
  - `upsertFrameAsset` 呼び出し時に各フレームの tags を切り替え

---

## 5. テスト

- [x] `lib/__tests__/camera-search-strategy.test.ts`（pure）
  - `aeon-mall-kanda` → `fixed_generated_images`
  - `kanda-office` → `time_window_frames`
  - unknown → `fixed_generated_images`
- [x] `lib/__tests__/detect-scenario-tags.test.ts`（pure, detect 関数を export 化）
  - 天井 → `ceiling`
  - エスカレーター → `escalator`
  - 転倒・救助 → `fall`, `rescue`
  - 該当なし → 空配列
- [x] `package.json` の test script に 2件追加

---

## 6. 動作確認

- [x] tsc clean / pnpm test / pnpm build OK
- [x] イオンモール神田で事故報作成 → 4枚が候補化されAI評価
- [x] 神田事務所で事故報作成（`occurredAt = 2026-05-26T15:20:36+09:00`）
  - frame-302 〜 frame-311 の10枚が候補化される
  - AI評価で最大8枚に絞られる

---

## 7. デプロイ

- [ ] Azure: `pnpm seed:frames:kanda` 再実行（ユーザー）
- [ ] `git push origin main`

---

## 8. 後続スコープ（今回はやらない）

- 候補数を24件程度に拡張し、Vision評価で8枚選定
- `category: before_incident | incident_moment | after_incident | site_condition | not_useful` への分類
- UI に「検索条件サマリ」（施設・タグ・時刻範囲・候補数・採用数）の可視化
- カメラ時刻オフセット (`cameraTimeOffsetSeconds`) 対応

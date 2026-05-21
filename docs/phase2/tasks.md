# Phase 2 タスク管理 — Blob Storage + frame_assets によるカメラ画像実連携

> 方針: モック画像 → Azure Blob Storage 実画像へ切り替え。  
> `frame_assets` テーブルを中心に据え、将来の動画フレーム自動抽出（Phase 5）への差し替えコストをゼロにする。  
> Azure AI Vision / Azure OpenAI はまだモック。Blob + SQL の配管だけ本物にする。

---

## 0. 事前準備（Azureリソース — ユーザー対応）

- [ ] Azure Storage Account 作成
- [ ] Blob コンテナ `frames` 作成  
  → アクセスレベル: **Blob（匿名読み取り可）**  
  　フロントが画像URLを直接表示するため、パブリック読み取りが必要
- [ ] 環境変数を `.env.local` に追加（下記参照）
- [ ] 同じ変数を Container Apps（Web / Worker 両方）にも追加

```env
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=xxx;AccountKey=xxx;EndpointSuffix=core.windows.net
AZURE_STORAGE_BLOB_ENDPOINT=https://xxx.blob.core.windows.net
```

---

## 1. パッケージ追加

- [x] `pnpm add @azure/storage-blob`

---

## 2. 型定義更新

- [x] `lib/types.ts` — `FrameAsset` 型追加

---

## 3. Blob Storage ライブラリ

- [x] `lib/blob-storage.ts` — BlobServiceClient ラッパー
  - `getBlobUrl(container, blobName)` — 公開URL生成
  - `uploadFile(container, blobName, data, contentType)` — シードスクリプト用

---

## 4. frame_assets リポジトリ

- [x] `lib/frame-asset-repository.ts`
  - `searchFrameAssets(scenarioTag)` — scenario_tags を検索、Photo[] を返す

---

## 5. カメラ検索実装（mock-camera.ts の差し替え）

- [x] `lib/camera-search.ts` — mock-camera.ts を置き換える
  - 入力テキスト（location + summary）からシナリオタグを判定
  - `frame_assets` テーブルを検索して Photo[] を返す
  - 戻り値インターフェースは mock-camera.ts と同一

---

## 6. エージェント更新

- [x] `lib/mock-agent.ts` — `fetchCameraImagesMock` → `searchCameraFrames` に差し替え
  - `analyzeImagesMock` / `generateReportContent` は引き続きモック
  - Blob URL に `ceiling` / `escalator` の文字列が含まれるパス設計により mock-vision.ts はそのまま動く

---

## 7. マイグレーション更新

- [x] `scripts/migrate.ts` — `frame_assets` / `video_assets` テーブル追加

```sql
-- frame_assets: Phase 2〜でメイン
--   video_asset_id は NULL可 (Phase 5で動画対応時に使用)
--   scenario_tags は JSON配列文字列 e.g. '["ceiling","board-fall"]'

-- video_assets: Phase 5後に使用
--   今は IF NOT EXISTS で空テーブルだけ作っておく
```

---

## 8. シードスクリプト

- [x] `scripts/seed-frames.ts` — デモ用フレーム画像を Blob にアップロードし frame_assets に登録
  - `public/mock/` の 4 枚を Blob `frames/` に配置
  - Blob パスに `ceiling` / `escalator` を含めることで mock-vision.ts の URL判定が継続動作
  - 冪等性あり（同じIDで2回実行しても重複しない）

```
Blob パス設計:
  frames/store-001/camera-ceiling-3f-south/demo/frame-0001.png  (ceiling-board-fall-1.png)
  frames/store-001/camera-ceiling-3f-south/demo/frame-0002.png  (ceiling-board-fall-2.png)
  frames/store-001/camera-escalator-b1-down/demo/frame-0001.png (escalator-acrylic-fall-1.png)
  frames/store-001/camera-escalator-b1-down/demo/frame-0002.png (escalator-acrylic-fall-2.png)
```

- [x] `package.json` — `seed:frames` スクリプト追加

---

## 9. 動作確認（ユーザー対応）

- [x] `.env.local` に Storage 接続文字列を設定
- [x] `pnpm migrate` で `frame_assets` / `video_assets` テーブル作成
- [x] `pnpm seed:frames` でフレーム画像アップロード＋DB登録
- [x] Azure Portal で Blob に 4 枚のファイルが存在することを確認
- [x] ローカル Worker では `.env.local` 読み込み後、画像URL付きドラフト生成を確認済み
- [x] ローカル生成データは本番Webからも画像表示可能
- [~] フォームから「天井ボード」シナリオを送信 → ローカルでは確認済み。本番Workerでは未反映（既知課題）
- [~] フォームから「エスカレーター」シナリオを送信 → 同上
- [x] 概要に両キーワードを含まない場合 → 写真なし（空配列）であることを確認

### 既知課題（深追いしない）

本番Webから新規作成した場合、Worker側で画像検索経路に入っていない可能性あり。
原因候補: 本番Workerのenv不足 / 古いrevisionのまま / searchCameraFrames経路に入っていない。
**本番機能としては将来AI/video-frame-extractor側で再設計予定のため、現時点では深追いしない。**
詳細: `docs/phase2/issue.md`

---

## 10. Container Apps デプロイ（ユーザー対応）

- [x] Blob Storage + frame_assets 導線はローカルおよびBlobURL直開きで確認済み
- [~] Worker イメージ再ビルド・プッシュ（`@azure/storage-blob` 追加分）→ Phase 3デプロイ時に合わせて実施予定
- [~] Web / Worker 両方に Storage 環境変数追加 → Phase 3デプロイ時に合わせて実施予定

---

## 将来フェーズとの接続

| Phase | 変更内容 | 触るファイル |
|---|---|---|
| Phase 3 | Azure AI Vision で画像解析 | `lib/mock-vision.ts` を差し替え |
| Phase 4 | Azure OpenAI で報告書生成 | `lib/report-template.ts` / `lib/mock-agent.ts` を差し替え |
| Phase 5 | 動画→フレーム自動抽出 Worker 追加 | `worker/video-frame-extractor.ts` NEW、`frame_assets` は変更なし |

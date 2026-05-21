はい、その前提なら **Phase 2から「将来動画に差し替えられる画像アセット設計」にしておく** のが一番いいです。

結論からいうと、今はこう考えるのがよさそうです。

```text
Phase 2〜5まで:
  手元ffmpegで動画からフレーム画像を抽出
  ↓
  Azure Blob Storage に画像だけ置く
  ↓
  SQL の camera_assets / frame_assets から検索
  ↓
  写真台帳に反映

Phase 5後:
  サンプル動画を Azure Blob Storage に保存
  ↓
  video-frame-extractor Worker / Job が ffmpeg でフレーム抽出
  ↓
  抽出画像を Blob に保存
  ↓
  frame_assets にメタデータ保存
  ↓
  既存の report-agent-worker は frame_assets を検索するだけ
```

ポイントは、**report-agent-worker に動画処理を持たせない** ことです。これは前の方針とも一致していて、`Worker = 動画処理・ファイル処理`、`Agent = 判断・要約・報告書生成` に分けるのが安全です。

## 最終形の構成

将来的な動画込み構成はこうです。

```text
Blob Storage
  videos/
    store-001/
      camera-escalator-b1-down/
        sample-2026-05-21-1015.mp4

  frames/
    store-001/
      camera-escalator-b1-down/
        sample-2026-05-21-1015/
          frame-0000.jpg
          frame-0001.jpg
          frame-0002.jpg

  camera-images/
    store-001/
      camera-escalator-b1-down/
        manual-frame-001.jpg

Azure SQL
  video_assets
  frame_assets
  camera_assets optional

Worker / Job
  video-frame-extractor
    - 動画からフレーム抽出
    - frames/ に保存
    - frame_assets に保存

  report-agent-worker
    - reportId から事故情報取得
    - frame_assets / camera_assets 検索
    - 写真台帳候補を作る
    - ai_draft_json 更新
```

Azure Blob Storage は画像・動画のような非構造データ保存に向いているので、動画本体・抽出フレーム・写真台帳用画像は Blob に置き、検索用メタデータは SQL に置くのが扱いやすいです。以前の構成案でも、Blob単体に検索責務を持たせず、Blob + メタデータDB に分ける方針でした。

## Phase 2時点でのデータモデル

今から `camera_assets` だけで作るより、将来を考えるなら **`frame_assets` 中心** にしておくのがおすすめです。

### `video_assets`

これは Phase 5 後で追加してもOKです。

```sql
CREATE TABLE video_assets (
  id NVARCHAR(80) NOT NULL PRIMARY KEY,
  facility_id NVARCHAR(80) NOT NULL,
  camera_id NVARCHAR(80) NOT NULL,
  camera_name NVARCHAR(200) NOT NULL,
  location_name NVARCHAR(200) NOT NULL,
  floor_label NVARCHAR(50) NULL,

  recorded_start_at DATETIME2 NOT NULL,
  recorded_end_at DATETIME2 NOT NULL,

  blob_container NVARCHAR(100) NOT NULL,
  blob_name NVARCHAR(500) NOT NULL,

  duration_seconds INT NULL,
  status NVARCHAR(50) NOT NULL DEFAULT 'uploaded',
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```

`status` はこんな感じです。

```text
uploaded
extracting_frames
frames_ready
failed
```

### `frame_assets`

Phase 2 から先に作るならこっちです。

```sql
CREATE TABLE frame_assets (
  id NVARCHAR(80) NOT NULL PRIMARY KEY,

  video_asset_id NVARCHAR(80) NULL,

  facility_id NVARCHAR(80) NOT NULL,
  camera_id NVARCHAR(80) NOT NULL,
  camera_name NVARCHAR(200) NOT NULL,
  location_name NVARCHAR(200) NOT NULL,
  floor_label NVARCHAR(50) NULL,

  captured_at DATETIME2 NOT NULL,
  frame_offset_seconds INT NULL,
  frame_index INT NULL,

  blob_container NVARCHAR(100) NOT NULL,
  blob_name NVARCHAR(500) NOT NULL,

  scenario_tags NVARCHAR(MAX) NULL,
  description NVARCHAR(MAX) NULL,

  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```

Phase 2では `video_asset_id` は `NULL` でOKです。

手元ffmpegで抜き出した画像を、あたかも動画由来のフレームとして登録しておけば、後から Azure 側で動画→フレーム抽出に変えても `report-agent-worker` 側の検索ロジックはほぼ変えなくて済みます。

## Phase 2ではこう運用する

サンプル動画をローカルで撮る。

```text
sample-escalator-guard-panel.mp4
```

手元で ffmpeg 抽出。

```bash
ffmpeg -i sample-escalator-guard-panel.mp4 -vf fps=1/2 frame-%04d.jpg
```

つまり **2秒に1枚** くらいで十分です。デモ用途なら、事故時刻周辺の10〜20枚くらいあればかなり見せられます。

それを Blob に置く。

```text
frames/
  store-001/
    camera-escalator-b1-down/
      sample-escalator-guard-panel/
        frame-0001.jpg
        frame-0002.jpg
        frame-0003.jpg
```

SQL にはこう登録。

```json
{
  "id": "frame_escalator_0001",
  "video_asset_id": null,
  "facility_id": "store-001",
  "camera_id": "camera-escalator-b1-down",
  "camera_name": "B1下りエスカレーター監視カメラ",
  "location_name": "1FからB1F 下りエスカレーター付近",
  "captured_at": "2026-05-21T10:15:02Z",
  "blob_container": "frames",
  "blob_name": "store-001/camera-escalator-b1-down/sample-escalator-guard-panel/frame-0001.jpg",
  "scenario_tags": ["escalator", "guard-panel", "customer-contact"],
  "description": "三角ガード板付近の状況を確認できるフレーム"
}
```

## Phase 5後の差し替え

あとで Azure 側に動画を保存したら、追加するのはこの処理だけです。

```text
動画アップロード
  ↓
video_assets に登録
  ↓
video-frame-extractor が起動
  ↓
ffmpeg で事故時刻周辺のフレーム抽出
  ↓
Blob frames/ に保存
  ↓
frame_assets に登録
```

Blob作成をトリガーにするなら Azure Event Grid が使えます。Blob Storage の作成・削除などのイベントは Event Grid 経由で購読でき、画像や動画処理、検索インデックス作成、ファイル指向ワークフローが代表的な用途として挙げられています。([Microsoft Learn][1])

ただ、ハッカソン実装では Event Grid まで入れるより、最初は **手動API or Service Bus 経由** の方が安全です。

```text
POST /api/admin/extract-video-frames
  ↓
Service Bus queue: video-frame-extraction-requests
  ↓
video-frame-extractor worker
```

Container Apps Jobs はキューメッセージを処理するイベント駆動ジョブとして使えるので、動画1本ごとのフレーム抽出処理と相性がいいです。([Microsoft Learn][2])

## 最終的な責務分担

ここを分けておくと後でかなり楽です。

```text
report-agent-worker
  事故報告生成担当
  - reportIdを受け取る
  - 事故情報を読む
  - frame_assetsを検索する
  - 写真台帳候補を作る
  - AIドラフトを保存する

video-frame-extractor
  動画処理担当
  - videoAssetIdを受け取る
  - Blobからmp4を読む
  - ffmpegでフレーム抽出
  - Blobにjpg保存
  - frame_assetsを作る

mock/seed scripts
  Phase 2〜5までの代替担当
  - ローカル抽出済み画像をBlobへアップロード
  - frame_assetsにメタデータ登録
```

## Blobの置き方

おすすめはこれです。

```text
videos/
  {facilityId}/{cameraId}/{videoAssetId}.mp4

frames/
  {facilityId}/{cameraId}/{videoAssetId}/frame-{timestamp-or-index}.jpg

report-assets/
  {reportId}/photo-ledger/{frameAssetId}.jpg optional
```

`report-assets` は必須ではないです。元画像をそのまま参照するなら不要。

ただし、報告書に添付する画像を「確定時点の証跡」として固定したいなら、`report-assets` にコピーしておくのはアリです。

```text
元画像:
frames/store-001/camera-01/video-001/frame-0004.jpg

確定報告書用:
report-assets/report_xxx/photo-ledger/01.jpg
```

事故報告は業務文書なので、**後から元Blobが差し替わっても確定報告書の写真が変わらない** 方が安心です。

## 動画そのものをAIに見せるか問題

今回の方針では、当面は **動画をAIに直接渡さない** 方がいいです。

理由はシンプルで、

```text
動画処理は重い
アップロード/読み込み/タイムアウトで詰まりやすい
モデル入力の扱いが複雑になる
デモで失敗しやすい
```

ので、まずは

```text
動画
  ↓
フレーム画像
  ↓
画像候補選択
  ↓
写真台帳
  ↓
事故報告生成
```

が安全です。

将来 Azure OpenAI Vision や Foundry Models を使う場合も、動画そのものではなく **選ばれたフレーム画像を数枚渡す** 形にすれば十分見栄えします。Phase 1〜2の当初設計でも、画像解析は Azure OpenAI / Foundry Models の vision 対応モデルに画像URLまたは画像データを渡して structured JSON を返させる方針でした。

## ライフサイクル管理も考えておく

動画はサイズが大きいので、あとでコストが気になります。

Blob Storage にはライフサイクル管理ポリシーがあり、利用パターンに応じて低コストなアクセス層へ移動したり、期限後に削除したりできます。([Microsoft Learn][3])

デモ・PoCならこんな運用で十分です。

```text
videos/
  30日後にCool tier
  90日後に削除

frames/
  30日後に削除 or report確定済みなら保持

report-assets/
  確定報告書の証跡なので保持
```

## 今のPhase 2でやっておくべき設計判断

ここだけ押さえればOKです。

```text
1. camera_assets より frame_assets 中心にする
2. video_asset_id は nullable にする
3. ローカルffmpeg抽出画像も frame_assets として登録する
4. report-agent-worker は frame_assets だけを見る
5. 動画処理は将来 video-frame-extractor に分離する
6. report-assets は確定報告書用の固定コピーとして検討する
```

なので、Phase 2 の実装名としては、個人的には `camera_assets` よりも **`frame_assets`** を先に作るのがよさそうです。

```text
今:
手元で抜いた画像 = frame_assets

後:
Azureで動画から抜いた画像 = frame_assets
```

この形にしておくと、Phase 5後に動画対応を入れても、写真台帳・報告書生成・フロント表示の大部分を触らずに済みます。

[1]: https://learn.microsoft.com/ja-jp/azure/storage/blobs/storage-blob-event-overview?utm_source=chatgpt.com "Azure Blob Storage イベントへの対応 | Microsoft Learn"
[2]: https://learn.microsoft.com/en-us/azure/container-apps/tutorial-event-driven-jobs?utm_source=chatgpt.com "Tutorial: Deploy an Event-Driven Job with Azure Container Apps"
[3]: https://learn.microsoft.com/en-us/azure/storage/blobs/lifecycle-management-policy-configure?utm_source=chatgpt.com "Configure a lifecycle management policy - Azure Blob Storage"


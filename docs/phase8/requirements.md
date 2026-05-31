いいですね。Phase 8 はこの3つに分けるのがかなり自然です。特に **2の削除バグは小さく直せるけど重要度が高い**、**1のアップロードは実務感が一気に出る**、**3は焦ってAI化しすぎるより検索設計を段階化した方が安全** だと思います。

なお、さっきこちらで画像検索APIの実装に入りかけましたが、今の要件を見ると先に方針整理した方がよさそうです。いったん「実装を進める」より「Phase 8の切り方」を優先します。

## まず直すべき順番

おすすめはこの順番です。

```text
Phase 8.1 写真削除の反映バグ修正
Phase 8.2 現地写真アップロード
Phase 8.3 画像検索・写真反映の高度化
```

## 1. 写真削除機能の修正

これは原因がかなりはっきりしています。

現在、保存時に送っている `photos` は `editedReport.photos.map(...)` ですが、中身は `id` と `photoLocationName` だけです。
一方 API 側の `mergePhotos()` は **current.photos を起点に map して、patch があるものだけ上書き** しています。つまり、UI側で削除して `patches` から消えても、API側では current 側の写真が残ります。 

ここは `mergePhotos` をやめて、PATCHで送られてきた `photos` を「新しい写真台帳の正」として扱うのが良いです。

```ts
const updatedPhotos = updates.photos
  ? replacePhotos(current.photos, updates.photos)
  : current.photos;
```

ただし `photoLocationName` しか送っていない現状のままだと追加写真や削除後の並び替えに弱いので、フロント側は `Photo` に必要な表示情報を全部送るべきです。

```ts
photos: editedReport.photos.map((p) => ({
  id: p.id,
  imageUrl: p.imageUrl,
  cameraName: p.cameraName,
  capturedAt: p.capturedAt,
  photoLocationName: p.photoLocationName,
  blobContainer: p.blobContainer,
  blobName: p.blobName,
  caption: p.caption,
  relevanceScore: p.relevanceScore,
  observedFacts: p.observedFacts,
}))
```

これで「削除」「並び替え」「追加」が全部同じ保存経路に乗ります。写真の変更を差分学習に使うかは別問題ですが、少なくとも確定レポートには反映されます。

## 2. 写真アップロード機能

これは入れた方がいいです。現場写真は事故報の実務ではかなり自然です。カメラ映像は「事故発生時の証跡」、現地写真は「事後確認・損傷箇所・対応状況の証跡」なので、役割が違います。

最小実装ならこうです。

```text
写真台帳タブ
  -> 「現地写真を追加」
  -> file input
  -> POST /api/reports/:id/photos/upload
  -> Blob Storage に保存
  -> Photo を返す
  -> editedReport.photos に append
  -> 保存ボタンで user_draft_json に反映
```

アップロード先は既存の `frames` とは分けて、たとえば `report-photos` container にするのが良いです。カメラフレームと現地アップロード写真はライフサイクルも意味も違うので、Blob container も分けたいです。

`Photo` 型は現状でも `imageUrl`, `blobContainer`, `blobName` を持てるので、アップロード写真もAI評価用SASに乗せられます。現状の `Photo` は表示URLとSAS生成元を持つ設計になっています。

追加するなら、型にはこれくらい足すと後で効きます。

```ts
export type PhotoSourceType = "camera_frame" | "uploaded_photo";

export type Photo = {
  id: string;
  imageUrl: string;
  cameraName: string;
  capturedAt: string;
  photoLocationName: string;
  sourceType?: PhotoSourceType;
  blobContainer?: string;
  blobName?: string;
  caption?: string;
  relevanceScore?: number;
  observedFacts?: string[];
};
```

アップロード写真の `cameraName` は `"現地アップロード"`、`capturedAt` はアップロード時刻か撮影時刻未取得なら `new Date().toISOString()` でよさそうです。Exif撮影日時は今回は無理にやらなくていいです。デモで事故りやすいです。

## 3. 写真反映の高度化

ここはかなり大事で、いきなり「AIでよしなに検索」へ行くより、**検索候補生成と画像評価を分ける** のが良いです。

現状は、`searchCameraFrames()` が `ceiling` / `escalator` のような固定キーワードで scenario tag を推定し、それ以外は施設内検索に fallback します。転倒などは tag 化されず、施設全体の fallback になりやすい状態です。
さらに `frame_assets` 検索は `facility_id` と任意の `scenario_tags like` だけで、`occurredAt` 近傍検索やカメラ位置類似度はありません。

なので改善の本命はこれです。

```text
入力文言
  -> 検索クエリ抽出
  -> DB候補検索
  -> Vision評価
  -> 写真台帳採用
```

### 段階1: ルールベース強化

まずはここで十分効果が出ます。

追加したい tag 推定:

```ts
const TAG_RULES = [
  { tag: "ceiling", keywords: ["天井", "天板", "ボード"] },
  { tag: "escalator", keywords: ["エスカレーター", "エスカレータ"] },
  { tag: "fall", keywords: ["転倒", "倒れ", "つまずき", "滑り"] },
  { tag: "rescue", keywords: ["救助", "起き上がれない", "介助"] },
  { tag: "water-leak", keywords: ["漏水", "水漏れ", "雨漏り"] },
  { tag: "glass-damage", keywords: ["ガラス", "破損", "割れ"] },
];
```

神田事務所フレームには `fall`, `person-fall`, `unable-to-stand`, `assistance`, `rescue`, `転倒`, `起き上がれない`, `救助` などの tag が既に入っているので、ここを使わないのはもったいないです。

### 段階2: 時刻近傍検索

ここが一番「入力文言に応じた画像検索」っぽく見えます。

今は古い順 `captured_at asc top 8` ですが、事故発生時刻 `occurredAt` があるので、以下に変えたいです。

```sql
order by abs(datediff(second, captured_at, @occurredAt)) asc
```

検索条件としては、

```text
facilityId一致
+
scenarioTags一致があれば優先
+
occurredAtに近い順
```

が良いです。

これだけで、デモの納得感がかなり上がります。AI以前に「その時間帯のカメラを探してる感」が出ます。

### 段階3: 候補を多めに取り、Visionで絞る

今は `top 8` をDBで取って、その後AI評価しています。ただ、検索が粗い状態で8件だけに絞ると、良い画像が候補に入らないリスクがあります。

おすすめは、

```text
DB候補: 24〜40件
Vision評価: relevanceScore / shouldUseInLedger
最終採用: 最大8件
```

です。

現状の画像評価AIは `relevanceScore`, `shouldUseInLedger`, `observedFacts`, `suggestedCaption` を返せる設計なので、ここはもう土台があります。評価結果は `Photo` に反映され、関連度順に並び替えられます。

### 段階4: 「検索理由」をUIに出す

これはデモ映えします。

写真台帳タブや生成中画面に、

```text
検索条件:
- 施設: 神田事務所
- 推定タグ: 転倒 / 救助
- 発生時刻: 2026-05-28 09:04 周辺
- 候補: 24件
- 採用: 4件
```

みたいに出すと、AIがブラックボックスじゃなくなります。

## Phase 8 の設計案

僕ならこう切ります。

### Phase 8.1: 写真削除・並び替え・保存の正常化

目的は、写真台帳を `Report.photos` の配列として正しく保存すること。

やること:

```text
- PATCH時に photos をフル配列で送る
- API側で current.photos.map merge をやめる
- 削除・並び替え・名称変更が user_draft_json に反映される
- 確定後 preview にも反映されることを確認
```

ここは小さく、すぐやるべき。

### Phase 8.2: 現地写真アップロード

目的は、カメラ画像以外を写真台帳に追加できるようにすること。

やること:

```text
- Blob container: report-photos
- POST /api/reports/:id/photos/upload
- multipart/form-data 受け取り
- content-type / size validation
- Blob upload
- Photo を返す
- 写真台帳タブで append
- 保存で user_draft_json に永続化
```

この時点では、アップロード写真をAI再評価にかけなくてもOKです。まずは「台帳に載る」ことを優先。

### Phase 8.3: 画像検索の高度化

目的は、入力文言・場所・時刻から、事故に近い候補を探せるようにすること。


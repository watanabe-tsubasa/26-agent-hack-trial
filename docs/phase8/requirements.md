#　phase8_requirements

```md: agent_1```
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

結論から言うと、**今回はJPEGを入れ直す必要は必須ではない**と思います。
ただし、**DB上の `capturedAt` が実際の映像内時刻とズレているなら、Blob画像の再アップロードではなく `frame_assets` のメタデータ再seed / update はやった方がいい**です。

今のフローでは、画像候補検索は `facilityId` と簡易tag中心で、`occurredAt` に近い画像検索はまだ入っていません。現状ドキュメントにも、`occurredAt` による時刻近傍検索はなし、`frame_assets` は `facility_id` と任意の `scenario_tags like` のみ、と整理されています。

## 僕なら今回こうします

今回は、これが一番バランス良さそうです。

```txt
1. JPEGはそのまま使う
2. frame_assets の capturedAt / frameOffsetSeconds / frameIndex を整える
3. ルールベースで T - 12s 〜 T + 15s 相当の候補を取る
4. ドラフト生成時にその候補だけAI評価する
5. AI評価結果で最大8枚に絞る
```

つまり、**事前に全JPEGをAI評価してタグ付けするのではなく、事故報作成時に絞り込まれた候補だけAI評価** が良いです。

## 入れ直しが必要か？

Blobへの画像アップロードし直しは、基本不要です。

ただし、以下なら再seedはありです。

```txt
- capturedAt が明らかにズレている
- frameIndex / frameOffsetSeconds が正しく入っていない
- scenarioTags が雑すぎて検索に使いづらい
- cameraName / locationName を変えたい
```

この場合も、画像ファイル自体はそのままでよくて、DBの `frame_assets` を更新すればOKです。Blob名が変わらないなら、`blobContainer` / `blobName` はそのまま使えます。

## 映像左上の時刻と `occurredAt` がズレる問題

ここはかなり現実的なハマりポイントです。
なので `occurredAt` を絶対視するより、**デモ用には「映像内事故時刻」を別で持つ** のが安全です。

たとえば seed 時にこういう考え方にします。

```ts
const VIDEO_START_AT = new Date("2026-05-28T09:00:00+09:00");
const FRAME_INTERVAL_SECONDS = 3;

capturedAt = VIDEO_START_AT + frameIndex * 3秒;
```

そして事故入力の `occurredAt` はユーザー入力として残しつつ、検索では多少広めに取る。

```txt
occurredAt の前後 30〜60秒から候補取得
その中から T - 12s 〜 T + 15s に近いものを優先
```

ただ、もし入力された `occurredAt` と映像内時刻がズレているなら、検索が外れます。なのでデモでは、以下のどちらかが良いです。

### 案A: seedを正す

おすすめです。

```txt
実際の動画左上時刻に合わせて frame_assets.capturedAt を再計算する
```

これなら、通常の `occurredAt` 近傍検索が自然に動きます。

### 案B: デモ用に時間オフセットを持つ

たとえば、

```ts
cameraTimeOffsetSeconds: number
```

を持って、

```txt
検索用時刻 = occurredAt + cameraTimeOffsetSeconds
```

にする案です。実運用でも「カメラ時刻ズレ」はあり得るので、設計としては結構リアルです。ただ、今回のプロトタイプでは少し実装が重くなります。

なので、今回は **案A: seedを正す** が良さそう。

## 事前AIタグ付けはやるべきか？

今回は、**全画像への事前AIタグ付けはやらなくていい**と思います。

理由は費用だけではなく、設計上もそこまで必要ないからです。

今回の神田事務所フレームは3秒間隔で抽出済みで、事故報作成時に必要なのはおそらく最大10〜30枚程度の候補です。全JPEGにVision評価をかけるより、まず時刻・施設・カメラで絞って、その候補だけ評価する方が筋がいいです。

```txt
悪い案:
全フレームを事前にAI評価
  -> コスト増
  -> seedが遅い
  -> プロンプト変更時に再評価が必要
  -> 事故入力との文脈がない評価になる

良い案:
事故入力ごとに候補を絞る
  -> 10〜30枚だけAI評価
  -> 入力文言と照らして評価できる
  -> 採用理由を事故報文脈で出せる
```

特に重要なのは、**画像単体で良い写真** と **その事故報に必要な写真** は違うことです。
たとえば「人が倒れているか」だけなら画像単体評価でもできますが、「入力文言に対してこの写真が報告書に必要か」は事故概要とセットで見た方が良いです。

## ただし軽い事前タグ付けはアリ

AIではなく、seed時にルールでタグを足すのはアリです。

たとえば神田事務所デモなら、全フレームに共通でこれを付ける。

```ts
scenarioTags: [
  "office",
  "open-space",
  "kanda-office",
  "fall",
  "person-fall",
  "unable-to-stand",
  "assistance",
  "rescue",
  "事務所",
  "オープンスペース",
  "転倒",
  "起き上がれない",
  "救助",
]
```

これは既存のseed方針とも相性が良いです。以前のseedでも、神田事務所フレームには `fall`, `person-fall`, `unable-to-stand`, `assistance`, `rescue`, `転倒`, `起き上がれない`, `救助` などを入れる設計でした。

ただし、フレームごとに、

```txt
このフレームは事故前
このフレームは事故瞬間
このフレームは事故後
```

まで手で/AIで事前タグ付けするのは、今回はやりすぎかもです。

## 今回のベスト案

僕ならこう実装します。

### 1. 再seedで時刻だけ整える

```txt
VIDEO_START_AT を実際の映像左上時刻に合わせる
FRAME_INTERVAL_SECONDS = 3
capturedAt = VIDEO_START_AT + index * 3秒
```

Blob画像は再アップロード不要。
`frame_assets` の `captured_at`, `frame_offset_seconds`, `frame_index`, `scenario_tags` を更新。

### 2. 検索は時刻近傍 + tag

```ts
type SearchFrameAssetsInput = {
  facilityId: string;
  occurredAt: string;
  scenarioTags: string[];
  beforeSeconds: number; // 12 or 15
  afterSeconds: number;  // 15
  limit: number;         // 10 or 24
};
```

SQLイメージはこれです。

```sql
where facility_id = @facilityId
  and captured_at between @from and @to
order by
  case when scenario_tags like @tag then 0 else 1 end,
  abs(datediff(second, captured_at, @occurredAt)) asc
```

### 3. 候補は10枚固定でもよい

今回のデモなら、最初はこれで十分です。

```txt
T - 12s
T - 9s
T - 6s
T - 3s
T
T + 3s
T + 6s
T + 9s
T + 12s
T + 15s
```

ただし、DB上は3秒ぴったりのフレームがない可能性もあるので、実装は「その時刻に最も近いフレーム」を取る方が安全です。

### 4. AI評価はドラフト生成時だけ

```txt
10枚候補
  -> VLM評価
  -> category / score / visibleEvidence / reason
  -> アプリ側で最大8枚に選定
```

この構成が一番プロダクトとして壊れにくいです。

## カテゴリ設計はかなり良い

貼ってくれたこれ、かなり良いです。

```ts
type FrameEvaluation = {
  framePath: string;
  offsetSec: number;
  score: number;
  category:
    | "before_incident"
    | "incident_moment"
    | "after_incident"
    | "site_condition"
    | "not_useful";
  visibleEvidence: string[];
  reason: string;
  recommendedForReport: boolean;
};
```

ただ、実装では `framePath` より `photoId` の方が良いです。

```ts
type FrameEvaluation = {
  photoId: string;
  offsetSec: number | null;
  score: number;
  category:
    | "before_incident"
    | "incident_moment"
    | "after_incident"
    | "site_condition"
    | "not_useful";
  visibleEvidence: string[];
  reason: string;
  recommendedForReport: boolean;
  privacyRisk?: string;
};
```

`photoId` にしておくと、既存の `Photo.id` と紐づけやすいです。

## Phase 8.3 の現実的な着地

今回の実装範囲なら、こう切るのが良さそうです。

```txt
Phase 8.3.1
- seedの capturedAt を実映像時刻に合わせる
- 転倒/救助系の scenarioTags を整える

Phase 8.3.2
- searchCameraFrames を複数tag + 時刻近傍検索にする
- T-12s〜T+15s の10枚を候補にする

Phase 8.3.3
- その10枚を既存の画像評価AIに渡す
- relevanceScore / shouldUseInLedger / caption / observedFacts を反映

Phase 8.3.4
- category付き評価に拡張
- before / incident / after / site_condition の役割別に最大8枚を選ぶ
```

## 最終判断

今回はこれでいきたいです。

```txt
画像は入れ直さない
ただし frame_assets の capturedAt は再seedで正す

AI事前タグ付けはしない
ただし seed時のルールベースタグは整える

検索はルールベース
ドラフト生成時に候補10枚だけAI評価

将来的に必要なら
高スコア時刻周辺を0.5〜1秒間隔で追加抽出
```

これが、コスト・実装量・デモ説得力のバランスが一番いいです。
「AIが全部探した」よりも、**システムが時刻近傍で候補を出し、AIが報告書観点で選定理由を付ける** の方が、非エンジニアにも伝わりやすいと思います。
```

```md: user
大枠は良さそうです。ただ、イオンモール神田と神田事務所で状況が異なり、イオンモール神田は生成AIで生成した4枚の画像のみ、神田事務所は先ほど説明した通りの画像を用意しています。なので、イオンモール神田は時刻近傍での検索は含めず、4枚の画像をそれぞれ評価。神田事務所は前述のロジック、というように分けたいです
```

```md: agent_2
はい、その分岐でいくのがかなり良いです。
むしろ **施設ごとに画像取得戦略を変える** 方が自然です。

今回の前提だと、こう分けるのが一番きれいです。

```txt
イオンモール神田
  - 生成AIで作った固定4枚
  - 時刻近傍検索なし
  - 4枚すべてを画像評価AIに渡す
  - shouldUseInLedger / caption / reason を付ける

神田事務所
  - 動画から抽出した時系列JPEG
  - occurredAt 周辺の T-12s〜T+15s を候補化
  - 候補10枚を画像評価AIに渡す
  - 最大8枚に絞る
```

## 設計としては `facilityId` ごとの strategy にするのがよさそう

`searchCameraFrames(input)` の中に if 文をベタ書きするより、画像検索戦略を分けたいです。

```ts
type CameraSearchStrategy =
  | "fixed_generated_images"
  | "time_window_frames";
```

そして施設定義側に持たせるか、専用関数で判定します。

```ts
function resolveCameraSearchStrategy(facilityId: string): CameraSearchStrategy {
  if (facilityId === "aeon-mall-kanda") return "fixed_generated_images";
  if (facilityId === "kanda-office") return "time_window_frames";
  return "fixed_generated_images";
}
```

今のフローでは `POST /api/reports` 時に Cookie のサイトから `facilityId` を強制注入していて、この `facilityId` が後続の画像候補検索条件になります。
なので、この分岐点はかなり自然です。

## イオンモール神田の扱い

イオンモール神田は、時刻検索を入れない方がいいです。

理由はシンプルで、4枚が「特定事故シナリオ用の代表画像」なので、時刻軸の意味が薄いからです。
ここでは検索というより、

```txt
施設 + 入力文言に合う固定候補セットを取得
```

ですね。

実装イメージはこれです。

```ts
async function searchFixedGeneratedImages(input: CreateReportInput): Promise<Photo[]> {
  if (!input.facilityId) return [];

  const tags = detectScenarioTags(input);

  const tagged = await searchFrameAssetsByTags({
    facilityId: input.facilityId,
    tags,
    limit: 8,
  });

  if (tagged.length > 0) return tagged;

  return searchFrameAssets({
    scenarioTag: null,
    facilityId: input.facilityId,
  });
}
```

イオンモール側は候補4枚しかないなら、最終的には4枚全部を返してOKです。

```txt
候補4枚
  -> AI評価
  -> 4枚すべてに caption / reason / observedFacts
  -> shouldUseInLedger=false があれば除外
```

ただ、デモ的には4枚しかないので、除外しすぎると台帳が寂しくなります。
なので、イオンモールは `shouldUseInLedger=false` でも UI 上は「AIは低関連と判断」くらいにして、最終候補には残す選択肢もありです。

## 神田事務所の扱い

神田事務所は、前述のロジックで良いです。

```txt
occurredAt = T
T - 12s
T - 9s
T - 6s
T - 3s
T
T + 3s
T + 6s
T + 9s
T + 12s
T + 15s
```

ただし、実装上は「ちょうどその秒の画像」を探すより、

```txt
各target offsetに最も近いframeを1枚ずつ取る
```

の方が安全です。

```ts
const targetOffsets = [-12, -9, -6, -3, 0, 3, 6, 9, 12, 15];
```

DBの `capturedAt` が正しければ、各 target time に最も近いフレームを選ぶ。

```ts
targetTime = occurredAt + offsetSec
```

その後、

```txt
候補10枚
  -> AI評価
  -> category / relevanceScore / shouldUseInLedger / reason
  -> 最大8枚
```

にします。

## 名前としてはこう分けたい

ファイル構成はこうすると見通しが良いです。

```txt
lib/agent/
  camera-search.ts
  camera-search-strategy.ts
  frame-asset-repository.ts
  photo-selection.ts
```

責務はこう。

```txt
camera-search.ts
  searchCameraFrames(input) の入口

camera-search-strategy.ts
  facilityId から検索戦略を決める

frame-asset-repository.ts
  DBからframe_assetsを取るだけ

photo-selection.ts
  AI評価結果から最大8枚を選ぶ
```

## 型はこうしたい

```ts
type CameraSearchStrategy = "fixed_generated_images" | "time_window_frames";

type CameraSearchPlan = {
  strategy: CameraSearchStrategy;
  facilityId: string;
  tags: string[];
  occurredAt?: string;
  beforeSeconds?: number;
  afterSeconds?: number;
  intervalSeconds?: number;
  limit: number;
};
```

検索結果には、あとでUIに出せるように metadata を持たせると良いです。

```ts
type CameraSearchResult = {
  photos: Photo[];
  strategy: CameraSearchStrategy;
  searchSummary: {
    label: string;
    candidateCount: number;
    tags: string[];
    timeWindow?: {
      from: string;
      to: string;
      intervalSeconds: number;
    };
  };
};
```

これがあると生成中画面や写真タブで、

```txt
神田事務所 2階カメラから、事故時刻前後27秒の候補10枚を確認しました。
```

とか、

```txt
イオンモール神田の事故シナリオ画像4枚を確認しました。
```

が出せます。デモの説得力が段違いです。ここ、地味においしいです。

## AI評価プロンプトも strategy で少し変えると良い

同じ画像評価AIでも、文脈は分けたいです。

### イオンモール神田

```txt
これらは事故シナリオを再現した固定候補画像です。
時刻の前後関係は重視せず、事故報告書に添付する画像として、
事故内容との関連性、現場状況、破損・落下・接触などの視認性を評価してください。
```

### 神田事務所

```txt
これらは事故発生時刻の前後から抽出した時系列フレームです。
事故前、事故瞬間、事故後、現場状況のどれに該当するかを分類し、
報告書に必要な役割ごとに評価してください。
```

最初はプロンプト分岐までやらなくてもいいですが、`strategy` を渡せる設計にしておくと後で拡張しやすいです。

## 実装順

僕ならこうです。

```txt
1. facilityId ごとの search strategy を追加
2. イオンモール神田: 固定4枚取得
3. 神田事務所: 時刻近傍10枚取得
4. 既存の画像評価AIに候補を渡す
5. UIに「検索方法」と「AI評価理由」を表示
```

この順番が良いです。

特に最初から高度な `photo-selection.ts` を作り込みすぎず、まずは、

```txt
イオンモール神田は4枚
神田事務所は10枚
それをAI評価
```

まで到達するのが良さそうです。

## 最終方針

今回の Phase 8.3 はこう定義するときれいです。

```txt
Phase 8.3 写真候補検索の施設別最適化

- イオンモール神田:
  生成AIで作成した固定画像4枚を候補として評価する

- 神田事務所:
  事故発生時刻を基準に T-12s〜T+15s の10枚を候補として評価する

- 共通:
  候補画像を画像評価AIに渡し、報告書添付に適した写真を理由付きで選定する
```

## 神田事務所の画像について

`/public/generated-frames/kanda-office/frame-001.jpg`: 2026-05-26 15:05:21 JST
`/public/generated-frames/kanda-office/frame-002.jpg`: 2026-05-26 15:05:24 JST
///
`/public/generated-frames/kanda-office/frame-404.jpg`: 2026-05-26 15:25:30 JST

まで存在。

### タグづけについて

```md
なるほど、それなら **15:20:36 JST を神田事務所デモのメイン事故時刻 T** として扱うのが良さそうです。

基準が、

```txt
frame-001 = 2026-05-26 15:05:21 JST
3秒間隔
```

なので、`15:20:36` はこうなります。

```txt
15:20:36 - 15:05:21 = 15分15秒 = 915秒
915 / 3 = 305
frameIndex = 305 + 1 = 306
```

つまり、

```txt
T = frame-306.jpg
```

です。

## T-12s〜T+15s の10枚

今回のロジックだと、写真候補はこの10枚になります。

```txt
T - 12s: frame-302.jpg / 15:20:24
T -  9s: frame-303.jpg / 15:20:27
T -  6s: frame-304.jpg / 15:20:30
T -  3s: frame-305.jpg / 15:20:33
T      : frame-306.jpg / 15:20:36
T +  3s: frame-307.jpg / 15:20:39
T +  6s: frame-308.jpg / 15:20:42
T +  9s: frame-309.jpg / 15:20:45
T + 12s: frame-310.jpg / 15:20:48
T + 15s: frame-311.jpg / 15:20:51
```

ここを候補としてAI評価に渡すのが良いです。

## 他の転倒が点在しているなら、seedタグは分けた方がいい

ここ大事です。

全404枚に対して、

```ts
["fall", "rescue", "起き上がれない", "救助"]
```

を一律で付けると、タグ検索の意味が薄くなります。
他の転倒も混ざるなら、神田事務所の全フレーム共通タグは控えめにして、**メイン事故周辺だけに強いタグを付ける** のが良さそうです。

## おすすめのタグ設計

### 全フレーム共通

```ts
[
  "office",
  "open-space",
  "kanda-office",
  "事務所",
  "オープンスペース"
]
```

### メイン事故周辺だけ

たとえば `frame-302`〜`frame-311`、もしくは少し広めに `frame-298`〜`frame-320` くらいに、

```ts
[
  "fall",
  "person-fall",
  "unable-to-stand",
  "assistance",
  "rescue",
  "main-demo-incident",
  "転倒",
  "起き上がれない",
  "救助",
  "メイン事故"
]
```

を追加する。

## seed側の実装イメージ

```ts
const MAIN_INCIDENT_FRAME_INDEX = 306;

function buildScenarioTags(frameIndex: number): string[] {
  const commonTags = [
    "office",
    "open-space",
    "kanda-office",
    "事務所",
    "オープンスペース",
  ];

  const isMainIncidentWindow =
    frameIndex >= MAIN_INCIDENT_FRAME_INDEX - 4 &&
    frameIndex <= MAIN_INCIDENT_FRAME_INDEX + 5;

  if (!isMainIncidentWindow) return commonTags;

  return [
    ...commonTags,
    "fall",
    "person-fall",
    "unable-to-stand",
    "assistance",
    "rescue",
    "main-demo-incident",
    "転倒",
    "起き上がれない",
    "救助",
    "メイン事故",
  ];
}
```

`T-12s〜T+15s` ぴったりなら `306 - 4` から `306 + 5` なので、`302〜311` です。

もう少しAIに余裕を持たせたいなら、

```ts
frameIndex >= 298 && frameIndex <= 320
```

くらいでも良いです。
ただ、最終候補を10枚にするなら、検索は `302〜311` で十分です。

## デモ入力の発生日時

フォームには、日本時間で以下を入れるのがよさそうです。

```txt
2026-05-26 15:20:36
```

`datetime-local` なら秒まで入れられないUIの場合もあるので、その場合は、

```txt
2026-05-26 15:20
```

または

```txt
2026-05-26 15:21
```

になりがちです。

秒が落ちると候補が少しズレるので、可能なら `occurredAt` の入力UIを秒対応にするか、デモでは `15:20:36` を内部で使えるようにしたいです。

## 検索ロジックの考え方

他の転倒が点在しているなら、検索優先度はこうです。

```txt
1. facilityId = kanda-office
2. occurredAt の近傍 T-12s〜T+15s
3. tag は補助
4. AI評価で「転倒して起き上がれず救助者が来た」文脈に合う画像を選ぶ
```

タグより時刻を主役にした方が安全です。
タグは「検索漏れを減らす」「UIで理由を出す」補助くらいの扱いがよいです。

## まとめ

神田事務所はこう置くのが良さそうです。

```txt
メイン事故T:
2026-05-26 15:20:36 JST
frame-306.jpg

候補10枚:
frame-302.jpg 〜 frame-311.jpg

全体共通タグ:
office / open-space / kanda-office

メイン事故周辺タグ:
fall / unable-to-stand / rescue / main-demo-incident / 転倒 / 起き上がれない / 救助
```

この設計なら、他の転倒が点在していても、**発生時刻でメイン事故に寄せる → AIが報告書向けに選ぶ** という流れが安定します。
```
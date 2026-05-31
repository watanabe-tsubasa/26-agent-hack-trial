```md: user_1
やりたい機能追加が明確に3つあります

## 1. ログイン機能

- ハッカソン用に2つ管理している場所（サイト）を用意したいと思っています
  - 神田事務所サイト（イオンディライト神田本社）
  - イオンモール神田サイト（デモ用架空の店舗）
- この後の仕様とも関連しますが、神田事務所サイトは動画を撮影したのでその動画からフレームを抜き出して使用。イオンモール神田サイトは現在シーンとして設定している4種類の写真を事故報に利用します。
- ログインはデモ用に準備するID, passでそれぞれの店舗にログインできれば良いです。Azureの認証機能を使うかどうかは検討

## 2. 動画からのフレーム抜き出し機能

- 動画から事故報に利用する用のサムネイルを抜き出す機能です。
- 本来であれば該当する時間に対してカメラ側のcgiから取得したいですが、今回はできないので、ffmpegで抜き出して、画像解釈エージェントでタグをつける感じになるかと思っています
- 今回の動画はさまざまな転倒シーンを納めた感じです
- フレーム抜き出しはエージェント的に動かしたいですが、今回はwebUIをトリガーにして動かしても良いです

## 3. 事故報の検索機能

- 現在dbにあるものが全部表示されているので

## 4. 事故報生成画面のUI / UX改善

- エージェントが今何をしている（文章生成や、画像探索など）かがより具体的にわかるようにしたいです
- 演出としても、生成される事故報っぽいバックグラウンドに、アクリルガラス調のグラスモーフィズムな状況説明ダイアログが被っている感じが良いです。
- 作成ステップが順にクリアされていく感じだと全体のどの程度まで進んでいるかがわかって良いです

## 5. キャラクターの設定

- 事故報作成支援では味気ないので、「事故報お任せグッジョくん」という感じで、イオンディライトのキャラクター、グッジョくんが事故報を作ってくれるような見せ方にしたいです
- ハッカソンは多くのプロジェクトの中から印象に残ることが必要で、キャラクターがいると印象に残りやすいためです
```

```md: agent_1
めちゃくちゃ良いです。
そして「3つ」と言いつつ **5つある** の、ハッカソン終盤あるあるで好きです。全部大事です。

整理すると、これは大きく **Phase 6: デモ体験強化** として扱うのがよさそうです。

## 全体方針

今回追加したいものは、性質で分けるとこうです。

| 項目           | 目的                | 優先度 |
| ------------ | ----------------- | --: |
| ログイン / サイト切替 | 2サイトのデモ体験を分ける     |   高 |
| 動画フレーム抽出     | 神田事務所サイトのリアル感を出す  |   高 |
| 事故報検索        | 過去報告の管理画面として自然にする |   中 |
| 生成画面UI/UX改善  | デモ映え・理解しやすさ       |  最高 |
| グッジョくん演出     | 記憶に残す・世界観を作る      |  最高 |

ハッカソン観点では、技術的に重い順ではなく、**審査員に伝わる順**で進めるのが良さそうです。

---

# Phase 6 のおすすめ実装順

## Step 1: サイト概念をDB/UIに入れる

まず「ログイン」そのものより先に、アプリ内部に **site / location / facility の概念**をちゃんと持たせるのが重要です。

今すでに `facilityId` や `locationKey = store-001` があるので、これを活かします。

### サイト候補

```ts
type SiteKey = "kanda-office" | "aeon-mall-kanda";
```

### デモ用サイト

| siteKey           | 表示名         | 用途               |
| ----------------- | ----------- | ---------------- |
| `kanda-office`    | 神田事務所サイト    | 実動画から抽出したフレームを使う |
| `aeon-mall-kanda` | イオンモール神田サイト | 既存4シーン写真を使う      |

内部的には、既存の `store-001` をそのまま `aeon-mall-kanda` に寄せてもいいですが、ここで少し整理するなら：

```ts
const DEMO_SITES = [
  {
    siteKey: "kanda-office",
    facilityId: "kanda-office",
    locationKey: "kanda-office",
    name: "神田事務所サイト",
    description: "イオンディライト神田本社",
    mediaMode: "video_frames",
  },
  {
    siteKey: "aeon-mall-kanda",
    facilityId: "aeon-mall-kanda",
    locationKey: "aeon-mall-kanda",
    name: "イオンモール神田サイト",
    description: "デモ用架空店舗",
    mediaMode: "sample_scenes",
  },
] as const;
```

ここは最初からDBテーブルにしてもいいですが、ハッカソンならまず `lib/demo-sites.ts` の定数で十分です。

---

# 1. ログイン機能

## 結論：まずはデモ用ログインでよいです

Azure の認証機能は、今回は入れなくていいと思います。
理由はシンプルで、今回の主役は認証ではなく、

> サイトごとに事故報・画像候補・施設ナレッジが変わる

ことだからです。

Azure認証を入れると、審査員向け説明では「ちゃんとしてる感」は出ますが、実装・設定・デモ事故のリスクが上がります。

## おすすめ構成

### デモユーザー

```ts
const DEMO_USERS = [
  {
    loginId: "kanda-office",
    password: "demo",
    siteKey: "kanda-office",
    siteName: "神田事務所サイト",
  },
  {
    loginId: "aeon-mall-kanda",
    password: "demo",
    siteKey: "aeon-mall-kanda",
    siteName: "イオンモール神田サイト",
  },
];
```

または、もっとデモっぽく：

```text
ID: kanda
PASS: goodjob

ID: mall
PASS: goodjob
```

## 実装案

### 最小構成

* `/login`
* `POST /api/login`
* Cookie に `siteKey` を保存
* middleware で未ログインなら `/login` に飛ばす
* API側では Cookie の `siteKey` を使う

### Cookie例

```ts
siteKey=kanda-office
```

厳密なJWTまでは不要です。
ハッカソンでは **HttpOnly Cookie + デモ用ID/PASS** で十分です。

## 重要ポイント

事故報作成時に、必ず `facilityId` / `locationKey` をログイン中サイトから入れるようにします。

```ts
const site = getCurrentDemoSiteFromCookie();

input.facilityId = site.facilityId;
input.locationKey = site.locationKey;
```

これで、今後の検索・画像候補・改善案生成が全部サイト単位になります。

---

# 2. 動画からのフレーム抜き出し機能

これはかなり良いです。
神田事務所サイトだけ「実際に撮影した動画から抽出した画像を使っている」という説明ができるので、デモのリアリティが上がります。

## 方針

今回は CGI 連携ではなく、

```text
動画アップロード or 事前配置
↓
ffmpeg で一定間隔/指定秒数ごとにフレーム抽出
↓
Blob Storage に保存
↓
frame_assets に登録
↓
画像評価AIで observedFacts / caption / tags / relevanceScore を付与
↓
事故報生成時の画像候補として利用
```

が良さそうです。

## UIトリガーでOK

「エージェント的に動く」見せ方にしたいですが、実装としては Web UI のボタンで十分です。

例えば管理画面に：

```text
神田事務所サイト
[動画からフレームを抽出する]
```

押すと：

```text
動画を解析中...
00:03 のフレームを抽出
00:06 のフレームを抽出
00:09 のフレームを抽出
画像評価AIでタグ付け中...
完了: 12枚の候補画像を登録しました
```

みたいに見せる。

## 実装方法

### Option A: ローカル/開発環境で抽出して seed する

一番安全です。

```bash
ffmpeg -i input.mp4 -vf fps=1/3 public/generated-frames/frame-%03d.png
```

または、3秒ごと：

```bash
ffmpeg -i input.mp4 -vf "select='not(mod(t,3))'" -vsync vfr frame-%03d.png
```

その後：

```bash
bun scripts/seed-frames.ts
```

メリット：

* Azure Container Apps に ffmpeg を入れなくていい
* 本番で動画処理しないので安定
* ハッカソンデモで事故りにくい

デメリット：

* “その場で処理している感” は少し弱い

でも、UI上では「解析済みフレームを読み込み中」と見せれば十分です。

---

### Option B: Container App に ffmpeg を入れて本番で処理

技術的にはかっこいいですが、今回はリスク高めです。

必要になるもの：

* Dockerfile に `ffmpeg` 追加
* 動画アップロードAPI
* Blob への動画保存
* Worker で ffmpeg 実行
* 一時ファイル保存
* 処理時間・メモリ・Container制限の考慮

ハッカソン終盤なら、ここまでやらなくていいと思います。

## おすすめ

今回は **事前抽出 + DB/Blob登録 + UI上はエージェント風表示** がよいです。

つまり：

```text
本当にffmpegは使う
ただし本番デモ中にffmpeg処理しない
```

このバランスが安全です。

---

# 3. 事故報の検索機能

今 DB の全件表示なら、ここはかなり素直に改善できます。

## まず入れたい検索条件

最低限これで十分です。

* サイト
* ステータス
* キーワード
* 作成日
* 事故種別っぽいもの

## UI案

事故報一覧に検索バーを置きます。

```text
[キーワード検索: 場所・概要・報告内容]
[ステータス: すべて / 作成中 / 人間確認待ち / 確定済み]
[サイト: 現在のサイトのみ]
[検索]
```

ログイン後は基本的に **自分のサイトの事故報だけ表示**でよいです。

つまり、検索APIでは Cookie の `siteKey` から `facilityId` を絞ります。

## API案

```http
GET /api/reports?keyword=転倒&status=confirmed&from=2026-05-01&to=2026-05-28
```

内部では必ず：

```sql
where facility_id = currentSite.facilityId
```

相当の絞り込みを入れる。

## 検索対象

`reports` の構造次第ですが、まずはこのあたり：

* `id`
* `status`
* `input_json`
* `ai_draft_json`
* `human_edited_json`
* `created_at`

SQL Server なら、最初は `LIKE` でもOKです。

```sql
where
  input_json like @keyword
  or ai_draft_json like @keyword
  or human_edited_json like @keyword
```

Azure SQL で JSON_VALUE を使っているなら、主要フィールドだけ抜いて検索してもいいです。

---

# 4. 事故報生成画面の UI / UX 改善

ここはデモの主役です。
かなり良い方向性です。

## コンセプト

> 事故報の下書きが裏側で生成されていき、その上にグラスモーフィズムのエージェント状況ダイアログが重なる

これはかなり映えます。

## 画面イメージ

```text
┌─────────────────────────────────────┐
│ 事故報告書                           │
│                                     │
│ 件名: 本館3階 南側廊下で...           │
│ 発生場所: ...                        │
│ 発生日時: ...                        │
│ 状況: ...                            │
│                                     │
│ 写真台帳                             │
│ [photo] [photo] [photo] [photo]      │
│                                     │
│        ┌──────────────────┐          │
│        │  グッジョくんが確認中       │          │
│        │  ✓ 事故概要を整理           │          │
│        │  ✓ 関連するカメラ画像を探索 │          │
│        │  → 画像の状況を確認中       │          │
│        │  ・報告書の下書きを生成     │          │
│        └──────────────────┘          │
└─────────────────────────────────────┘
```

## ステップ表示案

生成中に出すステップはこれがよさそうです。

```ts
const GENERATION_STEPS = [
  {
    key: "parse_input",
    label: "事故概要を整理しています",
    description: "入力された内容から、発生場所・状況・被害有無を読み取っています。",
  },
  {
    key: "search_camera_frames",
    label: "関連するカメラ画像を探しています",
    description: "発生場所や状況に近い画像候補を確認しています。",
  },
  {
    key: "evaluate_images",
    label: "画像から確認できる事実を整理しています",
    description: "原因を断定せず、画像上で確認できる情報だけを抽出しています。",
  },
  {
    key: "generate_report",
    label: "事故報告書の下書きを作成しています",
    description: "5W2Hと施設ナレッジを踏まえて報告書形式に整えています。",
  },
  {
    key: "prepare_review",
    label: "人間確認用の画面を準備しています",
    description: "AI下書きと写真台帳を確認・修正できる状態にしています。",
  },
];
```

これ、今の非同期処理と相性がいいです。

`reports.status` だけだと細かい進捗が出せないので、ハッカソン用にはフロント側で疑似ステップ進行でもOKです。

## 現実的な実装

Worker側で細かいステータスをDB保存するのが理想ですが、今からならまずは：

```text
POST /api/reports
↓
status = queued
↓
フロントで疑似ステップ開始
↓
GET /api/reports/:id を polling
↓
waiting_human_review になったら完了
```

で十分です。

### UI上の状態

| DB status                      | UI表示         |
| ------------------------------ | ------------ |
| `queued`                       | 受付完了、順番待ち    |
| `processing` or worker started | グッジョくんが作成中   |
| `waiting_human_review`         | 下書き完成、人間確認待ち |
| `confirmed`                    | 確定済み         |
| `failed`                       | 作成失敗         |

もし今 `processing` がなければ、追加してもいいです。

## グラスモーフィズム

Tailwindならこの感じです。

```tsx
<div className="rounded-3xl border border-white/30 bg-white/60 shadow-2xl backdrop-blur-xl">
  ...
</div>
```

背景の事故報は少しぼかす。

```tsx
<div className="pointer-events-none select-none opacity-70 blur-[1px]">
  <ReportPreviewSkeleton />
</div>
```

ただし、読みづらくなりすぎると逆効果なので、blur は控えめが良さそうです。

---

# 5. キャラクター設定：事故報お任せグッジョくん

これは入れた方がいいです。
正直、ハッカソンではこういう “記憶に残る名前” がかなり効きます。

## 役割

グッジョくんを単なるマスコットではなく、

> 事故報作成の相棒エージェント

として見せるのが良いです。

## 表示名案

* 事故報お任せグッジョくん
* 事故報サポートAI グッジョくん
* グッジョくん事故報エージェント
* Good Job Report Agent
* グッジョくんが事故報を作成中

個人的にはデモではこれが強いです。

```text
事故報お任せグッジョくん
```

ちょっとダサかわいいのが逆に記憶に残ります。

## UI文言案

生成中：

```text
グッジョくんが事故概要を整理しています
```

画像探索中：

```text
グッジョくんが関連するカメラ画像を探しています
```

画像評価中：

```text
グッジョくんが画像から確認できる事実を整理しています
```

報告書生成中：

```text
グッジョくんが事故報告書の下書きを作成しています
```

人間確認：

```text
グッジョくんの下書きを確認してください
```

確定後：

```text
確認ありがとうございます。今回の修正は、次回以降の施設ナレッジ改善に活用されます。
```

## キャラクター画像について

ここは注意点があります。

「イオンディライトのキャラクター、グッジョくん」が既存キャラなら、画像素材の利用権限・社内利用可否は確認した方がいいです。

ハッカソン内デモで社内・関係者向けなら使える可能性はありますが、公開リポジトリや外部公開スライドに載せる場合は少し注意です。

実装上はまず：

```text
/public/goodjob-kun.png
```

に社内で使ってよい画像を置く想定でよいです。

画像がまだない場合は、仮で絵文字・アイコンにしておく。

```tsx
<div className="text-4xl">👷</div>
```

---

# 追加すべきDB/設計

## reports に site/facility を確実に入れる

すでに `input_json.facilityId` を見ているようなので、まずはそれでOKです。

ただ、検索性を考えるなら将来的にはカラム化したいです。

```sql
facility_id nvarchar(100)
location_key nvarchar(100)
```

今すぐ大改造したくなければ、JSON_VALUEで検索。

```sql
json_value(input_json, '$.facilityId')
```

## frame_assets に siteKey を持たせる

これは重要です。

今後、画像候補をサイトごとに分けるために、`frame_assets` に `facility_id` または `location_key` が必要です。

例：

```sql
alter table frame_assets
add facility_id nvarchar(100) null;
```

または既存にあるならそれを使う。

神田事務所サイトの動画フレームは：

```text
facility_id = kanda-office
```

既存4シーンは：

```text
facility_id = aeon-mall-kanda
```

事故報生成時の `camera-search.ts` は、現在の `facilityId` で絞り込む。

---

# API追加案

## ログイン

```http
POST /api/login
```

```json
{
  "loginId": "kanda",
  "password": "goodjob"
}
```

Response:

```json
{
  "siteKey": "kanda-office",
  "siteName": "神田事務所サイト"
}
```

## ログアウト

```http
POST /api/logout
```

## 現在のサイト

```http
GET /api/me
```

```json
{
  "siteKey": "kanda-office",
  "siteName": "神田事務所サイト",
  "facilityId": "kanda-office",
  "locationKey": "kanda-office"
}
```

## 事故報検索

```http
GET /api/reports?keyword=転倒&status=waiting_human_review
```

ログイン中サイトで絞る。

## フレーム抽出

本番でやるなら：

```http
POST /api/admin/video-frame-extraction-runs
```

ただし今回は、実処理は script でもよいです。

```bash
pnpm extract:frames
pnpm seed:frames
```

---

# 実装タスクに落とすなら

## Phase 6.1: サイト切替 / デモログイン

* `lib/demo-sites.ts`
* `lib/demo-auth.ts`
* `/login`
* `POST /api/login`
* `POST /api/logout`
* `GET /api/me`
* middleware
* レポート作成時に site 情報を注入
* レポート一覧をログインサイトで絞る

## Phase 6.2: 事故報検索

* `GET /api/reports` に query 対応
* keyword/status/date filter
* UIに検索バー追加
* siteKey/facilityId で常時絞り込み

## Phase 6.3: フレーム抽出導線

* `scripts/extract-video-frames.ts` or shell script
* `scripts/seed-kanda-office-frames.ts`
* `frame_assets` に `facility_id` を追加または利用
* Blob に `kanda-office/frames/...` として保存
* 画像評価AIで caption / observedFacts / relevanceScore を登録
* 神田事務所サイトの事故報生成で動画由来フレームを使う

## Phase 6.4: 生成画面 UI/UX

* `components/goodjob-agent-dialog.tsx`
* `components/report-generation-background.tsx`
* `components/generation-step-list.tsx`
* polling とステップ演出
* `waiting_human_review` 到達で完了表示
* failed 時のリカバリー表示

## Phase 6.5: グッジョくん演出

* `/public/goodjob-kun.png`
* ヘッダー/生成中ダイアログ/完了画面に表示
* 文言を「事故報お任せグッジョくん」に寄せる
* デモ説明にも組み込む

---

# 個人的な優先順位

実装順はこれがよいです。

## 1位: 生成画面 UI/UX + グッジョくん

これはデモの印象に直結します。
既存処理が多少裏で雑でも、見せ方で「AIエージェントが働いている感」が出ます。

## 2位: サイト切替 / デモログイン

2つのサイトがあると、デモにストーリーが出ます。

```text
こちらは実映像を使った神田事務所サイトです。
こちらは商業施設を想定したイオンモール神田サイトです。
```

と言える。

## 3位: 事故報検索

管理画面としての完成度が上がります。
ただしデモの主役ではないので、凝りすぎなくてOKです。

## 4位: 動画フレーム抽出

機能としては強いですが、本番で動的実行する必要は低いです。
事前抽出 + 登録済みフレーム利用で十分伝わります。

---

# デモストーリー案

こんな流れにするとかなり良さそうです。

```text
1. 神田事務所サイトとしてログインします。

2. 事故概要を入力します。
   「神田事務所内で転倒事故が発生。周辺カメラ映像を確認したい」

3. 事故報お任せグッジョくんが起動します。
   - 事故概要を整理
   - 関連するカメラ画像を探索
   - 動画から抽出済みのフレームを確認
   - 画像から確認できる事実を整理
   - 事故報告書を作成

4. 生成された事故報と写真台帳を確認します。

5. 人間が修正して確定します。

6. 修正差分は施設ナレッジ改善に回ります。

7. 管理画面で施設ナレッジ候補を確認し、承認します。
```

これで Phase 1〜5 の価値も自然につながります。

---

# ここからの実装開始なら

次にやるなら、まずこの順でコードを見たいです。

```text
1. 現在の reports 作成API
2. reports 一覧API
3. frame_assets / camera-search 周辺
4. 生成画面コンポーネント
5. app の routing 構成
```

その上で、最初のPR/commitはこれがいいです。

```text
Add demo site login and scope reports by site
```

次が：

```text
Improve report generation experience with Goodjob agent UI
```

その次が：

```text
Add report search filters
```

最後に：

```text
Add Kanda office frame assets from extracted video frames
```

この順なら、壊れにくくてデモ価値も上がります。
```

```md: user_2
## 動画抽出

Option A: ローカル/開発環境で抽出して seed する

でいきましょう
```

```md: agent_2
賛成です。今回は **Option A: ローカル/開発環境で ffmpeg 抽出 → Blob/DB に seed** が一番安全です。

方針はこれで固めましょう。

```text
動画ファイル
↓
ローカルで ffmpeg によりフレーム抽出
↓
抽出画像を Blob Storage にアップロード
↓
frame_assets に kanda-office 用データとして登録
↓
事故報生成時は kanda-office の frame_assets だけを画像候補に使う
↓
画像評価AIで relevanceScore / caption / observedFacts を付与
```

## 実装タスク

### 1. `frame_assets` をサイト別に扱えるようにする

まず確認したいのは、既存の `frame_assets` に `facility_id` や `location_key` 相当があるかです。

なければ追加。

```sql
alter table frame_assets
add facility_id nvarchar(100) null;
```

既存の4シーンは：

```text
facility_id = aeon-mall-kanda
```

神田事務所動画由来のフレームは：

```text
facility_id = kanda-office
```

### 2. ffmpeg 抽出スクリプトを追加

候補：

```bash
mkdir -p public/generated-frames/kanda-office

ffmpeg \
  -i ./videos/kanda-office-demo.mp4 \
  -vf fps=1/3 \
  public/generated-frames/kanda-office/frame-%03d.png
```

3秒に1枚くらいが扱いやすそうです。

もし転倒シーンが多いなら、2秒に1枚でもよいです。

```bash
ffmpeg \
  -i ./videos/kanda-office-demo.mp4 \
  -vf fps=1/2 \
  public/generated-frames/kanda-office/frame-%03d.png
```

### 3. seed script を分ける

既存の `scripts/seed-frames.ts` は4シーン用として残して、神田事務所用を追加するのが安全そうです。

```text
scripts/
  extract-kanda-office-frames.sh
  seed-kanda-office-frames.ts
```

`seed-kanda-office-frames.ts` の責務：

```text
public/generated-frames/kanda-office/*.png を読む
↓
Blob Storage の frames/kanda-office/frame-xxx.png にアップロード
↓
frame_assets に insert/upsert
  - facility_id = kanda-office
  - blob_container = frames
  - blob_name = kanda-office/frame-xxx.png
  - public_url
  - captured_at or frame_time_seconds
  - source = video_extract
```

### 4. `camera-search.ts` を facilityId で絞る

事故報作成時に `facilityId = kanda-office` なら神田事務所のフレームだけを返す。

```ts
const photos = await findFrameAssets({
  facilityId: reportInput.facilityId,
  incidentSummary: reportInput.what,
});
```

### 5. 画像評価AIは既存導線に乗せる

ここは新しく大きく作らず、今の `AI_IMAGE_EVALUATION_ENABLED=true` の流れにそのまま乗せるのがよいです。

```text
frame_assets から候補取得
↓
SAS URL 発行
↓
画像評価AI
↓
relevanceScore 順に並び替え
↓
事故報の写真台帳へ
```

## package.json scripts 案

```json
{
  "scripts": {
    "extract:frames:kanda": "bash scripts/extract-kanda-office-frames.sh",
    "seed:frames:kanda": "bun scripts/seed-kanda-office-frames.ts"
  }
}
```

## ハッカソン向けにはこれで説明できます

```text
今回は実カメラCGI連携の代替として、神田事務所で撮影した動画から ffmpeg でフレームを抽出し、事故報告書作成エージェントの画像候補として登録しています。
本番想定では、同じインターフェースをカメラCGIやVMS連携に差し替えることで、該当時刻付近のフレーム取得に拡張できます。
```

この説明、かなり自然です。

次の実装ではまず `frame_assets` の現在のスキーマ確認から入って、`facility_id` 追加が必要かを見るのがよさそうです。
```
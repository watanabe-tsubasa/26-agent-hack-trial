はい、次は **Phase 3.5：画像評価エージェント** で良いです。
Phase 4 / 5 までで「人間修正を蓄積して、店舗別補正ルールに反映する」流れができたので、次は残っていた **写真候補を AI が評価する層**ですね。

今の流れはたぶんこうです。

```text
事故概要入力
↓
camera-search.ts で frame_assets から候補画像を検索
↓
analyzeImagesMock で画像解析っぽい文字列を作る
↓
事故報告書生成 AI に渡す
↓
写真台帳 / 報告書本文に反映
```

Phase 3.5 では、この `analyzeImagesMock` 相当を **Azure OpenAI Vision 対応の画像評価エージェント**に置き換えるのが主目的です。

## Phase 3.5 の目的

```text
画像候補
+ 事故概要
+ 発生場所
+ 発生日時
↓
AI が画像内容と事故との関連度を評価
↓
写真台帳に使うべき画像を選ぶ
↓
observedFacts / relevanceScore / suggestedCaption を生成
↓
事故報告書生成 AI に渡す
```

## ここで作りたいもの

### 1. 画像評価 schema

自由文ではなく Structured Outputs にした方がよいです。

```ts
type ImageEvaluationResult = {
  imageId: string;
  relevanceScore: number; // 0-1
  shouldUseInLedger: boolean;
  observedFacts: string[];
  suggestedCaption: string;
  riskNotes: string[];
};
```

複数画像を評価するなら：

```ts
type ImageEvaluationOutput = {
  summary: string;
  results: ImageEvaluationResult[];
};
```

### 2. 画像評価プロンプト

方針はこうです。

```text
- 画像に写っている事実だけを observedFacts に書く
- 事故概要との関連度を relevanceScore で評価する
- 写真台帳に載せるべきか shouldUseInLedger で判断する
- 写真キャプション案を suggestedCaption に書く
- 画像から断定できない原因・責任・時系列は書かない
- 発生日時と画像撮影日時がズレている場合は riskNotes に書く
```

ここ、かなり大事です。
Vision が「それっぽい原因」まで語り出すと事故報告書では危ないので、画像評価は **観察事実の抽出**に寄せるのがよいです。

### 3. 実装ファイル候補

```text
lib/image-evaluation-schema.ts
lib/image-evaluation-prompt.ts
lib/image-evaluation-ai.ts
lib/mock-vision.ts の置き換え or 併用
```

既存の `mock-agent.ts` 側では、おそらくこういう流れにします。

```ts
const photos = await searchCameraFrames(input);

const imageEvaluation = await evaluateImagesWithAI({
  input,
  photos,
});

const imageObservation = buildImageObservationText(imageEvaluation);
```

その後、既存の `generateAccidentReportWithAI` に渡します。

## 画像を Azure OpenAI に渡す方法

ここは実装前に決めるポイントです。

候補は3つあります。

```text
1. Blob の public URL を渡す
2. SAS URL を発行して渡す
3. Blob を base64 化して渡す
```

今回のハッカソンなら、おすすめは **まず public URL or SAS URL** です。

すでに Blob URL 直開きで画像表示できているなら、最小実装は public URL でいけます。
ただし本番寄りにするなら SAS URL が自然です。
=> SAS URLを評価用に採用。レポート本体にはpublic URLを一旦利用（余裕があれば変更）

## Phase 3.5 の実装順

おすすめはこの順です。

```text
1. docs/phase3.5/tasks.md を作成
2. image-evaluation schema を作成
3. image-evaluation prompt を作成
4. Azure OpenAI Responses API で画像URLを渡す実装を作る
5. まず1枚画像で疎通確認
6. 複数画像候補を評価できるようにする
7. relevanceScore 順に写真台帳候補を並べる
8. suggestedCaption を Photo.caption に反映
9. observedFacts を事故報告書生成AIの imageObservation に渡す
10. 失敗時は既存 mock / fallback に戻す
11. 本番 worker で動作確認
```

## Phase 3.5 で気をつけるところ

今回も実行場所は **worker 側**です。

つまり必要 env は worker にすでにある Azure OpenAI 3点セットを使います。

```env
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT_NAME
```

新しい Azure サービスは基本不要です。

ただし、SAS URL を発行するなら既存の Storage env を使います。

```env
AZURE_STORAGE_CONNECTION_STRING
AZURE_STORAGE_BLOB_ENDPOINT
```

## Claude Code に渡すならこれ

```text
次は Phase 3.5 画像評価エージェントを実装します。

背景:
Phase 1〜3 で事故報告書生成、Phase 4 で人間修正差分保存、Phase 5 で店舗・施設別補正ルール生成まで完了しています。
次は未実装だった画像評価エージェントを実装します。

目的:
現在の画像解析は analyzeImagesMock 相当の mock なので、Blob / frame_assets から取得した画像候補を Azure OpenAI Vision 対応で評価し、写真台帳に使う画像・観察事実・キャプション案を生成できるようにする。

重要方針:
- 画像評価AIは、画像に写っている観察事実を抽出する
- 原因・責任・時系列を画像だけで断定しない
- 事故概要との関連度を relevanceScore で返す
- 写真台帳に使うべきか shouldUseInLedger で返す
- suggestedCaption を生成する
- Structured Outputs + Zod validation を使う
- 失敗時は既存 mock / fallback に戻し、報告書生成フローを止めない
- 新しい Azure サービスは作らない
- 既存の Azure OpenAI / Blob Storage を使う

作成してほしいもの:
1. docs/phase3.5/tasks.md
2. lib/image-evaluation-schema.ts
3. lib/image-evaluation-prompt.ts
4. lib/image-evaluation-ai.ts
5. 既存の mock vision / analyzeImagesMock 呼び出し箇所の差し替え
6. imageEvaluation 結果から imageObservation テキストを作る helper
7. Photo.caption に suggestedCaption を反映する処理
8. fallback 処理

想定 schema:
type ImageEvaluationResult = {
  imageId: string;
  relevanceScore: number;
  shouldUseInLedger: boolean;
  observedFacts: string[];
  suggestedCaption: string;
  riskNotes: string[];
};

type ImageEvaluationOutput = {
  summary: string;
  results: ImageEvaluationResult[];
};

実装順:
1. まず schema / prompt / tasks.md を作成
2. Azure OpenAI Responses API に画像URLを渡して1枚評価できるようにする
3. 複数画像候補を評価できるようにする
4. relevanceScore 順に写真台帳候補を整理する
5. imageObservation を事故報告書生成AIに渡す
6. npx tsc --noEmit
7. worker で実行されるため、worker logs に以下を出す
   - image evaluation start
   - image count
   - selected image count
   - fallback used or not
   - ただし画像URLやプロンプト全文、secret はログ出力しない
```

## 個人的なおすすめ

Phase 3.5 は、最初から完璧な Vision 評価にしなくていいです。

まずは：

```text
画像1〜4枚
↓
AIで observedFacts / relevanceScore / caption を返す
↓
写真台帳 caption が良くなる
↓
報告書本文の「画像所見」が良くなる
```

ここまでで十分デモ映えします。

いまのプロトタイプはすでに「報告書生成 → 人間修正 → 改善ルール反映」まで通っているので、Phase 3.5 は **“画像を見ている感” をちゃんと出す**のが勝ち筋です。

# Phase 5 要求事項整理：店舗・施設別プロンプト補正ルール生成

## 背景

Phase 4 では、AI が生成した事故報告書ドラフトと、人間が編集した確定前ドラフトの差分を `report_corrections` に保存できるようになった。

確認済みの流れ:

```text
AI draft 作成
↓
人間が編集
↓
confirm
↓
report_corrections に diff_json 保存
````

Phase 5 では、この `report_corrections.diff_json` を活用して、AI が人間の修正傾向を分析し、今後の事故報告書生成品質を改善する。

ただし、共通プロンプトである `ACCIDENT_REPORT_SYSTEM_PROMPT` 自体は DB 管理・自動更新しない。

---

## Phase 5 の重要方針

### 1. 共通プロンプトは固定する

`ACCIDENT_REPORT_SYSTEM_PROMPT` は、事故報告書生成における全店舗・全施設共通の品質基準として、コード上に固定する。

このプロンプトには以下のような共通ルールを持たせる。

```text
- 事故報告書として必要な粒度
- 5W2H の記述方針
- 推測しすぎないこと
- 人間確認を前提にすること
- JSON schema を守ること
- 被害者情報の扱い
- 原因・処置・再発防止策の書き方
```

Phase 5 では、この共通プロンプトを AI が直接書き換えることはしない。

---

### 2. 改善対象は「店舗・施設別の補正ルール」とする

Phase 5 で AI が生成するのは、共通プロンプトそのものではなく、店舗・施設ごとの補正ルールとする。

生成時の構成は以下。

```text
ACCIDENT_REPORT_SYSTEM_PROMPT
+ 店舗・施設別の補正ルール
+ 事故概要
+ 画像解析結果
+ 写真候補
↓
事故報告書JSON生成
```

店舗・施設別の補正ルールは、`report_corrections` に蓄積された人間修正差分をもとに生成する。

---

## Phase 5 の目的

```text
report_corrections を店舗・施設単位で集計
↓
AI が「その店舗・施設では人間がどこをよく直しているか」を分析
↓
店舗・施設別の補正ルール案を生成
↓
location_prompt_overrides に draft として保存
↓
人間が承認したら active 化
↓
以後の事故報告書生成時に、共通プロンプトへ追記して使う
```

重要:

```text
- AI は補正ルール案を生成するだけ
- AI が自動で active 化しない
- 人間が承認した補正ルールだけを事故報告書生成に使う
- ACCIDENT_REPORT_SYSTEM_PROMPT は固定のまま維持する
```

---

## 作成する DB テーブル

### 1. location_prompt_overrides

店舗・施設別の補正ルールを管理するテーブル。

```sql
location_prompt_overrides
```

想定カラム:

```text
id
location_key
title
override_text
source
status
analysis_json
created_at
approved_at
```

カラムの意味:

```text
id:
  レコードID

location_key:
  店舗・施設を識別するキー
  例: store-001, shopping-center-demo, tenant-2f

title:
  補正ルールのタイトル

override_text:
  共通プロンプトに追記する店舗・施設別補正ルール本文

source:
  manual / ai_proposed

status:
  draft / active / archived

analysis_json:
  AI が補正ルールを提案した理由や、参照した修正傾向の要約

created_at:
  作成日時

approved_at:
  承認日時
```

制約方針:

```text
- location_key ごとに active は原則 1 件
- 新しい override を approve した場合、同じ location_key の既存 active は archived にする
- draft は複数存在してよい
```

---

### 2. prompt_improvement_runs

補正ルール生成ジョブの実行履歴を管理するテーブル。

```sql
prompt_improvement_runs
```

想定カラム:

```text
id
location_key
status
input_correction_count
summary_json
proposed_override_id
created_at
completed_at
error_message
```

カラムの意味:

```text
id:
  実行ID

location_key:
  対象店舗・施設

status:
  running / completed / failed

input_correction_count:
  分析に使った report_corrections の件数

summary_json:
  AI が分析した修正傾向の要約

proposed_override_id:
  生成された location_prompt_overrides.id

created_at:
  実行開始日時

completed_at:
  実行完了日時

error_message:
  失敗時のエラー内容
```

---

## 作成する Repository

### lib/location-prompt-override-repository.ts

必要な関数候補:

```ts
getActiveLocationPromptOverride(locationKey: string)

createDraftLocationPromptOverride({
  locationKey,
  title,
  overrideText,
  source,
  analysisJson,
})

approveLocationPromptOverride(id: string)

listLocationPromptOverrides(locationKey?: string)
```

期待する挙動:

```text
- active override が存在しない場合は null を返す
- approve 時は、同じ location_key の既存 active を archived にする
- approve された override の status を active にし、approved_at を設定する
```

---

### lib/prompt-improvement-run-repository.ts

必要な関数候補:

```ts
createPromptImprovementRun({
  locationKey,
})

completePromptImprovementRun({
  id,
  inputCorrectionCount,
  summaryJson,
  proposedOverrideId,
})

failPromptImprovementRun({
  id,
  errorMessage,
})
```

---

## 事故報告書生成時の変更

`generateAccidentReportWithAI`、またはその呼び出し元で、店舗・施設別の active override を取得して、共通プロンプトに追記する。

イメージ:

```ts
const basePrompt = ACCIDENT_REPORT_SYSTEM_PROMPT;

const locationOverride = locationKey
  ? await getActiveLocationPromptOverride(locationKey)
  : null;

const systemPrompt = [
  basePrompt,
  locationOverride
    ? `\n# 店舗・施設別の補正ルール\n${locationOverride.overrideText}`
    : "",
].join("\n");
```

重要:

```text
- override が存在しない場合は、これまで通り ACCIDENT_REPORT_SYSTEM_PROMPT のみで生成する
- override の取得に失敗しても、可能であれば共通プロンプトのみで fallback する
- ACCIDENT_REPORT_SYSTEM_PROMPT は削除・DB移行しない
```

---

## location_key の扱い

Phase 5 では、店舗・施設ごとの修正傾向を扱いたい。

そのため、`report_corrections` から対象の `location_key` を特定できる必要がある。

まずは以下のどちらかの方針で実装する。

### 方針 A: reports.input_json から location_key を取得する

```text
report_corrections.report_id
↓
reports.id
↓
reports.input_json
↓
storeId / location / building / area などから location_key を推定
```

初期実装ではこの方針でよい。

### 方針 B: report_corrections に location_key を追加する

将来的には以下のようなカラム追加も検討する。

```sql
alter table report_corrections
add location_key nvarchar(128) null;
```

ただし、Phase 5 初期実装では必須ではない。

---

## Phase 5 の AI 入力

`report_corrections.diff_json` をそのまま全部渡すのではなく、まず repository / service 側で店舗・施設単位に集計する。

AI に渡す入力例:

```json
{
  "locationKey": "store-001",
  "correctionCount": 12,
  "frequentFields": [
    "fiveWTwoH.where",
    "cause",
    "preventiveAction"
  ],
  "examples": [
    {
      "fieldPath": "preventiveAction",
      "before": "定期点検を実施する。",
      "after": "固定部の緩みを全館点検し、異常箇所は即日補修する。"
    },
    {
      "fieldPath": "treatment",
      "before": "現場を確認した。",
      "after": "現場を一時封鎖し、落下物を撤去後、設備担当者が固定状態を確認した。"
    }
  ]
}
```

---

## Phase 5 の AI 出力 Schema

AI の出力は自由文ではなく、固定 schema にする。

候補:

```ts
type LocationPromptOverrideProposal = {
  title: string;
  summary: string;
  observedCorrectionPatterns: {
    fieldPath: string;
    pattern: string;
    recommendation: string;
  }[];
  overrideText: string;
  riskNotes: string[];
};
```

各項目の意味:

```text
title:
  補正ルール案のタイトル

summary:
  この店舗・施設における修正傾向の要約

observedCorrectionPatterns:
  どのフィールドで、どのような修正が多かったか

overrideText:
  ACCIDENT_REPORT_SYSTEM_PROMPT に追記する店舗・施設別補正ルール本文

riskNotes:
  この補正ルールを使う上での注意点
```

---

## overrideText の例

```md
# 店舗・施設別の補正ルール

この施設では、再発防止策を書く際に以下を優先する。

- 「定期点検を実施する」のような一般論だけで終わらせない
- 固定部、支持部、接着部など、事故原因に関係する具体箇所を明記する
- 初動対応、暫定対応、恒久対応を分けて書く
- お客様接触がある場合は、怪我の有無、声掛け、館内救護、後日連絡要否を明記する
- 発生場所は「売場」「フロア」だけでなく、エスカレーター付近、バックヤード入口、テナント区画など具体的に書く
```

---

## 作成する API

### 1. 店舗・施設別補正ルール一覧

```text
GET /api/location-prompt-overrides
```

query:

```text
locationKey optional
```

用途:

```text
- draft / active の確認
- 管理画面やデバッグで使用
```

---

### 2. 補正ルール承認

```text
POST /api/location-prompt-overrides/:id/approve
```

用途:

```text
- draft の override を active 化する
- 同じ location_key の既存 active は archived にする
```

---

### 3. 補正ルール生成 Job 手動実行

```text
POST /api/admin/run-prompt-improvement
```

body:

```json
{
  "locationKey": "store-001"
}
```

用途:

```text
- 指定した店舗・施設の report_corrections を集計
- AI が補正ルール案を生成
- location_prompt_overrides に draft 保存
- prompt_improvement_runs に実行履歴保存
```

ハッカソン用途では cron ではなく、手動実行 API でよい。

---

## Phase 5 実装順

```text
1. docs/phase5/tasks.md を作成
2. scripts/migrate.ts に location_prompt_overrides テーブルを追加
3. scripts/migrate.ts に prompt_improvement_runs テーブルを追加
4. lib/location-prompt-override-repository.ts を作成
5. lib/prompt-improvement-run-repository.ts を作成
6. generateAccidentReportWithAI または呼び出し元で active override を読み込めるようにする
7. override がない場合は従来通り共通プロンプトのみで生成する
8. report_corrections を location_key 単位で集計する処理を作る
9. LocationPromptOverrideProposal schema を作る
10. Azure OpenAI Responses API で補正ルール案を生成する処理を作る
11. POST /api/admin/run-prompt-improvement を作る
12. GET /api/location-prompt-overrides を作る
13. POST /api/location-prompt-overrides/:id/approve を作る
14. npx tsc --noEmit で型チェック
15. 実データで補正ルール draft が生成されることを確認
16. approve 後、事故報告書生成時に active override が追記されることを確認
```

---

## Phase 5 でやらないこと

```text
- ACCIDENT_REPORT_SYSTEM_PROMPT を DB 化しない
- 共通プロンプト全体の version 管理はしない
- AI が自動で active override を反映しない
- AI が本番プロンプトを勝手に上書きしない
- cron / 定期実行はまだ作らない
- 管理画面の作り込みは必須ではない
```

---

## 期待されるデモストーリー

```text
1. AI が事故報告書ドラフトを作る
2. 人間が不足している表現を修正する
3. 修正差分が report_corrections に保存される
4. 店舗・施設ごとの修正傾向を AI が分析する
5. AI が「この施設ではこう書くべき」という補正ルール案を出す
6. 人間が内容を確認して承認する
7. 次回以降、その施設の事故報告書生成時に補正ルールが追加される
8. 共通プロンプトは固定したまま、店舗・施設ごとの運用差分だけが改善される
```

---

## 次に Claude Code にやってほしいこと

まずは Phase 5 の土台を実装してください。

優先する作業:

```text
1. docs/phase5/tasks.md をこの方針で作成
2. scripts/migrate.ts に以下のテーブルを追加
   - location_prompt_overrides
   - prompt_improvement_runs
3. lib/location-prompt-override-repository.ts を作成
4. lib/prompt-improvement-run-repository.ts を作成
5. generateAccidentReportWithAI またはその呼び出し元で、locationKey から active override を取得し、ACCIDENT_REPORT_SYSTEM_PROMPT に追記できる設計にする
6. override が存在しない場合は、今まで通り共通プロンプトだけで動くようにする
7. まだ改善 Job 本体は作り込みすぎず、まず DB / repository / active override 読み込みまで実装
8. npx tsc --noEmit で型チェック

```

ポイントとしては、前の `prompt_versions` 案を **`location_prompt_overrides` 案に置き換える**のが変更の芯です。

これなら、共通の報告書品質は固定したまま、店舗別の「この現場ではこう書いてほしい」を育てられます。プロダクトとしても説明しやすいです。
```

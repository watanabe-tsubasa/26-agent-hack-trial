はい、ここは設計を少し変えた方がよさそうです。
今の Phase 5 は **「人間の修正傾向からプロンプト補正ルールを作る」**になっていて、結果として **書きぶり・表現ルール**に寄っています。

でも本当に価値があるのは、Tsubasaさんの言う通り、

```text
store-001 では、ここがよく雨漏りする
この区画は工事中
この設備は過去にも落下事故がある
この導線は搬入作業が多い
この場所は正式には “本館 1-2階 エスカレーター” と呼ぶ
```

みたいな **施設固有の知識・レイアウト・既往情報**ですね。

なので Phase 5 の責務をこう修正するのが良いです。

## 方針修正

### Before

```text
人間の修正差分
↓
AI が書きぶりの補正ルールを作る
↓
プロンプトに追記
```

### After

```text
人間の修正差分
↓
AI が施設固有の事実・知識を抽出する
↓
施設ナレッジとして蓄積
↓
報告書生成時に、関連する施設ナレッジだけをコンテキストとして渡す
```

つまり、Phase 5 は **プロンプト改善**というより、
**施設ナレッジ蓄積 / Facility Memory** に寄せるのが良いです。

## 何を蓄積したいか

蓄積対象はこういうものです。

```text
施設固有情報:
- 雨漏りが発生しやすい箇所
- 工事中・改修中のエリア
- 破損や不具合の既往がある設備
- 正式な場所名称・設備名称
- 導線・搬入口・バックヤード・テナント区画などのレイアウト情報
- よく発生する事故パターン
- 施設管理上の注意点
```

逆に、蓄積しないものはこれです。

```text
書きぶり:
- what は短い名詞句にする
- where は建物名＋階＋設備名にする
- 推測は「可能性がある」と書く
- 簡潔に書く
- 5W2H の書式
```

これらは店舗別ではなく、全体の標準ルールです。
もし必要なら `ACCIDENT_REPORT_SYSTEM_PROMPT` 側に共通ルールとして置くべきで、店舗別 memory には入れない方がいいです。

## 新しい概念名

`location_prompt_overrides` という名前だと、どうしても「プロンプト上書き」に引っ張られます。

名前としてはこのあたりが良さそうです。

```text
facility_knowledge
location_knowledge
facility_memory
facility_context_entries
```

自分なら **`facility_knowledge_entries`** にします。

意味が明確です。

```text
この施設について、報告書生成時に参照すべき知識
```

## DB テーブル案

既存の `location_prompt_overrides` は一旦使ってもいいですが、今後の設計としては別テーブルの方が綺麗です。

```sql
create table facility_knowledge_entries (
  id nvarchar(64) not null primary key,
  location_key nvarchar(128) not null,
  category nvarchar(64) not null,
  title nvarchar(200) not null,
  content nvarchar(max) not null,
  source nvarchar(32) not null,
  status nvarchar(32) not null default 'draft',
  confidence float null,
  evidence_json nvarchar(max) null,
  created_at datetime2 not null default sysutcdatetime(),
  approved_at datetime2 null,
  archived_at datetime2 null
);
```

`category` は例えば：

```text
leakage
construction
layout
equipment
incident_history
maintenance_note
naming
other
```

例：

```json
{
  "locationKey": "store-001",
  "category": "leakage",
  "title": "本館 1-2階エスカレーター付近の雨漏り既往",
  "content": "本館 1-2階エスカレーター付近では、直近の大雨後に雨漏りが確認されている。天井材・アクリル板・周辺支持部の劣化確認が必要。",
  "confidence": 0.72,
  "evidence": [
    {
      "reportId": "report_xxx",
      "fieldPath": "fiveWTwoH.why",
      "before": "原因不明",
      "after": "常時雨漏りが発生していた場所のため、昨日の大雨が一因と思われる"
    }
  ]
}
```

## 生成 AI の出力 schema も変える

今の出力は：

```ts
type LocationPromptOverrideProposal = {
  title: string;
  summary: string;
  observedCorrectionPatterns: ...
  overrideText: string;
  riskNotes: string[];
};
```

これだと書きぶりに寄ります。

変更後はこうです。

```ts
type FacilityKnowledgeProposal = {
  summary: string;
  knowledgeEntries: {
    category:
      | "leakage"
      | "construction"
      | "layout"
      | "equipment"
      | "incident_history"
      | "maintenance_note"
      | "naming"
      | "other";
    title: string;
    content: string;
    confidence: number;
    evidence: {
      reportId: string;
      fieldPath: string;
      quotedCorrection: string;
    }[];
    shouldApplyToGeneration: boolean;
    riskNotes: string[];
  }[];
  ignoredStyleCorrections: {
    fieldPath: string;
    reason: string;
  }[];
};
```

ここが大事です。

```ts
ignoredStyleCorrections
```

AI に「これは施設知識ではなく書きぶりなので無視した」と明示させると、目的がブレにくくなります。

## プロンプト方針

Phase 5 の改善 AI には、こう指示した方がいいです。

```text
あなたの目的は、文章表現の改善ルールを作ることではありません。
人間の修正差分から、施設固有の事実・既往・レイアウト・設備情報を抽出してください。

抽出する:
- 雨漏りが発生している箇所
- 工事中の場所
- 過去不具合のある設備
- 正式な施設名称
- 特定エリアの用途や動線
- 保守・点検上の注意点

抽出しない:
- 文体
- 5W2H の書き方
- 「簡潔に書く」
- 「推測は可能性と書く」
- 一般的な事故報告書の書式
- 全店舗に共通すべき表現ルール
```

この縛りを入れると、今みたいに「what は短く」みたいな店舗別ルールが出にくくなります。

## 報告書生成時の使い方

今は：

```text
ACCIDENT_REPORT_SYSTEM_PROMPT
+ 店舗・施設別の補正ルール
```

これを：

```text
ACCIDENT_REPORT_SYSTEM_PROMPT
+ 関連する施設ナレッジ
```

に変えます。

例：

```text
# 施設固有の参考情報

以下は store-001 に関する既知の施設情報です。
事故概要と関連する場合のみ、報告書生成時の参考情報として使用してください。
確定原因として断定せず、必要に応じて「既往情報」「要確認」として扱ってください。

- 本館 1-2階エスカレーター付近では、過去に雨漏りが確認されている。
- 本館 2階 吹抜け周辺はアクリル板部材が使用されている。
- 正面入口脇は搬入動線と重なるため、清掃・搬入作業の接触確認が必要。
```

ポイントは **「プロンプトのルール」ではなく「参考情報」**として渡すことです。

## UI も変えた方がいい

今の UI：

```text
補正ルール本文
この補正ルールを適用
```

これはプロンプト編集画面に見えます。

変えるなら：

```text
施設ナレッジ候補
- 雨漏り箇所
- 工事中エリア
- レイアウト情報
- 設備既往
```

操作：

```text
保存
承認して施設ナレッジに追加
```

表示：

```text
この情報は次回以降、同一施設の事故報告書生成時に参考情報として渡されます。
ただし、原因を断定するものではありません。
```

## 今の実装からの移行方針

いきなり全部作り替えなくてもいいです。

### 最短修正

既存の `location_prompt_overrides` を使い続けつつ、**中身を施設ナレッジに限定する**。

つまり、テーブル名は一旦そのまま。

```text
location_prompt_overrides.override_text
```

に入れる内容を「書きぶり」ではなく「施設ナレッジ」にする。

UI ラベルだけ変える：

```text
補正ルール
↓
施設ナレッジ
```

この場合、実装変更は少なく済みます。

### ちゃんと直す

新しく `facility_knowledge_entries` を作る。

こちらの方が設計は良いですが、ハッカソン前ならやや重いです。

## おすすめ

今の進捗なら、**まずプロンプトと UI 文言を変える**のが良さそうです。

```text
- AI が生成する内容を施設固有情報に限定する
- 書きぶり改善は ignoredStyleCorrections に逃がす
- UI では「補正ルール」ではなく「施設ナレッジ」と呼ぶ
- 既存の approve / active 仕組みは流用する
```

DB テーブル名は `location_prompt_overrides` のままでも、デモ上は問題ないです。
ただしコード上の責務は次に refactor した方がいいです。

## Claude Code に渡す要求事項

```text
Phase 5 の方針を修正します。

現状:
report_corrections から店舗別の「プロンプト補正ルール」を生成しているが、出力が書きぶり・表現ルールに寄りすぎている。

修正したい方針:
店舗別に蓄積したいのは、書きぶりではなく施設固有の知識です。
たとえば:
- 雨漏りが発生しやすい箇所
- 工事中・改修中の箇所
- レイアウト情報
- 正式な場所名称
- 過去に不具合があった設備
- 清掃・搬入などの運用上の注意箇所
- 点検・保守上の既往情報

逆に、以下は店舗別知識として蓄積しない:
- what を短く書く
- where を建物名＋階＋設備名で書く
- 推測は「可能性がある」と書く
- 簡潔に書く
- 5W2H の記法
- 文体や書きぶりの改善
これらは店舗間で標準化すべき共通ルールなので、施設別 override には含めない。

今回の実装方針:
- 既存の location_prompt_overrides / approve flow は一旦流用してよい
- ただし生成される overrideText の内容は「施設ナレッジ」に限定する
- UI 表記も「補正ルール」ではなく「施設ナレッジ候補」に寄せる
- ACCIDENT_REPORT_SYSTEM_PROMPT に追記する際も「ルール」ではなく「施設固有の参考情報」として渡す
- その情報は関連する場合のみ使い、原因を断定しないようにする

修正対象:
1. lib/location-prompt-override-prompt.ts
   - 書きぶり改善を生成しないように system prompt を修正
   - 施設固有の事実・既往・レイアウト・設備情報だけを抽出させる
   - 書きぶり修正は ignoredStyleCorrections として扱うか、summary に「無視した」と明記する

2. lib/location-prompt-override-schema.ts
   - 可能なら observedCorrectionPatterns ではなく facilityKnowledgeCandidates に変更
   - ただし大きな変更が重い場合は既存 schema のままでもよいが、内容は施設知識に限定する

3. lib/generate-location-prompt-override.ts
   - AI に渡す入力で、表現修正ではなく施設固有情報を抽出するようにする
   - output の overrideText は「# store-001 施設ナレッジ」形式にする

4. lib/accident-report-ai.ts
   - system prompt 追記見出しを変更
   Before:
     # 店舗・施設別の補正ルール
   After:
     # 施設固有の参考情報
     以下はこの施設に関する既知情報です。事故概要と関連する場合のみ参考にしてください。確定原因として断定しないでください。

5. app/admin/prompt-improvements/page.tsx
   - UI文言を変更
   - 「補正ルール」→「施設ナレッジ」
   - 「この補正ルールを適用」→「この施設ナレッジを適用」
   - 「AIが見つけた修正傾向」→「AIが抽出した施設固有情報」
   - 「書きぶり・記法は共通ルールとして扱い、施設ナレッジには保存しない」という説明を追加

6. docs/phase5/tasks.md
   - Phase 5 の目的を「プロンプト改善」から「施設ナレッジ蓄積」に修正
   - 週次自動生成は将来構想として残す
   - active 化は人間承認後のみ

重要:
- 今回は管理者認証は実装しない
- 既存 DB テーブルはできるだけ壊さない
- 既存の approve / active flow は維持する
- npx tsc --noEmit を通す
```

## デモでの説明も変わります

かなり良くなります。

```text
人間の修正から、単なる言い回しではなく、施設固有の知識を抽出します。
たとえば、雨漏りが起きやすい箇所、工事中エリア、正式な設備名、過去の不具合箇所などです。

AI はこれを draft として提案し、人間が確認・承認したものだけが施設ナレッジとして保存されます。

次回以降、同じ施設の事故報告書を生成するときには、この施設ナレッジが参考情報として渡されます。
ただし原因を断定するものではなく、関連がある場合のみ「既往情報」「要確認事項」として利用されます。
```

こっちの方がずっとプロダクト価値があります。
「プロンプトが改善される」より、「施設を理解していく事故報告AI」になります。

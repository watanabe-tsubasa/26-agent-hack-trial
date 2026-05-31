Phase 7.5 をやるなら、今の完成度から考えて **「RAGチャットを“それっぽい検索窓”から“会話できる管理者エージェント”にする」** のが一番効きそうです。

おすすめはこの方向です。

```text
Phase 7.5: 管理者RAGチャットの会話継続・根拠強化・分析体験改善
```

## 7.5 でやると良さそうなこと

大きく分けると4つです。

| 項目                        | 内容                               | 優先度 |
| ------------------------- | -------------------------------- | --: |
| 会話履歴対応                    | 「その中で神田事務所だけ」「直近のものは？」みたいな追質問に対応 |   高 |
| sources / reportIds の引き継ぎ | 前回ヒットした事故報を次の質問の文脈に使う            |   高 |
| 回答の根拠表示強化                 | どの事故報を根拠にしたか、件数・サイト・種別を明示        |   高 |
| 集計回答のリッチ化                 | 「事故報が多いサイト」などをカード/表で見やすくする       |   中 |

---

# 一番おすすめの 7.5

## 1. 会話履歴を request に渡す

今はたぶん1問1答ですよね。

```text
User: 転倒事故はありますか？
Assistant: はい、神田事務所で...
```

Phase 7.5 では、次のような追質問を成立させたいです。

```text
User: 転倒事故はありますか？
Assistant: はい、神田事務所サイトで確認できます。

User: その中で救助対応が必要だったものは？
Assistant: 前回の転倒事故の中では、神田事務所2階オープンスペースの事故が該当します。
```

これをやるなら、`previous_response_id` よりも **自前履歴 + 前回sources保持** がいいです。

### Request

```ts
type ReportRagChatRequest = {
  message: string;
  history: RagChatMessage[];
  previousSources?: RagSource[];
};
```

### Message

```ts
type RagChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: RagSource[];
};
```

API側では直近数件だけ使います。

```ts
const recentHistory = history.slice(-6);
const previousSources = history
  .flatMap((message) => message.sources ?? [])
  .slice(-10);
```

---

# 2. 「照応解決」ステップを入れる

会話履歴をそのまま回答生成に渡すだけだと、検索クエリが弱くなりがちです。

たとえば、

```text
その中で神田事務所だけ教えて
```

をそのまま embedding にすると弱いです。

なので、RAG検索前に **検索用クエリを書き換える** のがおすすめです。

```text
会話履歴 + 今回質問
↓
検索用クエリに変換
↓
Cosmos vector search / SQL aggregation
↓
回答生成
```

例：

```text
履歴:
User: 転倒事故はありますか？
Assistant: 神田事務所とイオンモール神田で転倒事故が...

今回:
その中で救助対応が必要だったものは？

検索用クエリ:
転倒事故のうち、救助対応、起き上がれない、周囲の人が助けに来た事例
```

## 実装ファイル案

```text
lib/report-rag/
  rewrite-query.ts
```

Responses API で query rewrite。

---

# 3. previousSources を検索に使う

これはかなり効きます。

「その中で」「先ほどの事故で」と言われたら、前回の `sources.reportId` を候補として絞る。

```ts
const isFollowUp = detectFollowUp(message);

if (isFollowUp && previousSources.length > 0) {
  searchScope.reportIds = previousSources.map((source) => source.reportId);
}
```

その場合の検索は、

```text
前回sources内に絞る
+
必要なら keyword / embedding で再ランキング
```

です。

## 例

```text
User:
転倒事故はありますか？

Assistant sources:
- report_a
- report_b
- report_c

User:
その中で神田事務所だけ

API:
reportId in [report_a, report_b, report_c]
facilityId = kanda-office
```

これができると一気にチャットっぽくなります。

---

# 4. Chat UI の改善

UI側は Phase 7.5 でここまでやると良いです。

## 追加したいもの

```text
- 会話履歴を保持
- source cards を assistant message ごとに保持
- 「この事故報に絞って質問」ボタン
- 「このサイトに絞って質問」ボタン
- 「新しい会話を開始」ボタン
```

source card にボタンを足すと、デモでかなり使いやすいです。

```text
[神田事務所2階オープンスペースでの転倒事故]
サイト: 神田事務所
[事故報を見る] [この事故について質問]
```

「この事故について質問」を押すと：

```text
この事故について、発生場所と救助対応の内容を教えて
```

みたいな質問を自動投入しても良いです。

---

# 5. 集計系の回答を少し強化

「事故報が多いサイトはどこですか？」はRAGというより集計です。

Phase 7.5 では、回答に `structuredData` を返すとUIが良くなります。

## API response

```ts
type ReportRagChatResponse = {
  answer: string;
  mode: "search" | "aggregate" | "mixed";
  sources: RagSource[];
  structuredData?: {
    type: "site_report_counts";
    rows: {
      facilityId: string;
      siteName: string;
      count: number;
    }[];
  };
};
```

UIでは簡単な表にする。

```text
サイト別事故報件数
神田事務所サイト       3件
イオンモール神田サイト 2件
```

チャートまでは不要ですが、カード表示にすると見やすいです。

---

# Phase 7.5 のタスク案

## 7.5.1 会話履歴対応

```text
- ReportRagChatClient の messages を API request に含める
- assistant message に sources を保持
- /api/admin/report-rag/chat の request schema に history を追加
- API側で recentHistory を answer prompt に渡す
```

## 7.5.2 follow-up query 対応

```text
- lib/report-rag/detect-follow-up.ts
- 「その中」「それ」「先ほど」「この事故」などを検出
- previousSources を request に含める
- follow-up 時は previousSources の reportId を検索スコープにする
```

## 7.5.3 query rewrite

```text
- lib/report-rag/rewrite-query.ts
- message + recentHistory + previousSources から検索用queryを生成
- 最初はルールベース
- 余力があれば Responses API で rewrite
```

## 7.5.4 answer prompt 改善

```text
- 結論 / 確認内容 / 対象範囲 / 根拠 の形で回答
- sources がない場合は「該当事故報は見つかりません」と明示
- 集計結果は件数を明示
```

## 7.5.5 UI改善

```text
- source card に「この事故について質問」
- source card に「このサイトで絞る」
- 新しい会話を開始
- 送信中のグッジョくん表示を少しリッチに
```

---

# 実装で一番おすすめの最小スコープ

時間が限られているなら、これだけで十分です。

```text
Phase 7.5 mini:
1. chat API に history / previousSources を渡す
2. follow-up 検出
3. previousSources の reportId で絞り込み
4. answer prompt に recentHistory を含める
5. UIに「新しい会話を開始」ボタン
```

これで、

```text
転倒事故はありますか？
↓
その中で神田事務所だけ教えて
↓
この事故で救助対応はありましたか？
```

が通るようになります。

デモではかなり強いです。

---

# `previous_response_id` を使うか？

使わなくていいと思います。

今回のRAGでは、会話文脈よりも **前回sourcesをアプリ側で制御できること** の方が大事です。

```text
previous_response_id:
  モデルの会話文脈はつながる
  でも検索対象やsource制御は見えづらい

自前history:
  検索対象を制御できる
  source cardsと連動しやすい
  デバッグしやすい
```

なので Phase 7.5 は **自前history方式** が良いです。

---

# デモシナリオ

Phase 7.5 が入ると、この流れができます。

```text
管理者でログインします。

User:
転倒事故はありますか？

Goodjob:
はい。神田事務所サイトで転倒事故が確認されています...

User:
その中で救助対応が必要だったものは？

Goodjob:
前回確認した転倒事故の中では、神田事務所2階オープンスペースの事故が該当します...

User:
この事故の発生場所と状況を短くまとめて

Goodjob:
発生場所は神田事務所2階オープンスペースです...
```

これ、かなり「管理者向けRAG」っぽくなります。

---

# まとめ

Phase 7.5 はこれが良いです。

```text
管理者RAGチャットの会話継続対応

- 自前 history
- previous sources
- follow-up detection
- query rewrite
- 根拠表示強化
- source card action
```

既存の Phase 7.1〜7.4 は「検索できる」状態。
7.5 は「会話で深掘りできる」状態にするフェーズ、という位置づけがきれいです。

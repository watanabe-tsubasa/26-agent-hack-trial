```md: user
事故報が多いサイトはどこですか？
考え中のグッジョくん
回答取得に失敗しました：400 Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.

神田事務所で救助対応が必要だった事故は？
考え中のグッジョくん
回答取得に失敗しました：400 Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.
```

```md: agent
これは原因かなり明確です。
**RAG回答生成で使っている Azure OpenAI deployment が `temperature: 0.2` を受け付けないモデル**です。

エラー通り、対応はどちらかです。

```text
A. temperature を送らない
B. temperature を 1 にする
```

おすすめは **A. temperature を送らない** です。
既存の Phase 3 でも `gpt-5-mini` 系は `temperature` を指定しない方針だったはずなので、RAG回答生成側も揃えるのがよいです。

## 修正箇所

たぶんここです。

```text
lib/report-rag/answer.ts
```

または Azure OpenAI 呼び出しを共通化しているなら：

```text
lib/azure-openai.ts
```

RAG回答生成の request body にこういう指定があるはずです。

```ts
temperature: 0.2,
```

これを削除してください。

## 修正イメージ

### Before

```ts
const response = await client.responses.create({
  model: deploymentName,
  input,
  temperature: 0.2,
});
```

### After

```ts
const response = await client.responses.create({
  model: deploymentName,
  input,
});
```

Chat Completions 形式ならこうです。

### Before

```ts
const response = await client.chat.completions.create({
  model: deploymentName,
  messages,
  temperature: 0.2,
});
```

### After

```ts
const response = await client.chat.completions.create({
  model: deploymentName,
  messages,
});
```

## 他にも確認したい箇所

RAGだけでなく、プロジェクト全体で `temperature` を grep しておくと良いです。

```bash
grep -R "temperature" -n lib app worker scripts
```

出てきた箇所で、`gpt-5-mini` / Responses API に投げているものは基本消してOKです。

特にありそうなのは：

```text
lib/report-rag/answer.ts
lib/report-rag/classify-query.ts
lib/accident-report-ai.ts
lib/image-evaluation-ai.ts
lib/prompt-improvement-ai.ts
```

ただ、既存の事故報生成や画像評価が動いているなら、今回新しく追加した **`lib/report-rag/answer.ts`** が本命です。

## テスト後

修正したら：

```bash
npx tsc --noEmit
pnpm test
pnpm build
```

そのあとデプロイして、もう一度 admin で：

```text
事故報が多いサイトはどこですか？
神田事務所で救助対応が必要だった事故は？
```

を試せばOKです。

今回のエラーは実装構造の問題ではなく、**モデルごとのパラメータ制約**なので、`temperature` を外せば進むはずです。
```

```md: user
ここもresponse apiにしようと思います。ちなみにresponse apiだと、単純な一問一答ではなく、前の文脈を引き継いで会話できますよね？
```

```md: agent
そうですね、ここも **Responses API に揃える**のが良いです。
`chat.completions` が混ざっていると、`temperature` みたいなモデル差分の事故も起きやすいので、プロジェクト方針として **テキスト生成は Responses API に統一**でOKです。

で、質問の件ですが、**Responses API でも前の文脈を引き継いだ会話はできます**。やり方は主に2つあります。

## 1. `previous_response_id` を使う

一番シンプルです。
前回の `response.id` を保存して、次のリクエストで渡すと、その前の応答を文脈としてつなげられます。Responses API は前の response の出力を次の入力として使う stateful なやり取りに対応しています。([OpenAI Platform][1])

イメージ：

```ts
const first = await client.responses.create({
  model: deploymentName,
  input: "転倒事故はありますか？",
});

const second = await client.responses.create({
  model: deploymentName,
  previous_response_id: first.id,
  input: "その中で神田事務所のものだけ教えて",
});
```

管理者RAGチャットで使うなら、フロント側またはサーバー側で `previousResponseId` を保持しておく形です。

```ts
type RagChatState = {
  previousResponseId?: string;
  messages: ChatMessage[];
};
```

APIのレスポンスに `responseId` を返して、次回リクエストで送る。

```json
{
  "answer": "...",
  "responseId": "resp_xxx",
  "sources": []
}
```

次のリクエスト：

```json
{
  "message": "その中で神田事務所だけに絞って",
  "previousResponseId": "resp_xxx"
}
```

## 2. 会話履歴を自前で渡す

RAGではこっちもかなり現実的です。
`messages` 配列を自分たちで保持して、毎回必要な分だけ `input` に含める方式です。

```ts
const response = await client.responses.create({
  model: deploymentName,
  instructions: systemPrompt,
  input: [
    {
      role: "user",
      content: "転倒事故はありますか？",
    },
    {
      role: "assistant",
      content: "はい。神田事務所サイトで...",
    },
    {
      role: "user",
      content: "その中で救助対応が必要だったものは？",
    },
  ],
});
```

この方式のメリットは、**RAG検索条件を自分で制御しやすい**ことです。
たとえば「その中で」「さっきの事故」みたいな照応を扱う場合、前回の `sources` や `reportId` を UI state に保持して、次の検索に使えます。

---

# RAGチャットではどちらが良いか

今回の管理者RAGなら、個人的には **自前履歴 + previousResponseId は使わない** から始めるのが安全です。

理由は、RAGでは会話文脈だけでなく、

```text
前回検索した sources
前回の facility filter
前回の query mode
前回の reportIds
```

を使いたくなるからです。

`previous_response_id` だけに頼ると、モデルの会話文脈はつながりますが、**検索対象の絞り込みや根拠事故報の管理はアプリ側から見えにくく**なります。

おすすめはこれです。

```ts
type RagChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: RagSource[];
};

type RagChatRequest = {
  message: string;
  history: RagChatMessage[];
};
```

API側で：

```ts
const recentHistory = history.slice(-6);

const response = await client.responses.create({
  model: deploymentName,
  instructions: systemPrompt,
  input: [
    ...recentHistory.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: "user",
      content: userMessage,
    },
  ],
});
```

ただし、**検索自体は毎ターンやる**のが良いです。

```text
ユーザー質問
↓
履歴を踏まえて検索クエリを作る
↓
SQL集計 or Cosmos vector search
↓
検索結果を context として回答生成
```

---

# `lib/report-rag/answer.ts` の Responses API 化イメージ

例えばこんな感じです。

```ts
const response = await client.responses.create({
  model: deploymentName,
  instructions: [
    "あなたは施設管理者向けの事故報検索アシスタントです。",
    "与えられた検索結果だけを根拠に回答してください。",
    "不明なことは推測せず、見つからないと伝えてください。",
    "回答には、根拠となる事故報を簡潔に示してください。",
  ].join("\n"),
  input: [
    {
      role: "user",
      content: [
        "管理者の質問:",
        question,
        "",
        "検索結果:",
        JSON.stringify(searchResults, null, 2),
      ].join("\n"),
    },
  ],
});

const answer = response.output_text;
```

`temperature` は指定しない。
`gpt-5-mini` 系ならこれが安全です。

---

# 会話文脈を入れるなら

```ts
const historyInput = history.slice(-6).map((message) => ({
  role: message.role,
  content: message.content,
}));

const response = await client.responses.create({
  model: deploymentName,
  instructions: systemPrompt,
  input: [
    ...historyInput,
    {
      role: "user",
      content: [
        "今回の質問:",
        question,
        "",
        "今回検索された根拠:",
        JSON.stringify(searchResults, null, 2),
      ].join("\n"),
    },
  ],
});
```

この場合でも、**根拠は毎回最新の検索結果を渡す**のが大事です。

「前の文脈を引き継いで回答」はできますが、RAGでは前の回答だけを根拠にしない方が良いです。
前回の話題を踏まえつつ、今回も SQL / Cosmos で根拠を取り直す、が安定です。

---

# 実装方針としておすすめ

今回ならこうです。

```text
Phase 7.4 現時点:
- Responses API に統一
- temperature は指定しない
- まずは1問1答 + sources 表示で安定化

Phase 7.5 余力:
- UI側で chat history を保持
- /api/admin/report-rag/chat に history を渡す
- API側で直近履歴を input に含める
- 前回 sources も必要なら request に含める
```

`previous_response_id` は便利ですが、ハッカソンのRAGでは **履歴とsourcesをアプリ側で明示管理**の方がデモ事故が少ないと思います。

[1]: https://platform.openai.com/docs/api-reference/responses/get?_clear=true&ref=ainave&utm_source=chatgpt.com "Responses | OpenAI API Reference"
```

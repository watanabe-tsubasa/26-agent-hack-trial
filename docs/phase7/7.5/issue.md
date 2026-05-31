```md: user
事故報が多いサイトはどこですか？
考え中のグッジョくん
結論：イオンモール神田サイトが最も事故報が多く、confirmed 事故報は11件です。

補足：比較対象は神田事務所の3件で、集計は提示されたconfirmed事故報データに基づきます。

該当事故報（タイトル / サイト名）：
- イオンモール神田サイト (aeon-mall-kanda): 11 件
- 神田事務所サイト (kanda-office): 3 件
その中で、特に発生している内容はなんでしょうか
考え中のグッジョくん
回答取得に失敗しました：400 Invalid value: 'input_text'. Supported values are: 'output_text' and 'refusal'.

転倒事故はありますか？
考え中のグッジョくん
結論：はい。神田事務所の2階共用部での転倒報告が1件あります。

補足：発生日は2025年5月27日15時15分頃、被害者の特定や人的被害の有無は報告内で不明・要確認とされています。その他の関連報告は天井材の落下事案であり、人の転倒事故とは内容が異なります。

該当事故報：
- 転倒報告（神田事務所／2階 共用部）ドラフト / 神田事務所サイト
根拠となる事故報:

転倒報告（神田事務所／2階 共用部）ドラフト
神田事務所サイト · report_60105adf-a1ca-4ad7-8c65-d8bbb774a6d0
天井ボード落下（本館3階 廊下）
イオンモール神田サイト · report_e19d6ee4-9835-43f6-8721-947abc5874f5
天井材（報告：エスカレーター三角ボード）落下（本館 3階 南側廊下）
イオンモール神田サイト · report_d66597bb-0ef3-4ac2-9ce8-5be53fd765be
天井ボード落下（本館3階 南側廊下）報告ドラフト
神田事務所サイト · report_239a8921-ceae-48c3-8696-d2b90bd1405e
天井ボード落下（本館 3階 廊下（南側））
イオンモール神田サイト · report_79c94a67-2d56-4bca-8f97-d52355af49bc
その中で神田事務所だけ
考え中のグッジョくん
回答取得に失敗しました：400 Invalid value: 'input_text'. Supported values are: 'output_text' and 'refusal'.

という感じで、2回目の生成で失敗しています
```

```md: agent
はい、これは **2回目以降だけ history を Responses API に渡していて、その assistant 履歴の content type が間違っている**パターンです。

エラー：

```text
400 Invalid value: 'input_text'. Supported values are: 'output_text' and 'refusal'.
```

これはたぶん、履歴をこう変換しているのが原因です。

```ts
{
  role: "assistant",
  content: [{ type: "input_text", text: message.content }]
}
```

Responses API では、`role: "assistant"` の message content は `input_text` ではなく、`output_text` を使う必要があります。

## 修正方針

履歴を Responses API input に変換している箇所で、role によって type を変えます。

```ts
function toResponseInputMessage(message: RagChatMessage) {
  if (message.role === "assistant") {
    return {
      role: "assistant" as const,
      content: [
        {
          type: "output_text" as const,
          text: message.content,
        },
      ],
    };
  }

  return {
    role: "user" as const,
    content: [
      {
        type: "input_text" as const,
        text: message.content,
      },
    ],
  };
}
```

そして `answer.ts` 側ではこう使います。

```ts
const historyInput = history
  .slice(-6)
  .map(toResponseInputMessage);

const response = await client.responses.create({
  model: deploymentName,
  instructions: SYSTEM_PROMPT,
  input: [
    ...historyInput,
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: buildUserPrompt({
            question,
            searchResults,
            aggregateResult,
          }),
        },
      ],
    },
  ],
});
```

## 今回の直接原因

1回目は成功しています。

```text
事故報が多いサイトはどこですか？
→ 成功
```

2回目で失敗しています。

```text
その中で、特に発生している内容はなんでしょうか
→ input_text エラー
```

つまり、2回目から `history` に assistant message が入り、その assistant message に `input_text` を使ってしまっている、という読みでほぼ確定です。

## 追加で気になる点

「転倒事故はありますか？」の source cards に天井落下系が混ざっていますね。

```text
転倒報告
天井ボード落下
天井材落下
...
```

これは別件で、vector search の topK が広すぎるか、score threshold がない可能性があります。
まずは今回の `input_text` エラーを直して、そのあとで以下を入れると良さそうです。

```text
- topK を 3〜5 に絞る
- similarity score threshold を設ける
- 回答本文で使った sources だけを返す
- follow-up 時は previousSources の reportId に絞る
```
```
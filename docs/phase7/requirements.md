良いです。これは **Phase 7: 管理者向け施設管理RAG** として、かなり自然に入れられます。
ポイントは、**Azure SQLを正本、Cosmos DBを検索用インデックス**として扱うことです。

つまり、事故報の厳密なデータは今まで通り Azure SQL に置いたままにします。
Cosmos DB には、RAGで検索しやすいように加工した **検索用ドキュメント / embedding / メタデータ** を持たせます。

---

# Phase 7 の全体像

```text
Azure SQL
  reports
  report_corrections
  location_prompt_overrides
  prompt_improvement_runs
  frame_assets

  ↓ 同期 / index 作成

Cosmos DB
  report_search_documents
    - reportId
    - facilityId
    - siteName
    - incident type
    - summary text
    - searchable text
    - embedding
    - metadata

  ↓ vector search + metadata filter

Azure OpenAI
  - query embedding
  - answer generation

Admin UI
  /admin/report-rag
  - チャット形式
  - 全サイト横断
  - 根拠事故報を表示
```

この構成なら、RAGを追加しても既存の事故報作成・施設ナレッジ改善にはほぼ影響しません。

---

# 1. 管理者アカウント

今の demo login に3つ目のアカウントを足すのが良いです。

```ts
const DEMO_USERS = [
  {
    loginId: "kanda",
    password: "goodjob",
    role: "site_user",
    siteKey: "kanda-office",
  },
  {
    loginId: "mall",
    password: "goodjob",
    role: "site_user",
    siteKey: "aeon-mall-kanda",
  },
  {
    loginId: "admin",
    password: "goodjob",
    role: "admin",
    siteKey: null,
  },
] as const;
```

セッション型はこうしたいです。

```ts
type DemoSession =
  | {
      role: "site_user";
      siteKey: "kanda-office" | "aeon-mall-kanda";
      siteName: string;
      facilityId: string;
      locationKey: string;
    }
  | {
      role: "admin";
      siteKey: null;
      siteName: "全施設管理";
      facilityId: null;
      locationKey: null;
    };
```

## 管理者でできること

```text
できる:
- 管理者RAG
- 全施設の事故報検索 / 分析
- 将来的には全施設ダッシュボード

できない:
- 事故報作成
- 施設ナレッジ改善
```

今の要件なら、管理者のサイドバーはこうです。

```text
管理者メニュー
- 施設管理RAG
- 事故報一覧（任意。全体検索用に残してもよい）
```

ただし「事故報作成、プロンプト改善機能は不要」なので、管理者のナビには出さない。

---

# 2. RAG用 Cosmos DB の位置づけ

すでに Phase 6.7 で `agent_events` を作っていますが、Phase 7 は別 container が良いです。

```text
Cosmos DB account:
  cosmos-agent-hack-trial

Database:
  agent-hack-trial

Containers:
  agent_events
    - Phase 6.7
    - グッジョくん実行ログ
    - partition key: /entityId

  report_search_documents
    - Phase 7
    - 管理者RAG用
    - partition key: /facilityId
    - vector policyあり
```

Cosmos DB for NoSQL の vector search は container に vector policy を定義して使うため、RAG用 container は `agent_events` とは分ける方が良いです。公式ドキュメントでも、ベクター検索には container の vector policy 定義が必要とされています。([Microsoft Learn][1])

---

# 3. RAG用 document 設計

最初は **1事故報 = 1 document** で良いです。
事故報が長くなってきたら chunk 分割すればOKです。

## document例

```json
{
  "id": "report_report_abc123_summary",
  "documentType": "accident_report",
  "reportId": "report_abc123",
  "facilityId": "kanda-office",
  "siteKey": "kanda-office",
  "siteName": "神田事務所サイト",
  "status": "confirmed",
  "title": "神田事務所2階オープンスペースでの転倒事故",
  "incidentTypes": ["転倒", "救助対応"],
  "locations": ["神田事務所 2階オープンスペース"],
  "occurredAt": "2026-05-28T09:00:00.000Z",
  "createdAt": "2026-05-31T07:00:00.000Z",
  "updatedAt": "2026-05-31T07:30:00.000Z",
  "sourceUpdatedAt": "2026-05-31T07:30:00.000Z",
  "indexedAt": "2026-05-31T08:00:00.000Z",
  "text": "神田事務所2階オープンスペースで利用者が転倒し、転倒後に起き上がれず、周囲の人が救助対応を行った。画像からは...",
  "embedding": [0.012, -0.034, "..."],
  "metadata": {
    "hasPhotos": true,
    "photoCount": 4,
    "humanEdited": true,
    "riskKeywords": ["転倒", "救助", "オープンスペース"]
  }
}
```

## なぜ1事故報1documentで始めるか

今の事故報はたぶん1件あたりそこまで長くないので、chunking を凝るよりも、

```text
1 report → 1 searchable document
```

の方が実装が速く、デモでも十分です。

Phase 7.2 くらいで、必要ならこう分ければOKです。

```text
report_summary
report_details
photo_observations
human_corrections
```

---

# 4. Azure SQL → Cosmos DB の同期方針

ここが大事です。

## おすすめは「イベント同期 + 手動再index」

両方持つのが良いです。

```text
A. 事故報確定時に、その report だけ Cosmos DB に upsert
B. 管理者画面から全件再indexできる
C. scripts/reindex-report-rag.ts で手動再indexできる
```

これが一番安全です。

## A. 事故報確定時に upsert

`POST /api/reports/[id]/confirm` の最後で：

```text
confirmed に更新
report_corrections 保存
↓
indexReportForRag(reportId)
```

ただし、RAG index が失敗しても confirm は成功させるべきです。

```ts
try {
  await indexReportForRag(reportId);
} catch (error) {
  console.warn("[rag-index] failed", error);
}
```

ここは Cosmos event log と同じ思想です。

## B. 管理者の全件再index

管理者向けにボタンを置いてもいいです。

```text
RAG検索インデックスを更新
```

または隠し管理APIで十分。

```http
POST /api/admin/report-rag/reindex
```

これで SQL から confirmed reports を全部読んで、Cosmos に upsert。

## C. script

ハッカソンでは script が一番確実です。

```bash
pnpm rag:reindex
```

```json
{
  "scripts": {
    "rag:reindex": "bun scripts/reindex-report-rag.ts"
  }
}
```

最初はこれが強いです。

---

# 5. どの report を RAG 対象にするか

おすすめは **confirmed のみ**です。

```text
RAG対象:
- confirmed

対象外:
- queued
- processing
- waiting_human_review
- failed
```

理由は、管理者が自然言語で見る情報は、確定済みの事故報を正本にした方がいいからです。

ただしデモデータが少ないなら、一時的に `waiting_human_review` も含めるオプションはありです。

```ts
const INDEXABLE_STATUSES = ["confirmed"];

// デモ用に増やすなら:
const INDEXABLE_STATUSES = ["confirmed", "waiting_human_review"];
```

UIでは「確定済み事故報を対象」と言い切った方が業務っぽいです。

---

# 6. RAGの検索方式

RAGといっても、質問には2種類あります。

## A. 意味検索が効く質問

```text
転倒があった事故は？
天井材の落下に関係する事故は？
救助対応が必要だった事例は？
設備不具合が原因っぽい事故は？
```

これは vector search が合います。

## B. 集計が必要な質問

```text
事故報が多いサイトは？
転倒事故は何件？
サイト別に事故件数を教えて
今月多い事故種別は？
```

これは pure RAG より **SQL / Cosmos metadata aggregation** の方が合います。

なので Phase 7 の設計では、質問をざっくり分類するのが良いです。

```text
自然言語質問
↓
軽量分類
  - search: 事例検索
  - aggregate: 件数・ランキング
  - mixed: 検索 + 集計
↓
search は Cosmos vector
aggregate は Azure SQL or Cosmos metadata query
↓
回答生成
```

ハッカソンなら最初はシンプルに、

```text
1. Azure SQL で件数系を拾えるならSQL
2. それ以外はCosmos vector search
```

で十分です。

## 「事故報が多いサイト」はSQLが良い

これはRAGでやるより、SQLの方が正確です。

```sql
select
  JSON_VALUE(input_json, '$.facilityId') as facility_id,
  count(*) as report_count
from reports
where status = 'confirmed'
group by JSON_VALUE(input_json, '$.facilityId')
order by report_count desc;
```

そして回答はAIに整形させる。

---

# 7. API設計

## 管理者RAGチャット

```http
POST /api/admin/report-rag/chat
```

Request:

```json
{
  "message": "天井落下に関係する事故はありますか？"
}
```

Response:

```json
{
  "answer": "はい。イオンモール神田サイトで、天井ボード落下に関係する事故報が1件あります...",
  "mode": "search",
  "sources": [
    {
      "reportId": "report_xxx",
      "title": "本館3階南側廊下での天井ボード落下",
      "facilityId": "aeon-mall-kanda",
      "siteName": "イオンモール神田サイト",
      "createdAt": "2026-05-31T...",
      "url": "/reports/report_xxx"
    }
  ]
}
```

## 再index

```http
POST /api/admin/report-rag/reindex
```

Response:

```json
{
  "indexed": 12,
  "skipped": 2,
  "failed": 0
}
```

## index status

```http
GET /api/admin/report-rag/index-status
```

Response:

```json
{
  "indexedDocuments": 12,
  "lastIndexedAt": "2026-05-31T..."
}
```

---

# 8. UI設計

## ルート

```text
/admin/report-rag
```

## 画面

```text
施設管理RAG
グッジョくんに事故報を横断確認してもらう

[チャット入力]
例:
- 天井落下に関係する事故はありますか？
- 転倒事故はありますか？
- 事故報が多いサイトはどこですか？
- 神田事務所で救助対応が必要だった事故は？
```

回答はチャット形式。

```text
User:
転倒事故はありますか？

Goodjob:
はい。神田事務所サイトで転倒に関係する事故報が確認できます。
代表的なものとして、神田事務所2階オープンスペースで利用者が転倒し...

根拠:
[神田事務所2階オープンスペースでの転倒事故] /reports/...
```

## 管理者ナビ

admin role では sidebar をこう変える。

```text
- 施設管理RAG
- 事故報一覧
```

site_user では今まで通り。

```text
- ホーム
- 事故報一覧
- 施設ナレッジ改善
```

---

# 9. 認可

API側でも必ず admin check を入れます。

```ts
const session = await requireDemoSession();

if (session.role !== "admin") {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
```

対象API：

```text
/admin/report-rag
/api/admin/report-rag/chat
/api/admin/report-rag/reindex
/api/admin/report-rag/index-status
```

ページも layout / page 側で redirect or forbidden。

---

# 10. Cosmos DB container 作成について

Phase 7 用には、`report_search_documents` container を別で作成します。

ただし、vector search を使う場合は container 作成時に vector policy / vector index を指定する必要があります。Cosmos DB for NoSQL の vector search は `WHERE` 句など通常のフィルターと組み合わせられるため、`facilityId` や `status` で絞りながら近傍検索する設計が取りやすいです。([Microsoft Learn][2])

embedding の次元数は、使う embedding model に合わせます。

例：

```text
text-embedding-3-small: 1536 dimensions
text-embedding-3-large: 3072 dimensions
```

Azure OpenAI の deployment 名は環境に依存するので、env に分けるのがよいです。

```text
AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME
RAG_EMBEDDING_DIMENSIONS=1536
COSMOS_RAG_CONTAINER=report_search_documents
```

---

# 11. 同期タイミング

## 最小実装

```text
Phase 7.1:
- 管理者が手動で reindex
- confirmed reports を全部 Cosmos に upsert
- チャット検索

Phase 7.2:
- confirm 時にその report を自動 upsert
- report 更新時に再upsert
```

ハッカソンなら Phase 7.1 で十分です。
つまり、最初は手動同期でいいです。

```text
デモ前:
pnpm rag:reindex
```

または管理画面で：

```text
[検索インデックスを更新]
```

これで済ませる。

---

# 12. 実装タスク

## Phase 7.1 管理者アカウント

```text
- demo users に admin / goodjob 追加
- session role を site_user/admin に拡張
- AppShell nav を role に応じて出し分け
- admin は事故報作成・施設ナレッジ改善を非表示
- admin only route guard
```

## Phase 7.2 RAG index

```text
- lib/report-rag/types.ts
- lib/report-rag/build-report-document.ts
- lib/report-rag/embedding.ts
- lib/report-rag/cosmos-report-search.ts
- scripts/reindex-report-rag.ts
- POST /api/admin/report-rag/reindex
```

## Phase 7.3 Chat API

```text
- lib/report-rag/classify-query.ts
- lib/report-rag/search-reports.ts
- lib/report-rag/answer.ts
- POST /api/admin/report-rag/chat
```

## Phase 7.4 UI

```text
- app/(app)/admin/report-rag/page.tsx
- ReportRagChatClient.tsx
- chat message UI
- source cards
- suggested questions
- reindex button / status
```

---

# 13. 質問分類は最初はルールでOK

いきなりAI分類しなくても、デモならルールで十分です。

```ts
function classifyAdminRagQuery(message: string) {
  if (
    message.includes("多い") ||
    message.includes("何件") ||
    message.includes("件数") ||
    message.includes("ランキング") ||
    message.includes("サイト")
  ) {
    return "aggregate";
  }

  return "search";
}
```

後で AI classifier に変えられます。

---

# 14. 「ざっくりした聞き方」対応

これは answer prompt が大事です。

```text
管理者は、事故報の厳密なIDや用語を知らずに質問します。
「天井落下」「転倒」「救助」「事故報が多いサイト」などの自然な表現から、
関連する事故報を探し、根拠となる事故報を示して回答してください。
不明な場合は推測せず、該当する事故報が見つからないと伝えてください。
```

出力は、

```text
結論
根拠
補足
該当事故報
```

くらいにすると見やすいです。

---

# 15. 推奨する最初のスコープ

最初の Phase 7 はこれくらいがいいです。

```text
実装する:
- admin / goodjob
- /admin/report-rag
- confirmed reports を Cosmos に手動 reindex
- vector search
- 件数系はSQL aggregation
- chat UI
- source cards

実装しない:
- 完全自動同期
- 複雑なchunking
- 会話履歴永続化
- 高度なquery planner
```

これでもデモ価値はかなり高いです。

---

# まとめ

設計はこうです。

```text
Azure SQL:
  正本。事故報・修正差分・ステータス管理。

Cosmos DB agent_events:
  グッジョくんの実行ログ。

Cosmos DB report_search_documents:
  管理者RAG用の検索インデックス。
  confirmed reports を検索用テキスト + embedding として保存。

同期:
  最初は手動 reindex。
  余裕があれば confirm 時に自動 upsert。

UI:
  admin / goodjob のみ利用可能。
  チャット形式。
  件数系はSQL、事例検索はCosmos vector search。
```

この形なら、Azure SQL と Cosmos DB の役割がきれいに分かれていて、デモ説明もしやすいです。

[1]: https://learn.microsoft.com/en-us/azure/cosmos-db/vector-search?utm_source=chatgpt.com "Integrated Vector Store - Azure Cosmos DB | Microsoft Learn"
[2]: https://learn.microsoft.com/ja-jp/azure/cosmos-db/vector-search?utm_source=chatgpt.com "統合ベクター ストア - Azure Cosmos DB | Microsoft Learn"

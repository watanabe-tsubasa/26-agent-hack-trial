了解です。Phase 1 は **「モックの同期処理を、本物の非同期ジョブ処理に置き換える」** ところまでに絞るのがよいです。

今の実装では、`POST /api/reports` が `createReport()` を呼び、`createReport()` の中で `generateReportDraft()` まで実行しています。つまり、現状はAPIリクエスト中にドラフト生成まで完了する同期モックです。 

Phase 1 ではここをこう変えます。

```text
Before:
POST /api/reports
  ↓
generateReportDraft()
  ↓
in-memory Map に保存
  ↓
reportId返却

After:
POST /api/reports
  ↓
Azure SQL に report 作成 status = queued
  ↓
Azure Service Bus に reportId を送信
  ↓
reportId返却
  ↓
Worker が Service Bus から受信
  ↓
generateReportDraft()
  ↓
Azure SQL 更新 status = waiting_human_review
  ↓
Frontend は /status polling
```

Service Bus の JavaScript SDK は `@azure/service-bus` で、Queue/Topic への送信・受信に対応しています。送信は `createSender()`、受信は `createReceiver()` を使う形です。([Microsoft Learn][1])

---

## Phase 1 のゴール

まずはこの状態まで持っていけばOKです。

```text
✅ Next.js は Container Apps で動く
✅ POST /api/reports は即座に reportId を返す
✅ report は Azure SQL に保存される
✅ Service Bus に report-generation message が積まれる
✅ Worker が message を受け取る
✅ Worker が今の mock-agent を実行する
✅ Worker が Azure SQL の report を更新する
✅ フロントは GET /api/reports/:id/status で進捗を見られる
```

この段階では **Azure OpenAI / Blob / Vision はまだ不要** です。
まず「非同期ワークフローの背骨」を作ります。

---

# 1. Azureリソース

Phase 1 で必要なのはこれだけです。

```text
Azure SQL Database
Azure Service Bus Queue
Azure Container Apps Web
Azure Container Apps Worker
Application Insights optional
```

Worker は最初は **常駐型 Container App** でよいです。Service Bus を `receiver.subscribe()` で待ち受ける形にすると、実装がシンプルです。

Container Apps Jobs でもできますが、Phase 1 では少し設定が増えます。Container Apps Jobs は「開始して終了する処理」に向いており、スケジュール・イベント駆動・手動実行をサポートします。([Microsoft Learn][2])
ただ、最初は **Worker Container App常駐** の方がデバッグしやすいです。

```text
Phase 1:
  Container App Worker 常駐

Phase 2以降:
  Container Apps Job に切り替え検討
```

---

# 2. DB設計

まず Azure SQL に最小テーブルを作ります。

```sql
create table reports (
  id nvarchar(64) primary key,
  status nvarchar(64) not null,
  accident_summary nvarchar(max) not null,
  scenario nvarchar(64) null,
  store_id nvarchar(64) null,
  ai_draft_json nvarchar(max) null,
  user_draft_json nvarchar(max) null,
  feedbacks_json nvarchar(max) null,
  error_message nvarchar(max) null,
  created_at datetime2 not null default sysutcdatetime(),
  updated_at datetime2 not null default sysutcdatetime()
);

create table agent_runs (
  id nvarchar(64) primary key,
  report_id nvarchar(64) not null,
  status nvarchar(64) not null,
  current_step nvarchar(128) null,
  steps_json nvarchar(max) null,
  started_at datetime2 not null default sysutcdatetime(),
  completed_at datetime2 null,
  error_message nvarchar(max) null
);
```

最初はJSONを `nvarchar(max)` で持たせてOKです。
Phase 1 の目的は正規化より **ワークフローがAzure上で回ること** です。

Azure SQL は Node.js から `mssql` パッケージで接続できます。Microsoft Learn のNode.jsクイックスタートでも `mssql` を使った接続・クエリ実行例が案内されています。([Microsoft Learn][3])

---

# 3. npm package 追加

```bash
pnpm add @azure/service-bus mssql zod
```

必要なら後で：

```bash
pnpm add @azure/identity
```

最初は接続文字列で進めて、あとでManaged Identity化でもOKです。

---

# 4. 環境変数

Container Apps の Web と Worker の両方に入れます。

```env
DATABASE_URL=Server=tcp:xxx.database.windows.net,1433;Initial Catalog=xxx;Persist Security Info=False;User ID=xxx;Password=xxx;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;

SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://xxx.servicebus.windows.net/;SharedAccessKeyName=xxx;SharedAccessKey=xxx
SERVICE_BUS_REPORT_QUEUE_NAME=report-generation-requests
```

デモ段階なら接続文字列でよいですが、後で本番寄りにするなら Managed Identity + RBAC に変えます。Service Bus SDK は connection string 認証と Azure AD credential 認証の両方に対応しています。([Microsoft Learn][1])

---

# 5. ディレクトリ追加案

今の構成に足すならこうです。

```text
lib/
  db.ts
  report-repository.ts
  service-bus.ts
  report-workflow.ts

worker/
  report-worker.ts

scripts/
  migrate.ts
```

既存の `lib/report-store.ts` は一気に消さず、Phase 1中は **DB版 repository に置き換える** のがよいです。

---

# 6. 実装するファイル

## `lib/db.ts`

```ts
import sql from "mssql";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function getDbPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(connectionString);
  }
  return poolPromise;
}

export { sql };
```

---

## `lib/report-repository.ts`

```ts
import { randomUUID } from "crypto";
import { getDbPool, sql } from "./db";
import type { CreateReportInput, Report } from "./types";

export async function createQueuedReport(input: CreateReportInput) {
  const pool = await getDbPool();
  const id = `report_${randomUUID()}`;

  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .input("status", sql.NVarChar, "queued")
    .input("accidentSummary", sql.NVarChar, input.accidentSummary ?? "")
    .input("scenario", sql.NVarChar, input.scenario ?? null)
    .query(`
      insert into reports (
        id,
        status,
        accident_summary,
        scenario
      )
      values (
        @id,
        @status,
        @accidentSummary,
        @scenario
      )
    `);

  return id;
}

export async function updateReportStatus(
  reportId: string,
  status: string,
  errorMessage?: string
) {
  const pool = await getDbPool();

  await pool
    .request()
    .input("id", sql.NVarChar, reportId)
    .input("status", sql.NVarChar, status)
    .input("errorMessage", sql.NVarChar, errorMessage ?? null)
    .query(`
      update reports
      set
        status = @status,
        error_message = @errorMessage,
        updated_at = sysutcdatetime()
      where id = @id
    `);
}

export async function saveAiDraft(reportId: string, draft: Report) {
  const pool = await getDbPool();

  await pool
    .request()
    .input("id", sql.NVarChar, reportId)
    .input("status", sql.NVarChar, "waiting_human_review")
    .input("aiDraftJson", sql.NVarChar, JSON.stringify(draft))
    .input("feedbacksJson", sql.NVarChar, JSON.stringify(draft.feedbacks ?? []))
    .query(`
      update reports
      set
        status = @status,
        ai_draft_json = @aiDraftJson,
        feedbacks_json = @feedbacksJson,
        updated_at = sysutcdatetime()
      where id = @id
    `);
}

export async function getReportById(reportId: string) {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("id", sql.NVarChar, reportId)
    .query(`
      select top 1 *
      from reports
      where id = @id
    `);

  const row = result.recordset[0];
  if (!row) return null;

  if (row.ai_draft_json) {
    return JSON.parse(row.ai_draft_json) as Report;
  }

  return {
    id: row.id,
    status: row.status,
    accidentSummary: row.accident_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getReportStatus(reportId: string) {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("id", sql.NVarChar, reportId)
    .query(`
      select top 1
        id,
        status,
        error_message,
        updated_at
      from reports
      where id = @id
    `);

  return result.recordset[0] ?? null;
}
```

`CreateReportInput` のフィールド名は、実際の `lib/types.ts` に合わせて微調整してください。
ここでは `accidentSummary` / `scenario` を仮置きしています。

---

## `lib/service-bus.ts`

```ts
import { ServiceBusClient } from "@azure/service-bus";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const queueName = process.env.SERVICE_BUS_REPORT_QUEUE_NAME;

if (!connectionString) {
  throw new Error("SERVICE_BUS_CONNECTION_STRING is required");
}

if (!queueName) {
  throw new Error("SERVICE_BUS_REPORT_QUEUE_NAME is required");
}

export const serviceBusClient = new ServiceBusClient(connectionString);
export const reportQueueName = queueName;

export async function enqueueReportGeneration(reportId: string) {
  const sender = serviceBusClient.createSender(reportQueueName);

  try {
    await sender.sendMessages({
      body: {
        reportId,
      },
      contentType: "application/json",
      subject: "report.generate",
      messageId: reportId,
    });
  } finally {
    await sender.close();
  }
}
```

---

# 7. `POST /api/reports` を非同期化

現在は `createReport(body)` の中で即ドラフト生成しています。
これを `createQueuedReport()` + `enqueueReportGeneration()` に変えます。

```ts
import { NextRequest } from "next/server";
import type { CreateReportInput } from "@/lib/types";
import { createQueuedReport } from "@/lib/report-repository";
import { enqueueReportGeneration } from "@/lib/service-bus";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateReportInput;

  const reportId = await createQueuedReport(body);
  await enqueueReportGeneration(reportId);

  return Response.json(
    {
      reportId,
      status: "queued",
    },
    { status: 202 }
  );
}
```

ここは `201 Created` より `202 Accepted` が意味として合います。
「作成要求を受け付けた。処理は非同期で続く」という表現です。

---

# 8. `/api/reports/:id/status` をDB参照に変更

今の `status` API は `getProcessingSteps(id)` で時間経過モックを返しています。
Phase 1 ではDBの `reports.status` と `agent_runs.steps_json` を返すようにします。

まず簡易版：

```ts
import { NextRequest } from "next/server";
import { getReportStatus } from "@/lib/report-repository";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const status = await getReportStatus(id);

  if (!status) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    reportId: id,
    status: status.status,
    errorMessage: status.error_message,
    updatedAt: status.updated_at,
  });
}
```

フロント側は今まで通り polling でOKです。

---

# 9. Worker実装

## `worker/report-worker.ts`

```ts
import { ServiceBusClient } from "@azure/service-bus";
import { generateReportDraft } from "../lib/mock-agent";
import {
  getReportById,
  saveAiDraft,
  updateReportStatus,
} from "../lib/report-repository";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const queueName = process.env.SERVICE_BUS_REPORT_QUEUE_NAME;

if (!connectionString) {
  throw new Error("SERVICE_BUS_CONNECTION_STRING is required");
}

if (!queueName) {
  throw new Error("SERVICE_BUS_REPORT_QUEUE_NAME is required");
}

async function main() {
  const client = new ServiceBusClient(connectionString);
  const receiver = client.createReceiver(queueName);

  console.log(`report worker started. queue=${queueName}`);

  receiver.subscribe({
    processMessage: async (message) => {
      const reportId = message.body?.reportId as string | undefined;

      if (!reportId) {
        console.warn("message does not include reportId", message.body);
        return;
      }

      console.log(`start report generation: ${reportId}`);

      try {
        await updateReportStatus(reportId, "generating_report");

        const report = await getReportById(reportId);
        if (!report) {
          throw new Error(`report not found: ${reportId}`);
        }

        const draft = await generateReportDraft({
          accidentSummary: report.accidentSummary,
          scenario: report.scenario,
        } as any);

        draft.id = reportId;
        draft.status = "review";

        await saveAiDraft(reportId, draft);

        console.log(`completed report generation: ${reportId}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown worker error";

        console.error(`failed report generation: ${reportId}`, error);
        await updateReportStatus(reportId, "failed", message);

        throw error;
      }
    },
    processError: async (args) => {
      console.error("service bus receiver error", args.error);
    },
  });

  process.on("SIGTERM", async () => {
    console.log("SIGTERM received. closing service bus receiver.");
    await receiver.close();
    await client.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Service Bus の受信は `createReceiver()` で receiver を作り、`subscribe()` で message handler を登録できます。([Microsoft Learn][1])

---

# 10. Worker用 package script

`package.json` に追加します。

```json
{
  "scripts": {
    "worker:report": "tsx worker/report-worker.ts"
  }
}
```

本番コンテナで TypeScript を直接動かさないなら、後で `tsc` ビルドに寄せます。
まずは実装速度優先なら `tsx` を入れます。

```bash
pnpm add -D tsx
```

---

# 11. Docker構成

Phase 1 では **同じDockerイメージをWeb/Workerで使い、起動コマンドだけ変える** のが楽です。

既存Dockerfileは Next.js standalone を `node server.js` で起動する形です。
Workerも同じイメージで動かしたいなら、standalone runner だけだと `worker/report-worker.ts` や `lib/*` が入らない可能性があります。

なので、Phase 1 はどちらかです。

## 案A：Web用とWorker用でDockerfileを分ける

おすすめです。

```text
Dockerfile
Dockerfile.worker
```

`Dockerfile.worker`：

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

CMD ["pnpm", "worker:report"]
```

デモ段階ならこれで十分です。

## 案B：既存Dockerfileを汎用化

本番っぽくするなら、`CMD` を環境変数で変える形もありますが、今は少しややこしくなります。

まずは **Dockerfile.worker を追加** がよいです。

---

# 12. Azure Container Apps 構成

```text
ca-report-web
  image: acr.azurecr.io/report-web:latest
  command: node server.js
  ingress: external
  targetPort: 3000

ca-report-worker
  image: acr.azurecr.io/report-worker:latest
  command: pnpm worker:report
  ingress: disabled
  minReplicas: 1
  maxReplicas: 1
```

Workerは最初 `minReplicas: 1` で常駐させます。
あとでKEDAのService Busスケールに変えればOKです。

---

# 13. 進捗ステータス

Phase 1 はまずこのくらいで十分です。

```ts
type ReportStatus =
  | "queued"
  | "generating_report"
  | "waiting_human_review"
  | "failed";
```

フロント表示はこう対応できます。

```text
queued:
  AIエージェントの処理待ちです

generating_report:
  事故報告書ドラフトを生成しています

waiting_human_review:
  AIドラフトの確認・修正ができます

failed:
  処理に失敗しました
```

Phase 2以降で増やします。

```ts
| "searching_camera"
| "fetching_images"
| "analyzing_images"
| "generating_photo_ledger"
```

---

# 14. 実装順序

まずはこの順番が安全です。

```text
1. Azure SQL 作成
2. reports / agent_runs テーブル作成
3. Service Bus queue 作成
4. lib/db.ts 追加
5. lib/report-repository.ts 追加
6. lib/service-bus.ts 追加
7. POST /api/reports を queued + enqueue に変更
8. GET /api/reports/:id/status をDB参照に変更
9. worker/report-worker.ts 追加
10. ローカルで Service Bus + Azure SQL に接続して動作確認
11. Dockerfile.worker 追加
12. Container Apps に worker を追加
13. Web → Queue → Worker → DB → Front polling の疎通確認
```

---

# 15. 最初の動作確認シナリオ

```bash
curl -X POST https://your-app.azurecontainerapps.io/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "accidentSummary": "1FからB1Fへ向かう下りエスカレーターで三角ガード板が落下し、お客様へ軽微接触した",
    "scenario": "escalator_guard_fall"
  }'
```

期待値：

```json
{
  "reportId": "report_xxx",
  "status": "queued"
}
```

すぐ確認：

```bash
curl https://your-app.azurecontainerapps.io/api/reports/report_xxx/status
```

期待値：

```json
{
  "reportId": "report_xxx",
  "status": "queued"
}
```

少し後：

```json
{
  "reportId": "report_xxx",
  "status": "waiting_human_review"
}
```

---

## ここでの重要判断

Phase 1では **Agent感を作り込みすぎない** のが大事です。

まずはこの1本を通す。

```text
BFFが受ける
Queueに積む
Workerが処理する
DBが更新される
Frontendが状態を見る
```

この背骨ができれば、Phase 2でBlob画像探索、Phase 3でAzure OpenAI接続、Phase 4で差分保存、Phase 5で店舗別プロンプト改善に自然に伸ばせます。

[1]: https://learn.microsoft.com/en-us/javascript/api/overview/azure/service-bus-readme?view=azure-node-latest "Azure Service Bus client library for JavaScript | Microsoft Learn"
[2]: https://learn.microsoft.com/en-us/azure/container-apps/jobs "Jobs in Azure Container Apps | Microsoft Learn"
[3]: https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-nodejs?view=azuresql "Use Node.js to Query a Database - Azure SQL Database & Azure SQL Managed Instance | Microsoft Learn"


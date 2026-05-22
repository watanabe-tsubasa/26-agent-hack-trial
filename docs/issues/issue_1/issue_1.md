はい、その感覚かなり正しいです。
**画像評価も、プロンプト改善 / 施設ナレッジ抽出も、最終的には worker に逃がす方が設計として自然**です。

理由はシンプルで、どちらもこれに該当します。

```text
- LLM / Vision API を呼ぶ
- 時間がかかる
- 失敗・リトライがありうる
- 結果をDBに保存する
- ユーザー操作と同期しなくてよい
- Service Bus による復旧耐性の恩恵を受けたい
```

今回 worker が落ちても Service Bus のおかげで復旧後に処理が進んだのを体験したので、なおさらここは worker 化したくなりますね。

## 切り分け案

### Web app がやること

Web app は **受付と状態表示**に寄せます。

```text
- ユーザー入力を受ける
- DBに status を保存する
- Service Bus に job を積む
- 結果を表示する
- approve / edit など人間操作を受ける
```

### Worker がやること

Worker は **時間がかかるAI処理**を担当します。

```text
- 事故報告書生成
- 画像評価
- 施設ナレッジ候補生成
- PDF生成
- 外部API参照
- retry 前提の処理
```

## 現状の整理

今の状態だと：

```text
事故報告書生成:
  worker

画像評価:
  worker
  ※ mock-agent 内で report generation の前段として呼ぶならOK

Phase 5 改善案生成:
  Web API /api/admin/run-prompt-improvement
```

なので、**Phase 5 だけまだ Web 側に重い処理が残っている**状態です。

## 理想形

```text
POST /api/admin/run-prompt-improvement
↓
DB に prompt_improvement_runs を running で作成
↓
Service Bus に job enqueue
↓
すぐ runId を返す
↓
Worker が job を consume
↓
report_corrections を集計
↓
AI で施設ナレッジ候補を生成
↓
location_prompt_overrides or facility_knowledge に draft 保存
↓
prompt_improvement_runs を completed / failed に更新
↓
UI は run status / draft list を polling
```

これが一番きれいです。

## Service Bus queue は分けるべき？

選択肢は2つあります。

### 案A: 既存 queue を使い、message type を持たせる

```ts
type AgentJobMessage =
  | {
      type: "generate_report";
      reportId: string;
    }
  | {
      type: "generate_facility_knowledge";
      runId: string;
      locationKey: string;
    };
```

Queue は1つ。

```text
report-generation-requests
```

メリット：

```text
- Azureリソース追加なし
- 実装が早い
- worker も1本でよい
```

デメリット：

```text
- queue名と中身がズレる
- report job と improvement job が混ざる
```

### 案B: queue を分ける

```text
report-generation-requests
prompt-improvement-requests
```

メリット：

```text
- 責務が明確
- 片方が詰まっても分離しやすい
- 将来 scale rule を分けやすい
```

デメリット：

```text
- Azure Service Bus queue 追加が必要
- env 追加が必要
- worker を分けるか、複数 queue listen が必要
```

## 今のフェーズでのおすすめ

ハッカソン前なら **案A: 既存 queue に type を持たせる** がよさそうです。

理由：

```text
- 新しい Azure リソースを増やさない
- 既存 Service Bus の復旧性を使える
- API の同期処理を軽くできる
- デモには十分
```

ただし queue 名が `report-generation-requests` だと違和感があるので、将来的には：

```text
agent-jobs
```

みたいにリネーム or 新規 queue にするとよいです。

## 画像評価はどうする？

画像評価は、今のまま **report generation worker の中で実行**でOKです。

理由：

```text
画像評価は事故報告書生成の前処理
↓
画像評価結果が imageObservation になる
↓
そのまま報告書生成AIに渡す
```

つまり1つの report job 内に含めるのが自然です。

```text
generate_report job
↓
camera frame search
↓
image evaluation
↓
report generation
↓
save draft
```

これは分けなくていいです。分けると状態管理が増えます。

## Phase 5 は worker 化した方がよい

一方、施設ナレッジ生成は report とは別ジョブです。

```text
generate_facility_knowledge job
```

これは worker に逃がす価値があります。

Web API は：

```text
POST /api/admin/run-prompt-improvement
```

で AI を直接呼ばずに：

```text
run record 作成
Service Bus enqueue
return { runId, status: "queued" }
```

にする。

## 必要な変更

### 1. job message type を作る

```ts
export type AgentJobMessage =
  | {
      type: "generate_report";
      reportId: string;
    }
  | {
      type: "generate_facility_knowledge";
      runId: string;
      locationKey: string;
    };
```

今の queue に `reportId` だけを積んでいるなら、後方互換のために worker 側でこう読むと安全です。

```ts
function parseJobMessage(body: unknown): AgentJobMessage {
  if (typeof body === "string") {
    return { type: "generate_report", reportId: body };
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "reportId" in body &&
    !("type" in body)
  ) {
    return {
      type: "generate_report",
      reportId: String((body as { reportId: unknown }).reportId),
    };
  }

  return body as AgentJobMessage;
}
```

### 2. `/api/reports` 側を変更

今は多分 `reportId` だけ enqueue しているはずです。

変更後：

```ts
await enqueueAgentJob({
  type: "generate_report",
  reportId,
});
```

### 3. `/api/admin/run-prompt-improvement` 側を変更

今：

```text
API route 内で AI 生成まで実行
```

変更後：

```text
createPromptImprovementRun
enqueueAgentJob({ type: "generate_facility_knowledge", runId, locationKey })
return { runId, status: "queued" }
```

### 4. worker 側を分岐

```ts
switch (job.type) {
  case "generate_report":
    await handleGenerateReport(job.reportId);
    break;

  case "generate_facility_knowledge":
    await handleGenerateFacilityKnowledge({
      runId: job.runId,
      locationKey: job.locationKey,
    });
    break;
}
```

### 5. prompt_improvement_runs に queued を追加

今 status が `running / completed / failed` なら：

```text
queued
running
completed
failed
```

にしたいです。

API で作成時：

```text
queued
```

worker が拾ったら：

```text
running
```

完了：

```text
completed
```

失敗：

```text
failed
```

### 6. UI は polling

管理画面は「改善案生成」ボタンを押したらすぐ `runId` を受け取る。

```text
改善案生成を受け付けました
生成中...
```

数秒おきに：

```text
GET /api/prompt-improvement-runs/:id
```

または、簡単に：

```text
GET /api/location-prompt-overrides?locationKey=store-001
```

を再取得して、draft が増えたら完了扱いでもOKです。

## Claude Code に渡すなら

```text
Phase 5 の改善案生成処理を Web API 同期実行から worker 非同期実行に変更してください。

背景:
現在 POST /api/admin/run-prompt-improvement が Web Container App 上で report_corrections 集計と Azure OpenAI 呼び出しまで同期実行している。
画像評価と同様、AI処理は時間がかかり失敗・再試行がありうるため、Service Bus + worker に逃がしたい。

方針:
- 新しい Azure サービスは作らない
- 既存の Service Bus queue を使う
- 既存 worker に job type 分岐を追加する
- 画像評価は report generation worker 内の前処理として現状維持
- Phase 5 の施設ナレッジ生成だけを worker job 化する

実装要件:
1. AgentJobMessage 型を作成
   - type: "generate_report", reportId
   - type: "generate_facility_knowledge", runId, locationKey

2. 既存の enqueue 処理を更新
   - /api/reports は { type: "generate_report", reportId } を enqueue
   - 後方互換のため、worker は旧形式の reportId message も処理できるようにする

3. /api/admin/run-prompt-improvement を変更
   - AI 生成を直接実行しない
   - prompt_improvement_runs に queued の run を作成
   - Service Bus に { type: "generate_facility_knowledge", runId, locationKey } を enqueue
   - { runId, locationKey, status: "queued" } を返す

4. worker/report-worker.ts を変更
   - message body を parse
   - type に応じて処理分岐
   - generate_report は既存処理
   - generate_facility_knowledge は report_corrections 集計 → AI生成 → draft保存 → run completed
   - 失敗時は run failed にして error_message 保存

5. prompt-improvement-run-repository.ts を拡張
   - queued / running / completed / failed を扱えるようにする
   - markRunning 関数を追加
   - create 時は queued で作れるようにする

6. 必要なら GET /api/prompt-improvement-runs/:id を追加
   - UI polling 用
   - run status / errorMessage / proposedOverrideId を返す

7. 管理画面
   - 改善案生成ボタン押下後、runId と queued を表示
   - polling で completed / failed を確認
   - completed 後に overrides を再取得
   - 認証は今回不要

8. ログ
   - worker log に job type / runId / locationKey / completed / failed を出す
   - prompt本文、API key、SAS URL は出さない

9. 確認
   - npx tsc --noEmit
   - 既存 report generation が壊れていない
   - 改善案生成が queued → running → completed になる
   - draft が location_prompt_overrides に作られる
```

## 将来的な整理

本番っぽくするなら、最終形はこうです。

```text
Queue 1:
  report-generation-requests
  事故報告書生成専用

Queue 2:
  facility-knowledge-generation-requests
  施設ナレッジ生成専用

Worker 1:
  report worker

Worker 2:
  knowledge worker
```

ただ、今は既存 queue + type で十分です。

## 結論

```text
画像評価:
  すでに worker 内でOK

プロンプト改善 / 施設ナレッジ生成:
  worker に逃がした方がよい

Web:
  enqueue と status 表示だけにする
```

これはかなり自然な進化です。
AIエージェント開発では、**LLMを呼ぶ処理は基本 worker / job に逃がす**という設計に寄せると、落ちても戻れるし、UIも固まりにくいです。

```text: user
いや、Service Busは分けましょう。エージェントの一連の動作と、プロンプトの改善フローを、いくらハッカソンとはいえ同じqueueで管理するのは違和感があります
```

賛成です。そこは分けた方が設計として自然です。
**事故報告書生成のエージェント処理**と、**施設ナレッジ / プロンプト改善フロー**はライフサイクルも優先度も失敗時の扱いも違うので、同じ queue に混ぜない方が良いです。

## 分けるべき理由

```text
report-generation-requests:
  ユーザーが待っている本線処理
  優先度が高い
  滞留すると画面が「待機中」になる
  worker停止時の復旧が重要

prompt-improvement-requests:
  管理系・改善系の非同期処理
  ユーザーの報告書作成を直接ブロックしない
  時間がかかってもよい
  失敗しても本線には影響させない
```

同じ queue にすると、改善ジョブが詰まったときに報告書生成まで遅れる可能性があります。これは避けたいです。

## 方針

Service Bus Queue を新しく1つ追加。

```text
report-generation-requests
  既存
  事故報告書生成用

prompt-improvement-requests
  新規
  施設ナレッジ / 改善案生成用
```

env も分けます。

```env
SERVICE_BUS_REPORT_QUEUE_NAME=report-generation-requests
SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME=prompt-improvement-requests
```

## Azure 側で作るもの

新規 Azure サービスではなく、既存 Service Bus Namespace 内に queue を追加するだけです。

```bash
az servicebus queue create \
  --resource-group rg-agent-hack-trial \
  --namespace-name sb-agent-hack-trial-29739 \
  --name prompt-improvement-requests
```

作成確認：

```bash
az servicebus queue list \
  --resource-group rg-agent-hack-trial \
  --namespace-name sb-agent-hack-trial-29739 \
  -o table
```

## Container Apps に env 追加

Web app 側は、改善ジョブを enqueue するので必要です。

```bash
az containerapp update \
  --name agent-hack-trial \
  --resource-group AdLabo \
  --set-env-vars \
    SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME="prompt-improvement-requests"
```

Worker 側も、改善 queue を consume するなら必要です。

```bash
az containerapp update \
  --name agent-hack-trial-worker \
  --resource-group AdLabo \
  --set-env-vars \
    SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME="prompt-improvement-requests"
```

ただし、worker を1プロセスで2 queue listen するか、改善専用 worker を別 Container App にするかで少し変わります。

## worker 構成案

### 案A: 同じ worker が2つの queue を listen

```text
agent-hack-trial-worker
  - report-generation-requests を listen
  - prompt-improvement-requests を listen
```

メリット：

```text
Azure Container App を増やさない
実装が早い
env 追加だけで済む
```

デメリット：

```text
同じプロセス内で2種類の処理を持つ
スケール分離は弱い
```

### 案B: 改善専用 worker Container App を作る

```text
agent-hack-trial-worker
  report-generation-requests

agent-hack-trial-improvement-worker
  prompt-improvement-requests
```

メリット：

```text
責務がきれい
スケール分離できる
ログが分かれる
片方の障害がもう片方に影響しにくい
```

デメリット：

```text
Container App が1つ増える
CI/CD 設定も増える
ハッカソンには少し重い
```

## 今のおすすめ

今回は **queue は分けるが、worker Container App は一旦同じ** が良いと思います。

```text
Queue は分離:
  report-generation-requests
  prompt-improvement-requests

Worker は一旦1つ:
  agent-hack-trial-worker が両方 listen
```

これなら設計上の違和感を解消しつつ、Azure リソース増加は queue 1つだけです。
将来、必要になったら improvement worker を独立させればOKです。

## 実装イメージ

### `/api/admin/run-prompt-improvement`

同期で AI を呼ばない。

```text
POST /api/admin/run-prompt-improvement
↓
prompt_improvement_runs に queued 作成
↓
prompt-improvement-requests に message enqueue
↓
return { runId, status: "queued" }
```

message：

```ts
type PromptImprovementJobMessage = {
  runId: string;
  locationKey: string;
};
```

report queue とは別なので、`type` はなくてもよいです。
queue が分かれているので message schema もシンプルにできます。

### report worker

既存のまま。

```ts
type ReportGenerationMessage = {
  reportId: string;
};
```

### improvement worker

同じプロセス内で別 receiver を作る。

```ts
const reportReceiver = serviceBusClient.createReceiver(reportQueueName);
const improvementReceiver = serviceBusClient.createReceiver(promptImprovementQueueName);
```

それぞれ handler を分けます。

```ts
await Promise.all([
  startReportWorker(reportReceiver),
  startPromptImprovementWorker(improvementReceiver),
]);
```

## Claude Code に渡す要求事項

```text
Phase 5 の施設ナレッジ生成 / プロンプト改善フローを worker 非同期処理に移します。
ただし、事故報告書生成 queue と改善 queue は分けます。

方針:
- 既存 queue: report-generation-requests
  - 事故報告書生成専用
- 新規 queue: prompt-improvement-requests
  - 施設ナレッジ生成 / 改善案生成専用
- Web API は改善案生成を同期実行しない
- Web API は prompt_improvement_runs を queued で作成し、prompt-improvement-requests に enqueue して即 return
- worker が prompt-improvement-requests を consume し、AI生成・draft保存・run完了更新を行う

Azure:
- 新しい Azure サービスは作らない
- 既存 Service Bus Namespace に queue を1つ追加する
- queue name は prompt-improvement-requests
- env は SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME を追加する

実装要件:

1. env
- SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME を読む
- 未設定時は prompt improvement worker は起動時に明確なエラーを出す、または改善 queue の listen を skip する
- report generation queue は既存の SERVICE_BUS_REPORT_QUEUE_NAME を使い続ける

2. /api/admin/run-prompt-improvement
- 現在の AI 直接実行をやめる
- prompt_improvement_runs に status=queued の run を作る
- Service Bus の prompt-improvement-requests に以下を enqueue
  {
    "runId": "...",
    "locationKey": "store-001"
  }
- response は { runId, locationKey, status: "queued" }

3. prompt-improvement-run-repository.ts
- status に queued / running / completed / failed を扱えるようにする
- create 時は queued
- markRunning(runId)
- completePromptImprovementRun(...)
- failPromptImprovementRun(...)

4. worker
- report-generation-requests の処理は既存通り維持
- prompt-improvement-requests 用 receiver を追加
- prompt improvement message を受信したら:
  - run を running に更新
  - report_corrections を locationKey 単位で集計
  - 施設ナレッジ候補 / override draft を AI 生成
  - location_prompt_overrides に draft 保存
  - prompt_improvement_runs を completed に更新
  - 失敗時は failed + error_message 保存
- report queue と prompt improvement queue の処理ログは分ける

5. 型
- PromptImprovementJobMessage 型を追加
- message parse / validation を入れる
- 不正 message は fail し、ログに出す

6. UI
- 改善案生成ボタン押下後、queued と runId を表示
- completed まで polling する
- まずは簡易で、数秒おきに run status API を見る
- completed 後に location_prompt_overrides を再取得
- failed なら error_message を表示

7. API追加
- GET /api/prompt-improvement-runs/:id
  - runId
  - locationKey
  - status
  - inputCorrectionCount
  - proposedOverrideId
  - errorMessage
  - createdAt
  - completedAt

8. ログ
- report worker:
  [report:<reportId>] start/completed/failed
- improvement worker:
  [prompt-improvement:<runId>] start/completed/failed locationKey=...
- secret, prompt全文, SAS URL はログに出さない

9. 確認
- npx tsc --noEmit
- 既存の事故報告書生成が壊れていない
- prompt-improvement-requests に job が積まれる
- worker が improvement job を処理する
- prompt_improvement_runs が queued → running → completed になる
- location_prompt_overrides に draft が作成される
```

## Azure CLI 作業

Claude Code にやらせるか、自分でやるならこれです。

```bash
az servicebus queue create \
  --resource-group rg-agent-hack-trial \
  --namespace-name sb-agent-hack-trial-29739 \
  --name prompt-improvement-requests
```

env 追加：

```bash
az containerapp update \
  --name agent-hack-trial \
  --resource-group AdLabo \
  --set-env-vars \
    SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME="prompt-improvement-requests"
```

```bash
az containerapp update \
  --name agent-hack-trial-worker \
  --resource-group AdLabo \
  --set-env-vars \
    SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME="prompt-improvement-requests"
```

queue 確認：

```bash
az servicebus queue list \
  --resource-group rg-agent-hack-trial \
  --namespace-name sb-agent-hack-trial-29739 \
  -o table
```

## デモでの説明

これ、説明もしやすいです。

```text
事故報告書生成と改善案生成は処理の性質が違うため、Service Bus queue を分けています。
報告書生成はユーザーが待っている本線処理、改善案生成は管理系の非同期処理です。
それぞれ独立した queue にすることで、改善処理が詰まっても報告書生成に影響しない構成にしています。
```

この判断、かなり良いです。
「動けばいい」ではなく、**業務処理と改善処理の責務分離**になっていて、ちゃんとアーキテクチャとして説明できます。

```txt: user
worker 構成は案Aの現在利用しているagent-hack-trial-workerがそれぞれのBusをlistenする形式で行きましょう
```
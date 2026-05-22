はい、その挙動は直した方がいいです。
ただし、**フロントが Service Bus を直接監視する設計にはしない方がよい**です。

Service Bus の `activeMessageCount` は便利ですが、フロントの状態管理の主軸にするには少し粗いです。

```text
activeMessageCount:
  queue 全体の件数
  locationKey ごとの件数ではない
  worker が message を lock して処理中だと active から見えなくなることがある
  UI の正確な「この施設の改善案生成中」判定には向かない
```

なのでおすすめは、**Service Bus は処理配送、DB は状態管理**です。

## 方針

```text
フロント:
  prompt_improvement_runs を見る

API:
  queued / running がある場合は新規投入しない

Worker:
  running → completed / failed に更新する

万一重複した場合:
  最新 run だけ有効にして、古い run / draft は superseded / archived にする
```

## こういう状態管理にするのがよさそうです

`prompt_improvement_runs.status` を以下にします。

```text
queued
running
completed
failed
superseded
```

意味はこうです。

```text
queued:
  queue に投入済み、worker 未処理

running:
  worker 処理中

completed:
  draft 生成完了

failed:
  失敗

superseded:
  より新しい run があるため無効化
```

## フロントの制御

管理画面では、まず最新 run を見ます。

```text
GET /api/prompt-improvement-runs/latest?locationKey=store-001
```

レスポンス例：

```json
{
  "run": {
    "id": "pir_xxx",
    "locationKey": "store-001",
    "status": "queued",
    "createdAt": "2026-05-22T..."
  },
  "canCreateNewRun": false
}
```

`status` が `queued` or `running` の場合は、ボタンを disabled にします。

```text
改善案を生成中...
```

`completed` / `failed` / `superseded` の場合だけ、再生成できるようにします。

## POST 側でも必ずガードする

UI でボタンを無効化しても、更新や連打、別タブ、curl で重複投入できます。
なので、**POST /api/admin/run-prompt-improvement 側で必ず防ぐ**必要があります。

処理イメージ：

```text
POST /api/admin/run-prompt-improvement
↓
locationKey = store-001
↓
DBで queued / running の run があるか確認
↓
ある:
  新規作成せず、その run を返す
↓
ない:
  run を queued で作成
  Service Bus に enqueue
  runId を返す
```

レスポンス例：

```json
{
  "runId": "pir_existing",
  "locationKey": "store-001",
  "status": "queued",
  "alreadyRunning": true
}
```

これなら、何回押しても queue に積まれません。

## DB 側でも守る

さらに堅くするなら、SQL Server 側に制約を入れます。

```sql
create unique index ux_prompt_improvement_runs_one_active
on prompt_improvement_runs(location_key)
where status in ('queued', 'running');
```

これで、同じ `location_key` に対して `queued` / `running` が同時に複数作れなくなります。

ただし migration で既存重複があると失敗するので、先に重複整理が必要です。

ハッカソンなら、まずはアプリ側 transaction で十分かもです。

## 競合対策

POST が同時に2回飛ぶと、単純な `select → insert` では両方 insert される可能性があります。
SQL Server なら transaction 内でロックを取るのが安全です。

イメージ：

```sql
begin transaction;

select top 1 *
from prompt_improvement_runs with (updlock, holdlock)
where location_key = @locationKey
  and status in ('queued', 'running')
order by created_at desc;

-- 既存があればそれを返す
-- なければ insert

commit;
```

これで同時押しにも強くなります。

## 「それでも2つ以上できた場合」の処理

ここも入れておくと安心です。

### 1. Worker が処理開始時に最新 run か確認

worker が `prompt-improvement-requests` を受け取ったら、まずこれを確認します。

```text
この runId は、この locationKey の最新 queued/running run か？
```

違うなら：

```text
status = superseded
message complete
AI は呼ばない
draft も作らない
```

これで queue に重複 message が残っていても、古いものは処理されません。

### 2. completed 後、古い draft を archived にする

もし複数 draft ができてしまった場合は、最新以外を archived にします。

```text
location_prompt_overrides
where location_key = store-001
and status = draft
and id != latestDraftId
→ archived
```

または source が `ai_proposed` のものだけ対象。

```sql
update location_prompt_overrides
set status = 'archived'
where location_key = @locationKey
  and source = 'ai_proposed'
  and status = 'draft'
  and id <> @latestOverrideId;
```

## Service Bus の監視はどう使うか

Service Bus の queue count は、UI の主状態ではなく **運用補助**として使うのが良いです。

例えば管理画面の小さなデバッグ表示：

```text
改善キュー滞留数: 2
Dead Letter: 0
```

これは API 経由でサーバー側から取るならありです。

```text
GET /api/admin/queue-status
```

ただし、改善案生成ボタンの disabled 判定は Service Bus count ではなく、`prompt_improvement_runs` の `queued/running` を見るのが良いです。

## Claude Code に渡す指示

```text
Phase 5 の改善案生成で、同じ locationKey に対して複数の改善ジョブが投入できてしまう問題を修正してください。

現状:
- 管理画面で「改善案を生成」を押す
- queue に prompt-improvement job が投入される
- 画面更新後、処理中でも再度ボタンを押せる
- 結果として prompt-improvement-requests に複数 message が溜まる

修正方針:
- Service Bus は処理配送に使う
- フロントの状態管理は prompt_improvement_runs を source of truth にする
- 同じ locationKey に queued / running の run が存在する場合、新しい run は作らない
- UI では queued / running の間、改善案生成ボタンを disabled にする
- それでも重複 run / message ができた場合は、最新 run 以外を superseded / archived にする

実装要件:

1. prompt_improvement_runs の status を整理
- queued
- running
- completed
- failed
- superseded

2. Repository 修正
- getLatestPromptImprovementRun(locationKey)
- getActivePromptImprovementRun(locationKey)
  - status in queued/running
- createQueuedPromptImprovementRunIfNotExists(locationKey)
  - queued/running がある場合は既存 run を返す
  - ない場合だけ新規 run を作る
  - 可能なら transaction + updlock/holdlock で同時実行に強くする
- markRunning(runId)
- markSuperseded(runId)

3. POST /api/admin/run-prompt-improvement 修正
- まず active run を確認
- active run があれば Service Bus に enqueue せず、その run を返す
- response に alreadyRunning: true を含める
- active run がなければ queued run を作成し、prompt-improvement-requests に enqueue
- response に alreadyRunning: false を含める

期待レスポンス例:
{
  "runId": "...",
  "locationKey": "store-001",
  "status": "queued",
  "alreadyRunning": true
}

4. GET /api/prompt-improvement-runs/latest
- query: locationKey
- 最新 run を返す
- queued/running の場合 canCreateNewRun=false
- completed/failed/superseded/null の場合 canCreateNewRun=true

5. 管理画面
- 初期表示時と更新時に latest run を取得
- latest run が queued/running なら「改善案生成中」と表示
- ボタンを disabled にする
- queued/running の間は polling する
- completed になったら overrides を再取得する
- failed なら errorMessage を表示して再生成可能にする

6. Worker 側
- prompt improvement message を受け取ったら、まず run を確認
- その run が locationKey の最新 active run でない場合、superseded にして message complete
- AI 生成は行わない
- running に更新してから AI 生成開始
- completed 時に draft を作成する
- completed 後、同じ locationKey の古い draft ai_proposed を archived にする
- failed 時は error_message を保存する

7. 古い draft の整理
- 新しい draft が作られたら、同じ locationKey の source=ai_proposed かつ status=draft の古いものを archived にする
- active は勝手に archived にしない
- active を切り替えるのは approve API のみ

8. DB制約は任意
- 余裕があれば SQL Server filtered unique index を検討
- location_key ごとに queued/running は1件だけ
- ただし既存データに重複がある場合 migration が落ちるので注意

9. Service Bus queue count
- UIの主状態には使わない
- 必要ならデバッグ表示用 API として別途検討
- ボタン制御は DB の prompt_improvement_runs を見る

10. 確認
- npx tsc --noEmit
- 改善案生成ボタンを連打しても queue に複数積まれない
- 画面更新後も queued/running 中はボタンが押せない
- queued → running → completed が表示される
- completed 後は再度生成できる
- 既に重複 message がある場合も、最新以外は superseded になる
```

## 既に溜まった queue への対応

今 `active = 2` なら、worker が順に拾うはずです。
新しい実装後は、古いものは `superseded` になって AI を呼ばずに終わるのが理想です。

今すぐ一旦状態を見るなら：

```sql
select top 20
  id,
  location_key,
  status,
  proposed_override_id,
  error_message,
  created_at,
  completed_at
from prompt_improvement_runs
order by created_at desc;
```

そして queue 状態：

```bash
az servicebus queue show \
  --resource-group rg-agent-hack-trial \
  --namespace-name sb-agent-hack-trial-29739 \
  --name prompt-improvement-requests \
  --query "{active:countDetails.activeMessageCount, deadLetter:countDetails.deadLetterMessageCount}" \
  -o table
```

## 結論

やるべきことは、**Service Bus を直接監視して UI 制御するのではなく、DB の run status を正にする**ことです。

```text
Service Bus:
  実行待ちメッセージを運ぶ

prompt_improvement_runs:
  UI と業務状態の source of truth
```

これにすると、画面更新・連打・複数タブ・worker 処理中のどれにも強くなります。

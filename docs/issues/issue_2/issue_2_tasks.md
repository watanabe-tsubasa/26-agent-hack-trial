# issue_2 タスク管理 — 改善案生成ジョブの重複投入防止

> 対応 issue: `docs/issues/issue_2.md`
>
> 方針:
> - **Service Bus は配送、DB (prompt_improvement_runs) は状態の source of truth**
> - 同じ locationKey に `queued` / `running` がある場合は新規 run を作らず既存を返す
> - UI 連打・複数タブ・ページ更新・curl すべてに耐える設計
> - 万一複数 message が積まれた場合は worker が古い run を `superseded` にして AI を呼ばない
> - 新しい draft が完成したら、同 locationKey の古い ai_proposed draft は archived に

---

## 1. status 拡張

- [ ] `prompt_improvement_runs.status` に **`superseded`** を追加（コード上だけ）
  - DB は `nvarchar(32)` なのでスキーマ変更不要
  - 既存 'queued' / 'running' / 'completed' / 'failed' に併存

---

## 2. リポジトリ拡張

- [ ] `lib/prompt-improvement-run-repository.ts`
  - `getActivePromptImprovementRun(locationKey)` — queued / running の最新 run
  - `getLatestPromptImprovementRun(locationKey)` — status 問わず最新 run
  - `createQueuedPromptImprovementRunIfNotExists(locationKey)`
    - **transaction + `with (updlock, holdlock)`** で同時実行に強い
    - 既存 active があれば `{ runId, alreadyRunning: true }` を返す
    - なければ新規 insert して `{ runId, alreadyRunning: false }` を返す
  - `markPromptImprovementRunSuperseded(id)` — running 中で古い run を無効化
  - 既存 `createPromptImprovementRun` は使い回さない（重複を許してしまうので廃止 or wrap）

---

## 3. API: enqueue guard

- [ ] `app/api/admin/run-prompt-improvement/route.ts`
  - `createQueuedPromptImprovementRunIfNotExists` を呼ぶ
  - `alreadyRunning=true` の場合は enqueue **しない**（既に queue にある）
  - レスポンスに `alreadyRunning` を含める
  - `alreadyRunning=false` のときだけ Service Bus に enqueue

---

## 4. API: latest run 取得

- [ ] `app/api/prompt-improvement-runs/latest/route.ts`（新規）
  - query: `?locationKey=store-001`
  - 最新 run と `canCreateNewRun` を返す
  - `canCreateNewRun = status が queued/running ではない` (または run なし)

---

## 5. Worker: 古い run の supersede

- [ ] `worker/report-worker.ts` / `lib/prompt-improvement-processor.ts`
  - message 受信時にまず active run を確認
  - 受け取った runId が active run と一致しない → **`superseded`** にして AI を呼ばずに complete (message ack)
  - 一致 → 通常通り `markRunning` → AI 生成 → completed
  - ログ: `[prompt-improvement:<runId>] superseded reason=...`

---

## 6. Processor: 古い draft の archive

- [ ] `lib/prompt-improvement-processor.ts`
  - completed 時、新しい draft 作成後に
    - 同 locationKey の `source=ai_proposed` かつ `status=draft` のうち、自分以外を `archived` に
  - `active` は触らない（approve flow が管理）
- [ ] `lib/location-prompt-override-repository.ts`
  - `archiveOtherAiProposedDrafts(locationKey, keepId)` を追加

---

## 7. UI: 状態は DB ベース

- [ ] `app/admin/prompt-improvements/page.tsx`
  - 初期表示時に `/api/prompt-improvement-runs/latest?locationKey=...` を取得
  - `queued` / `running` の場合
    - ボタンを disabled
    - 状態バッジ表示
    - 3秒間隔で polling 継続
  - `completed` で polling 停止、override list を再取得
  - `failed` で errorMessage 表示、再生成可
  - 連打防止: API が `alreadyRunning=true` を返した場合の表示も対応

---

## 8. 型・ビルド確認

- [ ] `npx tsc --noEmit`

---

## 9. 動作確認（ユーザー対応）

- [ ] 改善案生成ボタンを連打しても run が増えない（既存 runId を返す）
- [ ] 別タブから同時押ししても 1 run しか作られない（transaction の効果）
- [ ] queued/running 中はボタンが disabled
- [ ] 既に重複 message があった状態でも、古い run は AI を呼ばずに superseded になる
- [ ] completed 後に再度生成可能
- [ ] 既存の running データが残っていた場合の影響（手動で superseded/failed に書き換えるか、completed_at 経過で扱う）

---

## 10. 想定外: DB unique index は今回見送り

- 検討: `unique index ... where status in ('queued','running')`
- 既存重複データがあると migration が落ちるため、ハッカソンでは **アプリ側 transaction** のみで対応
- 将来余裕があれば追加

---

## 設計メモ

### createQueuedPromptImprovementRunIfNotExists の SQL イメージ
```sql
begin transaction;

select top 1 id, status
from prompt_improvement_runs with (updlock, holdlock)
where location_key = @locationKey
  and status in ('queued', 'running')
order by created_at desc;

-- 既存なら id を返す（insert しない）
-- なければ insert @id ... 'queued'

commit;
```

mssql の `Transaction` を使い、`request.transaction = tx` で同一 transaction 内で SELECT → INSERT を実行する。

### Worker での active-run チェックの順序
1. parse message → runId, locationKey
2. **markRunning する前に** `getActivePromptImprovementRun(locationKey)` を取得
3. activeRun?.id !== runId → markSuperseded(runId) → return（ack）
4. activeRun?.id === runId → markRunning → AI 生成 → completed

### 旧 draft archive のスコープ
- `source = 'ai_proposed'` かつ `status = 'draft'` のものだけが対象
- `manual` 由来や `active` / `archived` は触らない
- 新規 draft の id を `keepId` として除外する

# Phase 4 タスク管理 — confirm時の差分保存（AI vs 人間修正）

> 方針: confirm時に `ai_draft_json` と `user_draft_json` を比較してフィールド単位の差分を生成・保存する。  
> UI変更は最小限。将来 Phase 5 で `report_corrections.diff_json` を読んでプロンプト改善に使う。

---

## 1. DBマイグレーション

- [x] `scripts/migrate.ts` — `report_corrections` テーブル追加

```sql
create table report_corrections (
  id               nvarchar(64)  not null primary key,
  report_id        nvarchar(64)  not null,
  ai_draft_json    nvarchar(max) not null,
  user_draft_json  nvarchar(max) not null,
  diff_json        nvarchar(max) not null,
  correction_reason nvarchar(max) null,
  created_at       datetime2     not null default sysutcdatetime()
)
```

---

## 2. JSON 差分ライブラリ

- [x] `lib/json-diff.ts` — `diffJson(before, after, basePath?)` → `JsonDiffItem[]`
  - プレーンオブジェクト: キー単位で再帰比較
  - 配列: インデックスベース比較（LCS は Phase 5 以降で対応）
  - プリミティブ: `Object.is` で比較 → 差分があれば `changeType: "update"`
  - 型: `JsonDiffItem { fieldPath, before, after, changeType: "add"|"update"|"delete" }`

---

## 3. report_corrections リポジトリ

- [x] `lib/report-correction-repository.ts` — `saveReportCorrection`
  - 引数: `{ reportId, aiDraftJson, userDraftJson, diffItems }`
  - id は `correction_${randomUUID()}`
  - diff が空（修正なし）の場合は保存しない（confirm ルート側で制御）

---

## 4. report-repository 更新

- [x] `lib/report-repository.ts` — `getReportDrafts(reportId)` 追加
  - `ai_draft_json` と `user_draft_json` を生の JSON 文字列で返す
  - confirm ルートで diff 計算に使用

---

## 5. confirm API 更新

- [x] `app/api/reports/[id]/confirm/route.ts`

```
POST /api/reports/:id/confirm
  ↓
ai_draft_json / user_draft_json を取得
  ↓
両方ある場合: title/victim/fiveWTwoH/cause/treatment/preventiveAction/body を比較
  ↓
diff が 1 件以上ある場合のみ report_corrections に保存
  ↓
status = confirmed
```

差分対象フィールド（メタデータは除外）:
`title`, `victim`, `fiveWTwoH`, `cause`, `treatment`, `preventiveAction`, `body`

---

## 6. 追加実装（azure_handling.md 反映）

- [x] `app/api/reports/[id]/confirm/route.ts` — diff 保存を try/catch で囲み、失敗しても confirm は通す
- [x] `lib/report-correction-repository.ts` — `getCorrectionsForReport()` 追加
- [x] `app/api/reports/[id]/corrections/route.ts` — `GET /api/reports/:id/corrections` 追加
  - 返り値: `{ reportId, corrections: [{ id, diff: JsonDiffItem[], createdAt }] }`

---

## 7. DB マイグレーション（実施済み）

- [x] `npx --env-file=.env.local tsx scripts/migrate.ts` を実行
  - 接続先: `sql-agent-hack-trial-21202.database.windows.net`（本番 Azure SQL）
  - `report_corrections` テーブル作成確認済み

---

## 8. 動作確認（ユーザー対応）

- [ ] 報告書を新規作成 → AIドラフトを確認
- [ ] いくつかのフィールドを修正して「修正内容を保存」
- [ ] 「この内容で確定」を押す
- [ ] `GET /api/reports/:id/corrections` を呼んで diff が返ることを確認

```sql
select top 10 id, report_id, diff_json, created_at
from report_corrections order by created_at desc;
```

- [ ] 修正せず確定した場合 → `report_corrections` に保存されない（diff 件数 0）

---

## 9. Container Apps デプロイ（ユーザー対応）

- [ ] `git push origin main` でデプロイ（CI/CD 自動実行）
  - confirm ルートの try/catch と corrections API が本番に反映される

---

## 将来フェーズとの接続

| Phase | 変更内容 |
|---|---|
| Phase 5 | `report_corrections.diff_json` を読んでプロンプト改善 Job を実装 |
| Phase 5 | `correction_reason` フィールドに修正理由をUIから入力できるようにする |

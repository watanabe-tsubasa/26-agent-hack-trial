

## 1. まずやること：DB マイグレーション

ローカル、または本番環境で `report_corrections` テーブルを作る必要があります。

```bash
pnpm migrate
```

今回 `scripts/migrate.ts` に `report_corrections` テーブル追加済みなので、これを実行すれば OK です。

本番に反映する場合は、先に GitHub に push してデプロイ後、Container Apps / Codespaces / 手元など、接続先が本番 DB になっている環境で migrate を実行します。

## 2. Phase 4 の動作確認

次に、実際に差分が保存されるか確認します。

確認シナリオはこれで十分です。

```text
1. 新規事故報告書を作成
2. AI draft が生成される
3. 画面上で以下のどれかを人間が修正
   - title
   - fiveWTwoH.where
   - cause
   - treatment
   - preventiveAction
   - body
4. 確定ボタンを押す
5. report_corrections に diff_json が保存されているか確認
```

確認用 SQL の例です。

```sql
select top 10
  id,
  report_id,
  diff_json,
  created_at
from report_corrections
order by created_at desc;
```

特に見たいのは、`diff_json` がこういう形になっているかです。

```json
[
  {
    "fieldPath": "fiveWTwoH.where",
    "before": "2階エスカレーター付近",
    "after": "2階 上りエスカレーター降り口付近",
    "changeType": "update"
  }
]
```

## 3. エッジケース確認

Phase 4 はデモ用途ならかなりシンプルでよいですが、最低限ここは確認したいです。

### 修正なしで確定した場合

今回の実装では、差分 0 件なら `report_corrections` に保存しない設計です。

これは自然です。
ただし Phase 5 で「修正なしだった報告書も良い生成例として扱いたい」なら、将来的には `diffItems.length === 0` でも record を残す案があります。

現時点では未対応で OK です。

### JSON parse 失敗時

`confirm` ルートで `JSON.parse(aiDraftJson)` / `JSON.parse(userDraftJson)` しています。

通常は DB に正しい JSON が入っている前提なので問題ないですが、壊れた JSON が入った場合、confirm API が 500 になる可能性があります。

ハッカソンデモ前に余裕があれば、ここは `try/catch` してもいいです。

```ts
try {
  // diff保存
} catch (error) {
  console.error("Failed to save report correction", error);
}
await confirmReport(id);
```

ただし個人的には、Phase 4 直後はまだ入れなくてもよいです。
「差分保存に失敗しても確定自体は通す」設計にするか、「差分保存できないなら確定させない」設計にするかを決めてからでよさそうです。

## 4. 本番反映

本番で確認するなら作業順はこれです。

```bash
git status
git add .
git commit -m "Add report correction diff persistence"
git push origin main
```

その後、GitHub Actions / Container Apps のデプロイ完了を確認。

そのうえで、本番 DB に対して：

```bash
pnpm migrate
```

最後に本番 Web から報告書作成 → 修正 → 確定 → SQL 確認、です。

## 5. Phase 4 で追加してもよい改善

必須ではないですが、やるとデモの説得力が上がるものです。

### A. 管理用の差分確認 API

Phase 5 に入る前に、差分がちゃんと見える API があると便利です。

候補：

```text
GET /api/reports/:id/corrections
```

返すもの：

```ts
type ReportCorrectionResponse = {
  reportId: string;
  corrections: {
    id: string;
    diff: JsonDiffItem[];
    createdAt: string;
  }[];
};
```

これはデバッグにも、Phase 5 の材料確認にも使えます。

### B. 画面に「AIからの修正点」を表示

デモで見せるならかなり効きます。

```text
AI生成後、人間がここを直しました
- 発生場所: 2階エスカレーター付近 → 2階 上りエスカレーター降り口付近
- 再発防止策: 定期点検を実施 → 固定部を全館点検し緩み箇所を即日補修
```

今の状態なら、次に Claude Code に渡す指示はこれでよさそうです。

```text
Phase 4 の実装が完了したので、まず report_corrections の動作確認を行いたいです。
pnpm migrate 実行後、報告書作成→人間修正→確定の流れで diff_json が保存されることを確認してください。
必要なら確認用SQLまたはデバッグ用 API GET /api/reports/:id/corrections を追加してください。
その後、Phase 5 の prompt_versions / prompt_improvement_runs のDB設計と実装計画を作ってください。
```

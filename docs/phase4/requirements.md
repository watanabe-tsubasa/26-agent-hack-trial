## Phase 4 実装方針

まずは **confirm 時に差分を保存する**のが一番シンプルです。

現在の流れはたぶんこう：

```text
AI draft生成
↓
画面で人間が修正
↓
PATCH /api/reports/:id で user edited draft 保存
↓
POST /api/reports/:id/confirm で確定
```

Phase 4 ではここに追加します。

```text
POST /api/reports/:id/confirm
  ↓
ai_draft_json と user_edited_json を比較
  ↓
diff を生成
  ↓
report_corrections に保存
  ↓
status = confirmed
```

## 追加するテーブル案

Azure SQL なら、まずは **1 report = 1 correction record** でよいと思います。

```sql
CREATE TABLE report_corrections (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  report_id NVARCHAR(64) NOT NULL,
  ai_draft_json NVARCHAR(MAX) NOT NULL,
  user_draft_json NVARCHAR(MAX) NOT NULL,
  diff_json NVARCHAR(MAX) NOT NULL,
  correction_reason NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```

`diff_json` はこんな形。

```ts
type ReportCorrectionDiffItem = {
  fieldPath: string;
  before: unknown;
  after: unknown;
  changeType: "add" | "update" | "delete";
};
```

例：

```json
[
  {
    "fieldPath": "fiveWTwoH.where",
    "before": "2階エスカレーター付近",
    "after": "2階 上りエスカレーター降り口付近",
    "changeType": "update"
  },
  {
    "fieldPath": "preventiveAction",
    "before": "定期点検を実施する。",
    "after": "透明アクリルガード板の固定部を全館点検し、緩みがある箇所は即日補修する。",
    "changeType": "update"
  }
]
```

## 実装ファイルの追加候補

```text
lib/json-diff.ts
  - JSON差分生成

lib/report-correction-repository.ts
  - report_corrections insert / find

scripts/migrate.ts
  - report_corrections table追加

app/api/reports/[id]/confirm/route.ts
  - confirm時にdiff保存
```

## 最初に実装する関数

まずはこれを作るのがよさそうです。

```ts
export type JsonDiffItem = {
  fieldPath: string;
  before: unknown;
  after: unknown;
  changeType: "add" | "update" | "delete";
};

export function diffJson(
  before: unknown,
  after: unknown,
  basePath = "",
): JsonDiffItem[] {
  if (Object.is(before, after)) {
    return [];
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ]);

    return [...keys].flatMap((key) => {
      const nextPath = basePath ? `${basePath}.${key}` : key;

      if (!(key in before)) {
        return [{
          fieldPath: nextPath,
          before: undefined,
          after: after[key],
          changeType: "add" as const,
        }];
      }

      if (!(key in after)) {
        return [{
          fieldPath: nextPath,
          before: before[key],
          after: undefined,
          changeType: "delete" as const,
        }];
      }

      return diffJson(before[key], after[key], nextPath);
    });
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLength = Math.max(before.length, after.length);

    return Array.from({ length: maxLength }).flatMap((_, index) => {
      const nextPath = `${basePath}[${index}]`;

      if (index >= before.length) {
        return [{
          fieldPath: nextPath,
          before: undefined,
          after: after[index],
          changeType: "add" as const,
        }];
      }

      if (index >= after.length) {
        return [{
          fieldPath: nextPath,
          before: before[index],
          after: undefined,
          changeType: "delete" as const,
        }];
      }

      return diffJson(before[index], after[index], nextPath);
    });
  }

  return [{
    fieldPath: basePath,
    before,
    after,
    changeType: "update",
  }];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
```

Phase 4 の時点では、配列差分は完璧な LCS までやらず、`photos[0].caption` みたいな index ベースで十分だと思います。ハッカソンのデモ用途なら、ここで凝りすぎると沼です。差分の「意味」が見えれば勝ち。

## 実装順

1. `report_corrections` テーブルを migrate に追加
2. `lib/json-diff.ts` を追加
3. `lib/report-correction-repository.ts` を追加
4. `confirm` API で `ai_draft_json` と `user_draft_json` を比較して保存
5. 必要なら画面側に「AIからの修正点」表示を追加
6. Phase 5 で `report_corrections.diff_json` を読む

この順で入るのが安全です。

特に大事なのは、**Phase 4ではプロンプト改善までやらない**ことですね。
Phase 4 は「人間がどこを直したかを正しく残す」だけ。
それを Phase 5 の改善Jobが読む。ここを分けると実装がかなり綺麗になります。


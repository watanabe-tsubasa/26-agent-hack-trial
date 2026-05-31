賛成です。`/admin/prompt-improvements` は今のままだと裏側の実装都合が見えすぎているので、デモでは **「グッジョくんが人間の修正を振り返って、施設ナレッジ候補を考えてくれる画面」** に寄せた方がかなり伝わりやすいです。

ここは **Phase 6.6: 施設ナレッジ管理UIのグッジョくん化** くらいで扱うのが良さそうです。

## 画面コンセプト

今の「プロンプト改善」「キュー投入」みたいな言葉は内部用語なので、UIではこう置き換えたいです。

| 現在の文言     | 置き換え案                |
| --------- | -------------------- |
| プロンプト改善   | 施設ナレッジ改善             |
| 改善案生成     | グッジョくんに施設ナレッジを考えてもらう |
| キューを投入    | 改善準備を開始              |
| queued    | 順番待ち                 |
| running   | グッジョくんが分析中           |
| completed | 施設ナレッジ候補ができました       |
| failed    | 生成に失敗しました            |
| draft     | 確認待ちの候補              |
| approve   | このナレッジを採用            |
| active    | 利用中の施設ナレッジ           |
| archived  | 過去の候補                |

特に「キュー」は完全に隠して良いです。デモでは Service Bus の説明時だけ裏側として話せば十分です。

---

## 生成中モーダルの見せ方

`/reports` の生成画面と同じ方向で、施設ナレッジ生成中もグラスモーフィズムのモーダルを重ねるのが良いです。

イメージはこれです。

```text
施設ナレッジ改善画面
────────────────────────

現在の施設ナレッジ
確認待ちの候補
過去の改善履歴

        ┌──────────────────────────┐
        │  グッジョくんが考え中       │
        │                          │
        │  ✓ 人間の修正履歴を確認     │
        │  ✓ 施設ごとの傾向を整理     │
        │  → 次回に活かせる知識を抽出 │
        │  ・候補をまとめています     │
        │                          │
        │  しばらくお待ちください     │
        └──────────────────────────┘
```

背景は少し blur / opacity を入れて、モーダルだけ前面に出す。

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
  <div className="w-full max-w-xl rounded-3xl border border-white/40 bg-white/75 p-6 shadow-2xl backdrop-blur-xl">
    ...
  </div>
</div>
```

---

## 施設ナレッジ生成ステップ案

事故報生成とは別に、ナレッジ改善用のステップを持つと良いです。

```ts
export const KNOWLEDGE_IMPROVEMENT_STEPS = [
  {
    key: "collect_corrections",
    label: "人間の修正履歴を確認しています",
    description:
      "確定済み事故報の修正差分から、施設ごとに繰り返し出てくる情報を探しています。",
    tone: "thinking",
  },
  {
    key: "analyze_patterns",
    label: "施設ごとの傾向を整理しています",
    description:
      "場所名称、設備、注意箇所、過去の不具合など、次回に活かせる知識を見つけています。",
    tone: "working",
  },
  {
    key: "generate_knowledge",
    label: "施設ナレッジ候補を作成しています",
    description:
      "共通ルールではなく、この施設に固有の情報だけを候補としてまとめています。",
    tone: "working",
  },
  {
    key: "prepare_review",
    label: "確認用の候補を準備しています",
    description:
      "人間が確認・編集・採用できるように、施設ナレッジ候補を整理しています。",
    tone: "success",
  },
] as const;
```

`GoodjobAvatar` はここでも流用できます。

```tsx
<GoodjobAvatar tone={currentStep.tone} size="lg" />
```

---

## ボタン文言

ここ、かなり印象が変わります。

### Before

```text
改善案生成
キューを投入
```

### After

```text
グッジョくんに施設ナレッジを考えてもらう
```

少し短くするなら：

```text
施設ナレッジを生成
```

ボタン内にキャラを入れるなら：

```tsx
<Button>
  <GoodjobAvatar tone="thinking" size="xs" />
  グッジョくんに考えてもらう
</Button>
```

個人的には、管理画面の主ボタンはこれがちょうど良いです。

```text
グッジョくんに改善案を考えてもらう
```

「施設ナレッジ」を全面に出すなら：

```text
施設ナレッジ候補を作成
```

---

## 画面上部の説明文

ここも事務的にせず、デモ説明と一致させると良いです。

```tsx
<h1>施設ナレッジ改善</h1>
<p>
  グッジョくんが、人間による事故報の修正履歴を振り返り、
  次回の報告書作成に活かせる施設固有の知識を候補として整理します。
  採用する前に、必ず人間が内容を確認できます。
</p>
```

「プロンプトを勝手に書き換えるのではない」ことを画面上でも伝えたいです。

```tsx
<p className="text-sm text-muted-foreground">
  共通の報告ルールは固定したまま、場所名称・注意箇所・過去の設備不具合など、
  施設ごとの知識だけを候補として追加します。
</p>
```

これ、Phase 5 の思想がちゃんと伝わります。

---

## 状態表示の文言

`prompt_improvement_runs.status` の表示変換を作るとよさそうです。

```ts
export const PROMPT_IMPROVEMENT_STATUS_COPY = {
  queued: {
    label: "順番待ち",
    description: "グッジョくんが確認する準備をしています。",
    tone: "thinking",
  },
  running: {
    label: "分析中",
    description: "グッジョくんが修正履歴から施設固有の知識を探しています。",
    tone: "working",
  },
  completed: {
    label: "候補作成済み",
    description: "施設ナレッジ候補が作成されました。内容を確認してください。",
    tone: "success",
  },
  failed: {
    label: "生成失敗",
    description: "施設ナレッジ候補の作成に失敗しました。時間をおいて再実行してください。",
    tone: "warning",
  },
  superseded: {
    label: "新しい実行で更新済み",
    description: "より新しい改善処理が実行されています。",
    tone: "idle",
  },
} as const;
```

---

## 実装方針

今の Phase 5 非同期化があるので、作りはシンプルでいけます。

```text
POST /api/admin/run-prompt-improvement
↓
runId を受け取る
↓
modal open
↓
GET /api/prompt-improvement-runs/:id を polling
↓
queued / running の間はモーダル表示
↓
completed で候補一覧を再取得
↓
success 表示して閉じる or 完了状態を表示
↓
failed なら warning 表示
```

現状 `latest run` API もある可能性があるので、リロード後も `queued / running` が残っていたらモーダルを出せます。

これがあると、誤って画面更新しても「グッジョくんがまだ考え中です」と見せられます。

---

## コンポーネント案

```text
components/
  admin/
    knowledge-improvement-modal.tsx
    knowledge-improvement-status-badge.tsx
    knowledge-candidate-card.tsx
```

または、既存構成に合わせるなら：

```text
components/
  prompt-improvements/
    improvement-progress-dialog.tsx
    improvement-run-status.tsx
```

名前としては、今後の意味づけ的に `prompt-improvements` より `knowledge-improvements` の方が良いですが、今すぐ大規模リネームしなくてもOKです。

---

## モーダルコンポーネント例

```tsx
import { GoodjobAvatar } from "@/components/goodjob-avatar";

type StepState = {
  key: string;
  label: string;
  description: string;
  status: "pending" | "current" | "completed";
  tone: "idle" | "thinking" | "working" | "investigating" | "success" | "warning";
};

type Props = {
  open: boolean;
  title?: string;
  steps: StepState[];
  onClose?: () => void;
  canClose?: boolean;
};

export function KnowledgeImprovementProgressDialog({
  open,
  title = "グッジョくんが施設ナレッジを考えています",
  steps,
  onClose,
  canClose = false,
}: Props) {
  if (!open) return null;

  const currentStep =
    steps.find((step) => step.status === "current") ??
    steps.find((step) => step.status === "pending") ??
    steps[steps.length - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/40 bg-white/75 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <div className="rounded-3xl bg-white/70 p-3 shadow-sm">
            <GoodjobAvatar tone={currentStep?.tone ?? "thinking"} size="lg" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-700">
              施設ナレッジ改善エージェント
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              人間の修正履歴から、次回の事故報作成に活かせる施設固有の知識を整理しています。
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {steps.map((step) => (
            <div
              key={step.key}
              className="rounded-2xl border border-white/50 bg-white/55 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow-sm">
                  {step.status === "completed"
                    ? "✓"
                    : step.status === "current"
                      ? "…"
                      : "・"}
                </span>
                <div>
                  <p className="font-medium text-slate-900">{step.label}</p>
                  <p className="text-sm text-slate-600">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {canClose && onClose ? (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              閉じる
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

---

## 重要：裏側の用語は隠す

画面には出さない方がいい単語：

```text
queue
enqueue
prompt override
prompt improvement run
source=ai_proposed
archiveOlderDraft
```

画面ではこう言う：

```text
施設ナレッジ候補
確認待ち
採用済み
過去の候補
生成中
分析中
```

DBやAPI名はそのままで良いです。
UIだけ翻訳すれば十分デモ映えします。

---

## 今回の作業タスク

最小差分ならこれで良いです。

```text
1. /admin/prompt-improvements の文言を「施設ナレッジ改善」に変更
2. 「キュー投入」などの内部用語を削除
3. 実行ボタンを「グッジョくんに改善案を考えてもらう」に変更
4. queued/running 中にグラスモーフィズムモーダルを表示
5. run status polling と連動
6. completed で候補一覧を再取得
7. failed で困ったグッジョくん + エラーメッセージ表示
```

この改善はかなり効きます。
事故報生成画面だけでなく、管理画面側も「AIエージェントが継続改善している」世界観に揃うので、デモの一貫性が出ます。

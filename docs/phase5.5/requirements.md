はい、それかなり良いです。
Phase 5 は今のままだと **API と DB はできているけど、デモで「改善される仕組み」が見えにくい**ので、Web UI から触れるようにすると一気に伝わります。

方向性としてはこうですね。

```text
管理画面っぽい UI
↓
store-001 の修正差分を確認
↓
改善案を手動生成
↓
draft を確認
↓
必要なら編集
↓
適用 / active 化
↓
次回の報告書生成に反映
```

週1自動生成は将来像として説明しつつ、ハッカソンでは **手動実行 UI** があれば十分だと思います。

## 追加したい画面

### `/admin/prompt-improvements`

一旦認証なしで OK。
名前は admin ですが、今回はデモ用管理画面という扱い。

画面に置きたい要素はこれです。

```text
店舗・施設ID
  store-001

現在の active 補正ルール
  title
  status
  approvedAt
  overrideText

改善案生成ボタン
  「現在の修正履歴から改善案を生成」

生成済み draft 一覧
  title
  source
  status
  createdAt
  overrideText
  analysisJson summary

操作
  編集
  適用
  archived / draft / active の状態表示
```

## UI フロー

デモではこの流れが一番わかりやすいです。

```text
1. 事故報告書をAI生成
2. 人間が修正して確定
3. report_corrections に差分が溜まる
4. 管理画面を開く
5. 「改善案を生成」を押す
6. AI が store-001 用の補正ルール draft を作る
7. draft の中身を確認
8. 必要なら本文を編集
9. 「この補正ルールを適用」を押す
10. status = active
11. 次回生成時に active override が読み込まれる
```

これで Phase 5 の価値がかなり伝わります。

## 追加 API

今ある API は：

```text
GET  /api/location-prompt-overrides
POST /api/location-prompt-overrides/:id/approve
POST /api/admin/run-prompt-improvement
```

これに、**編集用 API** を足すと良いです。

```text
PATCH /api/location-prompt-overrides/:id
```

編集対象：

```ts
type UpdateLocationPromptOverrideInput = {
  title?: string;
  overrideText?: string;
};
```

用途：

```text
AI が出した draft を人間が微修正してから適用する
```

これがあると「AI が勝手に本番反映しない。人間が確認・修正・承認する」というストーリーがかなり強くなります。

## Repository に足す関数

`lib/location-prompt-override-repository.ts` にこれを追加。

```ts
updateLocationPromptOverride({
  id,
  title,
  overrideText,
}: {
  id: string;
  title?: string;
  overrideText?: string;
})
```

制約としては：

```text
- active も編集できるようにするか？
- draft のみ編集できるようにするか？
```

ハッカソンなら **draft のみ編集可能** が安全です。

```text
draft:
  編集可能

active:
  編集不可
  編集したい場合は新しい draft を作る
```

ただし実装を簡単にするなら、最初は active も編集可でもいいです。
でも設計としては draft 編集 → approve がきれいです。

## 画面構成案

### 上部：実行パネル

```text
Phase 5: 店舗・施設別 補正ルール改善

対象施設ID: [store-001]

[現在の修正履歴から改善案を生成]
```

生成中は：

```text
改善案を生成中...
```

成功したら：

```text
改善案 draft を作成しました
```

### 中段：Active ルール

```text
現在適用中の補正ルール

status: active
title: store-001: 報告書補正ルール案（施設固有）
approvedAt: 2026-05-22 ...

overrideText:
...
```

### 下段：Draft 一覧

```text
改善案 draft

title
createdAt
summary
overrideText editor
[保存]
[適用]
```

## 編集 UI

`textarea` で十分です。

```tsx
<textarea
  value={overrideText}
  onChange={...}
/>
```

AI が生成した `analysisJson` も表示すると良いです。

```text
AIが見つけた修正傾向:
- where の表現が施設標準名称に修正されやすい
- what は短い名詞句に修正されやすい
- why は「可能性」「要点検」の留保表現が追加されやすい
```

これがあると、ただのプロンプト編集画面ではなく、**修正差分から改善している感**が出ます。

## 週1自動生成について

今は実装しなくてよいです。
ただし UI / docs には将来像として書けます。

```text
将来的には週1回、施設ごとの report_corrections を集計し、
補正ルール draft を自動生成する。
ただし active 化は人間承認後のみ。
```

Azure で実装するなら候補は：

```text
Container Apps Jobs
Azure Functions Timer Trigger
GitHub Actions cron
```

今回のプロトタイプでは、**手動実行ボタン = 将来の週次Jobを手で起動するもの**という説明で十分です。

## Claude Code に渡す要求事項

そのまま渡せる形だとこれです。

```text
Phase 5 の補正ルール改善機能を Web UI から操作できるようにしてください。

背景:
現在は以下の API と DB 実装が完了しています。
- POST /api/admin/run-prompt-improvement
- GET /api/location-prompt-overrides
- POST /api/location-prompt-overrides/:id/approve
- location_prompt_overrides
- prompt_improvement_runs

やりたいこと:
現状たまっている report_corrections から、管理画面上で改善案を手動生成し、
AI が生成した draft を確認・編集し、適用できるようにしたいです。

認証・管理者権限:
- 本来は管理者権限が必要だが、今回のハッカソン実装では認証なしでよい
- route は /admin/prompt-improvements でよい

実装してほしいもの:

1. 管理画面
- app/admin/prompt-improvements/page.tsx を作成
- 対象 locationKey はまず store-001 固定でよい
- GET /api/location-prompt-overrides?locationKey=store-001 を呼び、active / draft を表示
- POST /api/admin/run-prompt-improvement を呼ぶ「改善案を生成」ボタンを置く
- 生成中 loading / 成功 / エラー状態を表示

2. active 補正ルール表示
- status = active の override を表示
- title
- approvedAt
- overrideText
- analysisJson summary があれば表示

3. draft 補正ルール一覧
- status = draft の override を一覧表示
- title
- createdAt
- analysisJson summary
- overrideText を textarea で編集できるようにする
- 「保存」ボタン
- 「適用」ボタン

4. 編集 API
- PATCH /api/location-prompt-overrides/:id を追加
- title / overrideText を更新できるようにする
- 基本は draft のみ編集可能にする
- active / archived を編集しようとした場合は 400 を返す

5. repository
- lib/location-prompt-override-repository.ts に updateLocationPromptOverride を追加
- draft のみ更新可能にする

6. 適用 API
- 既存の POST /api/location-prompt-overrides/:id/approve を利用する
- 適用後は一覧を再取得する
- 同じ locationKey の active は1件のみになる前提

7. UI上の説明文
- 「AIは改善案を draft として作成します」
- 「適用するまで事故報告書生成には反映されません」
- 「適用後、次回以降の同一施設の報告書生成時に補正ルールが追記されます」
- 「本来は管理者権限が必要ですが、デモ実装では認証なしです」

8. 将来メモ
- docs/phase5/tasks.md に、将来的には週1回自動で draft を生成する予定と追記
- ただし active 化は人間承認後のみ
- cron / scheduler は今回実装しない

9. 確認
- npx tsc --noEmit
- 画面から改善案生成
- draft 表示
- draft 編集保存
- approve
- active 表示
```

## 今回はやらなくていいこと

```text
- 認証 / 管理者権限
- 週1 cron 実行
- locationKey の選択 UI
- 複数施設対応の作り込み
- 差分のグラフ化
- prompt_improvement_runs の詳細履歴画面
```

まずは `store-001` 固定で十分です。

## デモでの見せ方

この UI ができると、説明はこうできます。

```text
この画面では、人間が修正した事故報告書の差分をもとに、
AIが店舗・施設別の補正ルール案を生成します。

生成された案はすぐには反映されず、draft として保存されます。
担当者が内容を確認し、必要であれば編集したうえで適用します。

適用後は、次回以降の同じ施設の事故報告書生成時に、
共通プロンプトへこの補正ルールが追記されます。
```

これ、かなり筋が良いです。
Phase 5 が「裏側で何かやってる」から「人間がAIを育てるUI」に変わります。プロトタイプとして一気に完成度が上がります。

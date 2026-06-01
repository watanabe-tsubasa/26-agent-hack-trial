# Phase 9 タスク管理 — 最終UI改善 + 軽微な不具合修正

> 方針: デモ・実利用に向けた最終調整。文言・初期値・遅延制御・配置順の見直しと、
> preview の参照ズレバグ修正。
>
> 依存: Phase 8 が完了していること
> Azure 側変更: なし

---

## 1. `/` 入力フォームの初期値・placeholder 調整

- [x] `app/_components/new-report-form-utils.ts`
  - `DEFAULT_FORM.summary` を空文字に変更
  - `DEFAULT_FORM.location` を空文字に変更
  - `DEFAULT_FORM.note` を空文字に変更
  - `DEFAULT_FORM.occurredAt` を「当日 10:00 (JST)」に動的計算するヘルパ `defaultOccurredAt()` を追加
- [x] `app/(app)/_components/new-report-form.tsx`
  - 初期 state を `DEFAULT_FORM` のコピー+`occurredAt: defaultOccurredAt()` で生成
  - placeholder を以下に変更
    - 事故概要: `万引きが発生`（場所・時間は含めない）
    - 発生場所: `1階 冷凍食品売場`

---

## 2. `/login` の簡素化

- [x] `app/login/page.tsx`
  - `QUICK_LOGINS` 配列とサイト選択ボタン UI を削除
  - 区切り線「または手動でログイン」も削除
  - ID/PASS 入力のみのシンプルなフォームに
  - ヘッダー文言「サイトを選んでログインしてください」→「ID/PASSを入力してください」

---

## 3. `/admin/report-rag` → チャットボット表記

- [x] `app/_components/nav-items.ts`
  - `施設管理RAG` → `施設管理チャットボット`
- [x] `app/(app)/admin/report-rag/_components/ReportRagChatClient.tsx`
  - 見出し `施設管理RAG` → `施設管理チャットボット`
- [x] `app/(app)/admin/report-rag/_components/ReindexButton.tsx`
  - エラー文言 `Cosmos RAG は無効です` → `Cosmos チャットボット連携は無効です`

---

## 4. `/reports/[id]` 処理ステップの体感速度を上げる

- [x] `worker/handlers.ts`
  - `parse_input` の `started` → 入力取得後、最低 1000ms 経過してから `completed` を emit
- [x] `lib/agent/mock-agent.ts`
  - `search_camera_frames` の `started` → `searchCameraFrames` 後、最低 4000ms 経過してから `completed` を emit
  - 経過時間は `Date.now()` で計測し `sleep(max(0, target - elapsed))`

---

## 5. `/reports` テーブルから ID 列削除

- [x] `app/(app)/reports/page.tsx`
  - `<th>ID</th>` および対応する `<td>{report.id}</td>` を削除

---

## 6. `/reports/[id]/preview` 「報告書が見つかりません」バグ修正

- [x] `app/(app)/reports/[id]/preview/page.tsx`
  - 原因: Server Component から `fetch("/api/reports/[id]")` するときに cookie 未転送で 401 となり null になる
  - 修正: `getReportById` をリポジトリから直接呼び出す（同一プロセス・DB直）
  - 併せて `requireCurrentSite` 等のセッション確認は維持

---

## 7. `/admin/prompt-improvements` 表示順・文言調整

- [x] `app/(app)/admin/prompt-improvements/_components/PromptImprovementsClient.tsx`
  - 確認待ちの候補がない時は、セクション全体（タイトル・ヒント・空状態カード）を非表示にする
  - 「確認待ちの候補」セクションを「現在適用中の施設ナレッジ」セクションの**上**に表示
- [x] `lib/prompt-improvement/knowledge-improvement-steps.ts`
  - `collect_corrections` の label: `人間の修正履歴を確認しています` → `修正履歴を確認しています`

---

## 8. テスト・検証

- [x] `lib/__tests__/default-occurred-at.test.ts`（新規, pure）
  - `defaultOccurredAt(baseDate)` が `YYYY-MM-DDT10:00` を返す
- [x] `package.json` の test script に追加
- [x] tsc clean
- [x] pnpm test 全通過
- [x] pnpm build OK

---

## 9. デプロイ

- [ ] `git push origin main`

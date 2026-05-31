# Phase 7.4 タスク管理 — 施設管理 RAG UI

> 方針: 管理者用 `/admin/report-rag` チャット画面。
> グッジョくんが事故報を横断確認するイメージで、source cards / 推奨質問 / reindex ボタンを並べる。
> Phase 7.3 の chat API を叩く client component。
>
> 依存: Phase 7.1 (admin role)、Phase 7.2 (reindex API)、Phase 7.3 (chat API)、Phase 6.8 (AppShell)。
> Azure 側変更: 不要。

---

## 1. ルート追加

- [x] `app/(app)/admin/report-rag/page.tsx`
  - Server Component
  - `getCurrentSessionFromCookies()` 経由でガード（未ログイン → /login、site_user → /）
  - `<ReportRagChatClient />` をレンダー

---

## 2. NAV 項目

- [x] `app/_components/nav-items.ts`
  - 既に 7.1 で「施設管理RAG」を `visibleTo: ["admin"]` で登録済
  - icon: `search` (Lucide Search)

---

## 3. チャット UI

- [x] `app/(app)/admin/report-rag/_components/ReportRagChatClient.tsx`
  - state: `messages: ChatMessage[]`, `input`, `loading`
  - 送信で `POST /api/admin/report-rag/chat` → answer / sources を message に追加
  - user / assistant 分離表示、assistant は `whitespace-pre-wrap`
  - source cards: タイトル / サイト名 / `/reports/[id]` リンク
  - 初期表示で SUGGESTED_QUESTIONS のクイック送信ボタン

---

## 4. Reindex ボタン

- [x] `_components/ReindexButton.tsx`
  - `GET /api/admin/report-rag/index-status` で初期表示
  - 「差分更新」ボタン (`force: false`) と「全件再インデックス」ボタン (`force: true`)
  - 結果 (indexed / skipped / failed) をインラインで表示
  - Cosmos 無効時は警告表示

---

## 5. 動作確認

- [x] tsc clean / 44 tests pass / build OK
- [ ] admin / goodjob でログイン → サイドバーに「施設管理RAG」が表示
- [ ] 質問入力 → 回答が表示される、source カードがリンク可能
- [ ] reindex ボタン押下 → 件数が表示される
- [ ] site_user で `/admin/report-rag` にアクセス → `/` に redirect

---

## 6. デプロイ

- [ ] `git push origin main`

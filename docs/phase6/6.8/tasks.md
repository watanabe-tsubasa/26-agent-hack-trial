# Phase 6.8 タスク管理 — App Shell / Navigation 改善

> 方針: ヘッダー横並びメニューを **サイドバー + モバイルハンバーガー** に再構成する。
> Next.js App Router の route group `(app)` を使って、ログイン後画面のみに共通 AppShell を被せる。
> `/login` と `/api/*` は対象外。既存 URL は変えない。
>
> 依存: Phase 6.1（demo auth Cookie）。
> Azure 側変更: 不要。

---

## 1. 依存追加

- [x] `pnpm add lucide-react` → `^1.17.0`

---

## 2. ナビゲーション項目

- [x] `app/_components/nav-items.ts`
  - `NAV_ITEMS = [{ href, label, description, iconKey }]`
  - iconKey: "home" | "fileText" | "sparkles"
  - 項目: ホーム / 事故報一覧 / 施設ナレッジ改善
  - `isActivePath()` ヘルパー
- [x] `app/_components/app-session.ts` — AppSession 型

---

## 3. AppShell 部品

- [x] `app/_components/app-sidebar.tsx`
  - props: `{ open: boolean; session }`
  - PC専用 (`hidden md:flex`)、open/collapsed で width 切替
  - open 時はラベル+説明、collapsed 時はアイコンのみ + `title` hover ヒント
  - 上部にグッジョくん + サイト名
  - `usePathname` + `isActivePath` で現在ページハイライト
- [x] `app/_components/mobile-nav-drawer.tsx`
  - props: `{ open: boolean; onClose; session }`
  - `md:hidden`、左から slide-in、`bg-slate-950/40` オーバーレイ
  - メニュー項目 + ログアウト（solid variant）
- [x] `app/_components/app-header.tsx`
  - props: `{ session; sidebarOpen; onToggleSidebar; onOpenMobileNav }`
  - PC: PanelLeftClose/Open ボタン + タイトル + サイト名 + ログアウト
  - SP: Menu(ハンバーガー) + タイトル + ログアウト
- [x] `app/_components/app-shell.tsx`
  - `"use client"`
  - sidebar / mobile drawer 状態保持
  - Header + Sidebar + Main を組み立て
- [x] `app/_components/header-bar.tsx` `LogoutButton` に `variant?: "ghost" | "solid"` を追加

---

## 4. (app) route group

- [x] `app/(app)/layout.tsx` 新規
  - Server Component
  - `getCurrentSiteFromCookies()` で未ログインなら `redirect("/login")`
  - `<AppShell initialSession={...}>{children}</AppShell>`

---

## 5. 既存ページを (app) 配下へ移動

- [x] `app/page.tsx` → `app/(app)/page.tsx`
  - `./_components/new-report-form-utils` → `@/app/_components/new-report-form-utils` （絶対 import）
- [x] `app/reports/` → `app/(app)/reports/`（[id] / diff / preview / _components 含む）
- [x] `app/admin/prompt-improvements/` → `app/(app)/admin/prompt-improvements/`
- [x] `lib/knowledge-copy.ts` / `lib/knowledge-improvement-steps.ts` の import path を `@/app/(app)/admin/...` に更新
- [x] `/login` と `/api/*` はそのまま

---

## 6. Root layout の整理

- [x] `app/layout.tsx` を最小化
  - `<html><body>` + フォント + globals.css のみ
  - 既存の Header / GoodjobAvatar / ナビ削除
  - 結果: `/login` は static prerender 可能に

---

## 7. テスト

- [x] tsc: clean（既存テストの implicit-any のみ、本変更とは無関係）
- [x] pnpm test: **39/39 pass**
- [x] pnpm build: 成功（全ルート URL 変化なし）

---

## 8. 動作確認

- [ ] `/login` には Header / Sidebar が表示されない
- [ ] ログイン後 `/` にアクセス → Header + Sidebar + Main が表示される
- [ ] PC幅でサイドバー開閉ボタンが効く
- [ ] スマホ幅でサイドバーが非表示、ハンバーガーが表示される
- [ ] ハンバーガーで MobileNavDrawer が開く / 閉じる
- [ ] 現在ページのハイライトが正しい
- [ ] ログアウト → `/login` に戻る
- [ ] サイト切替（再ログイン）後にサイト名が更新される

---

## 9. デプロイ

- [ ] `git push origin main`
- [ ] 本番でレイアウト崩れがないこと

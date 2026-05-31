# Phase 7.1 タスク管理 — 管理者アカウントとロール別ナビ

> 方針: 既存の demo auth に `admin` ロールを追加する。
> Cookie は既存の `site_key` を流用し、admin は `"admin"` センチネルを格納する。
> セッション型を `site_user | admin` の discriminated union にし、
> AppShell のナビゲーションを role 別に出し分ける。
>
> 依存: Phase 6.1 (demo auth), Phase 6.8 (AppShell)。
> Azure 側変更: 不要。

---

## 1. デモアカウント定義

- [x] `lib/demo-sites.ts`
  - `DemoRole = "site_user" | "admin"`
  - `DemoUser` に `role: DemoRole` を追加
  - admin ユーザー: `{ loginId: "admin", password: "goodjob", role: "admin", siteKey: ADMIN_SITE_KEY }`
  - `ADMIN_SITE_KEY = "admin"` センチネル / `ADMIN_DISPLAY_NAME = "全施設管理"`
  - `findUserBySiteKey`, `isAdminSiteKey` ヘルパ追加

---

## 2. セッション型と取得

- [x] `lib/demo-auth.ts`
  - `DemoSession = { role: "site_user"; site } | { role: "admin"; siteName }`
  - `getCurrentSessionFromCookies()` / `requireCurrentSession()`
  - `requireSiteUserSession()` / `requireAdminSession()`
  - 既存 `getCurrentSiteFromCookies` / `requireCurrentSite` は site_user 専用として薄ラッパに

---

## 3. ログイン / ログアウト / me

- [x] `app/api/login/route.ts`
  - admin ログイン時も同じ Cookie 値で `setSiteCookie`
  - レスポンスに `role` を含める
- [x] `app/api/me/route.ts`
  - site_user / admin で異なるフィールドを返す

---

## 4. AppShell セッション型拡張

- [x] `app/_components/app-session.ts` — discriminated union
- [x] `app/(app)/layout.tsx` — `getCurrentSessionFromCookies` 経由でロール判定

---

## 5. ナビゲーション項目のロール対応

- [x] `app/_components/nav-items.ts`
  - 各 item に `visibleTo: readonly RoleVisibility[]`
  - admin 専用: 施設管理RAG (Phase 7.4 で実 page を追加するが、nav はここで登録)
  - site_user 専用: ホーム / 施設ナレッジ改善
  - 両方: 事故報一覧
  - `navItemsForRole(role)` ヘルパ
- [x] `app/_components/app-sidebar.tsx` / `mobile-nav-drawer.tsx`
  - `navItemsForRole(session.role)` でフィルタ
  - 新規 icon: `search` (Lucide Search)

---

## 6. ページ単位のロールガード

- [x] `app/(app)/page.tsx` — Server Component に変換
  - admin なら `/admin/report-rag` に redirect
  - client form は `_components/new-report-form.tsx` に切り出し
- [x] `app/(app)/admin/prompt-improvements/page.tsx`
  - admin なら `/admin/report-rag` に redirect

---

## 7. ログイン画面のクイックログイン

- [x] `app/login/page.tsx`
  - QUICK_LOGINS に「管理者（全施設）」を追加

---

## 8. 動作確認

- [x] tsc clean / 39 tests pass / build OK
- [ ] admin / goodjob でログイン → ヘッダーに「全施設管理」表示、ナビは「事故報一覧」「施設管理RAG」のみ
- [ ] admin で `/` にアクセス → redirect される
- [ ] admin で `/admin/prompt-improvements` にアクセス → redirect される
- [ ] site_user は従来通り全機能利用可

---

## 9. デプロイ

- [ ] `git push origin main`

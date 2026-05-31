```md: user
7に入る前に、6.8として現在ヘッダーにメニューがあるのをサイドバーおよびハンバーガーメニューにしたいです
幅が広い時はオンオフ可能なサイドバー、幅がスマホサイズになったらハンバーガーメニューが表示されるボタンがヘッダーに表示されるのが良さそうです。

ログイン画面以外には表示されるものと思われるので、セッションの状態を管理しつつ、app/_componentsに部品を管理しつつ、layout.tsxを活用して実装してほしいですね
```

```md: agent
いいです。**Phase 6.8: App Shell / Navigation 改善**として入れるのが自然です。

今のヘッダーメニューは機能が増えたぶん、横に並べるより **サイドバー + モバイル時ハンバーガー** に寄せた方が、管理画面っぽさも出ます。

## 方針

ログイン後の画面だけに共通の App Shell を被せます。

```text
/login
  → App Shell なし

それ以外
  → Header + Sidebar + Main
```

Next.js App Router なら、理想は **route group** を使って layout を分ける形です。

```text
app/
  layout.tsx                       # root layout
  login/
    page.tsx                       # shellなし

  (app)/
    layout.tsx                     # ログイン後App Shell
    page.tsx
    reports/
      page.tsx
      [id]/
        page.tsx
        diff/
          page.tsx
        preview/
          page.tsx
    admin/
      prompt-improvements/
        page.tsx
```

既存ルートURLは変わりません。
`app/(app)/reports/page.tsx` に移しても、URLは `/reports` のままです。

---

## 実装イメージ

### 追加したい構成

```text
app/
  _components/
    app-shell.tsx
    app-header.tsx
    app-sidebar.tsx
    mobile-nav-drawer.tsx
    sidebar-toggle.tsx
    nav-items.ts
    session-provider.tsx
```

`app/_components` に閉じるのは良いです。
今回のナビゲーションはアプリ全体の構造なので、`components/` より `app/_components/` が合っています。

---

## セッション状態の扱い

すでに `/api/me` があるので、クライアント側ではそれを使えばOKです。

ただし、layout 側で毎回 `/api/me` を叩くより、`(app)/layout.tsx` は Server Component として cookie からセッションを読めるなら、そこで初期値を渡す方が安定します。

おすすめはこれです。

```text
(app)/layout.tsx
  - server側で現在サイトを取得
  - 未ログインなら /login redirect
  - AppShell に initialSession を渡す

AppShell
  - client component
  - sidebar open/close 状態
  - mobile drawer 状態
  - header / sidebar / main を描画
```

### 例

```tsx
// app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { getDemoSessionFromCookies } from "@/lib/demo-auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDemoSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  return <AppShell initialSession={session}>{children}</AppShell>;
}
```

`getDemoSessionFromCookies()` の名前は既存実装に合わせればOKです。

---

## AppShell の責務

```tsx
"use client";

import { useState } from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { MobileNavDrawer } from "./mobile-nav-drawer";

type Props = {
  initialSession: {
    siteKey: string;
    siteName: string;
    facilityId: string;
    locationKey: string;
  };
  children: React.ReactNode;
};

export function AppShell({ initialSession, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        session={initialSession}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenMobileNav={() => setMobileOpen(true)}
      />

      <div className="flex">
        <AppSidebar open={sidebarOpen} session={initialSession} />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <MobileNavDrawer
        open={mobileOpen}
        session={initialSession}
        onClose={() => setMobileOpen(false)}
      />
    </div>
  );
}
```

---

## レスポンシブ挙動

### PC / tablet 幅

```text
Header:
  - サイドバー開閉ボタン
  - 現在サイト
  - ログアウト

Sidebar:
  - open / collapsed 切替
  - open時はラベル表示
  - collapsed時はアイコン中心
```

### スマホ幅

```text
Header:
  - ハンバーガーボタン
  - 現在サイト
  - ログアウト or メニュー内にログアウト

Sidebar:
  - 非表示

MobileNavDrawer:
  - ハンバーガー押下で表示
```

Tailwind的には：

```tsx
<button className="hidden md:inline-flex">サイドバー切替</button>
<button className="inline-flex md:hidden">ハンバーガー</button>

<aside className="hidden md:block">...</aside>
```

---

## ナビゲーション項目

今の機能ならこのくらいです。

```ts
// app/_components/nav-items.ts
export const NAV_ITEMS = [
  {
    href: "/",
    label: "ホーム",
    description: "事故報作成",
    icon: "home",
  },
  {
    href: "/reports",
    label: "事故報一覧",
    description: "作成済み事故報を確認",
    icon: "fileText",
  },
  {
    href: "/admin/prompt-improvements",
    label: "施設ナレッジ改善",
    description: "グッジョくんが修正履歴から施設知識を整理",
    icon: "sparkles",
  },
] as const;
```

アイコンは `lucide-react` で良いです。

```tsx
import { FileText, Home, Menu, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
```

---

## Sidebar の表示

開いている時：

```text
[グッジョくん]
事故報お任せグッジョくん
神田事務所サイト

- ホーム
  事故報作成
- 事故報一覧
  作成済み事故報を確認
- 施設ナレッジ改善
  修正履歴から施設知識を整理
```

閉じている時：

```text
[グ]
[home]
[file]
[sparkles]
```

グッジョくんをサイドバー上部に置くと、全体の世界観がかなり揃います。

---

## Header の文言

ヘッダーは軽くして、ナビ本体はサイドバーへ寄せる。

```text
左:
  サイドバー切替 / ハンバーガー
  事故報お任せグッジョくん

中央 or 右:
  神田事務所サイト

右:
  ログアウト
```

既存のヘッダーメニューはここで削除してOKです。

---

## 実装時の注意

### 1. `/login` に AppShell を出さない

ここが一番大事です。
route group で分けるのが一番安全。

```text
app/login/page.tsx
app/(app)/layout.tsx
```

### 2. `proxy.ts` と二重ガードになってもOK

`proxy.ts` で未ログインを `/login` に飛ばしつつ、`(app)/layout.tsx` でも `redirect("/login")` してOKです。

```text
proxy.ts:
  リクエスト時ガード

(app)/layout.tsx:
  Server Component 側の保険
```

二重ですが、認証周りはこれくらいで良いです。

### 3. `/api/*` に AppShell は関係ない

Route Group の移動で API route を巻き込まないように注意です。

APIはそのまま：

```text
app/api/...
```

ページだけ `(app)` に移動。

### 4. active nav は `usePathname`

```tsx
const pathname = usePathname();

const active =
  item.href === "/"
    ? pathname === "/"
    : pathname.startsWith(item.href);
```

### 5. collapsed sidebar でも hover title を出す

閉じた時はラベルが消えるので、`title={item.label}` を付けると良いです。

---

## Phase 6.8 タスク分解

```text
1. app/(app)/layout.tsx を追加
2. 既存ページを app/(app)/ 配下へ移動
   - /
   - /reports
   - /reports/[id]
   - /reports/[id]/diff
   - /reports/[id]/preview
   - /admin/prompt-improvements
3. /login と /api は現状維持
4. app/_components/app-shell.tsx を追加
5. app/_components/app-header.tsx を追加
6. app/_components/app-sidebar.tsx を追加
7. app/_components/mobile-nav-drawer.tsx を追加
8. app/_components/nav-items.ts を追加
9. 既存Headerのメニュー表示を削除 or AppHeaderへ統合
10. tsc / test / build
```

---

## コミット名

```bash
git commit -m "Add responsive app shell navigation"
```

または Phase に合わせるなら：

```bash
git commit -m "Add sidebar and mobile navigation shell"
```

---

## Claude / Codex に渡す指示としては

こんな感じがよさそうです。

```text
Phase 6.8 として、ログイン後画面のナビゲーションをヘッダーメニューから App Shell に移行してください。

要件:
- /login 以外のページに共通で Header + Sidebar + Main の App Shell を適用する
- Next.js App Router の route group を使い、app/(app)/layout.tsx に AppShell を配置する
- /login と /api は App Shell 対象外
- 幅が md 以上ではサイドバーを表示し、ヘッダーのボタンで開閉できる
- スマホ幅ではサイドバーは非表示にし、ヘッダーのハンバーガーボタンからモバイルメニューを開く
- 現在サイト名とログアウト導線は Header / Sidebar のどちらかに自然に表示する
- 既存の demo auth / /api/me / Cookie セッションの仕組みを壊さない
- AppShell 関連の部品は app/_components に置く
- 既存の GoodjobAvatar をサイドバーやモバイルメニューに活用する
- nav items は app/_components/nav-items.ts に集約する
- 既存URLは変えない
- tsc / tests / next build が通る状態にする
```

この改善、かなりアプリっぽくなります。
Phase 7 の管理者向けRAGを追加する前にサイドバー化しておくと、メニュー追加もきれいになります。
```
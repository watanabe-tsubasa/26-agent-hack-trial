import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { getCurrentSiteFromCookies } from "@/lib/demo-auth";
import { LogoutButton } from "./_components/header-bar";
import { GoodjobAvatar } from "@/components/goodjob-avatar";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "事故報お任せグッジョくん",
  description: "AIエージェントによる事故報告書作成支援",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await getCurrentSiteFromCookies();

  return (
    <html lang="ja" className={notoSansJP.variable}>
      <body className="min-h-screen bg-slate-50 font-sans antialiased">
        <header className="bg-blue-900 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <GoodjobAvatar tone="idle" size="sm" />
            <div>
              <h1 className="text-base font-bold tracking-wide">
                事故報お任せグッジョくん
              </h1>
              <p className="text-blue-200 text-xs">
                {site ? site.name : "ログインしてください"}
              </p>
            </div>
            {site && (
              <nav className="ml-auto flex items-center gap-4 text-sm">
                <a href="/" className="text-blue-200 hover:text-white transition-colors">
                  新規作成
                </a>
                <a href="/reports" className="text-blue-200 hover:text-white transition-colors">
                  一覧
                </a>
                <a
                  href="/admin/prompt-improvements"
                  className="text-blue-200 hover:text-white transition-colors"
                >
                  施設ナレッジ管理
                </a>
                <LogoutButton />
              </nav>
            )}
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

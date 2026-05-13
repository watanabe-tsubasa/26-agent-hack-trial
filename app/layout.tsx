import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "事故報告書作成支援システム",
  description: "AIエージェントによる事故報告書作成支援",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={notoSansJP.variable}>
      <body className="min-h-screen bg-slate-50 font-sans antialiased">
        <header className="bg-blue-900 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-400 rounded flex items-center justify-center text-white font-bold text-sm">
              AI
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide">
                事故報告書作成支援システム
              </h1>
              <p className="text-blue-200 text-xs">AIエージェント連携</p>
            </div>
            <nav className="ml-auto flex gap-4 text-sm">
              <a href="/" className="text-blue-200 hover:text-white transition-colors">
                新規作成
              </a>
              <a href="/reports" className="text-blue-200 hover:text-white transition-colors">
                一覧
              </a>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

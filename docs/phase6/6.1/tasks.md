# Phase 6.1 タスク管理 — サイト切替 / デモログイン

> 方針: Azure 認証は今回入れない。`/login` でデモ用 ID/PASS を入力し、
> `siteKey` を HttpOnly Cookie に保存する。middleware で未ログインなら `/login` へ。
> 事故報作成・一覧・検索・画像候補など、サイトに紐づく挙動はすべて Cookie から `siteKey` を取り出して制御する。
>
> 既存の `store-001` は `aeon-mall-kanda` に置き換える方針だが、まずは並行運用も可能なように `lib/demo-sites.ts` の定数で抽象化する。

---

## 1. サイト定数定義

- [ ] `lib/demo-sites.ts` — デモサイトとデモユーザーの定数定義
  - `SiteKey = "kanda-office" | "aeon-mall-kanda"`
  - `DEMO_SITES`: `{ siteKey, facilityId, locationKey, name, description, mediaMode }[]`
    - `kanda-office`: 神田事務所サイト、`mediaMode: "video_frames"`
    - `aeon-mall-kanda`: イオンモール神田サイト、`mediaMode: "sample_scenes"`（既存の `store-001` を寄せる）
  - `DEMO_USERS`: `{ loginId, password, siteKey }[]`
    - `kanda` / `goodjob` → `kanda-office`
    - `mall`  / `goodjob` → `aeon-mall-kanda`
  - helper: `findSiteByKey(siteKey)`, `findUserByCredentials(loginId, password)`

---

## 2. セッション Cookie ヘルパ

- [ ] `lib/demo-auth.ts`
  - `SITE_COOKIE_NAME = "site_key"`
  - `setSiteCookie(siteKey)` — HttpOnly, Lax, path=/, maxAge=8h
  - `clearSiteCookie()`
  - `getCurrentSiteFromCookies()` — Server Component / Route Handler から呼ぶ
  - `requireCurrentSite()` — 未ログインなら例外、403/redirect ハンドリングは呼び出し側で

---

## 3. ログイン / ログアウト API

- [ ] `POST /api/login`
  - body: `{ loginId: string, password: string }`
  - 一致したら `setSiteCookie(siteKey)` を呼んで `{ siteKey, siteName }` を返す
  - 一致しなければ 401
- [ ] `POST /api/logout`
  - `clearSiteCookie()` して 204
- [ ] `GET /api/me`
  - 未ログインなら 401
  - 成功時 `{ siteKey, siteName, facilityId, locationKey, mediaMode }`

---

## 4. ログイン画面

- [ ] `app/login/page.tsx` — Client Component
  - フォーム: loginId / password
  - 「デモ用ログイン」セクションにボタン2つ（神田事務所 / イオンモール神田）でワンクリックログイン
  - 失敗時にエラーメッセージ
  - 成功後 `/` にリダイレクト

---

## 5. proxy.ts (Next.js 16 では middleware が proxy に改称)

- [ ] `proxy.ts`（プロジェクトルート）
  - 未ログインなら `/login` にリダイレクト
  - 除外パス: `/login`, `/api/login`, `/api/logout`, `/_next`, 静的アセット
  - Cookie `site_key` の存在のみで判定（中身の検証は API 側で）

---

## 6. 既存ページ・API にサイトスコープを反映

- [ ] `app/page.tsx` — フォーム送信時に Cookie の `siteKey` から `facilityId` を上書き
  - 既存の `DEFAULT_FORM.facilityId = "store-001"` は削除し、サーバから取得した値を初期値に
- [ ] `app/_components/new-report-form-utils.ts` — `facilityId` をフォーム状態から外し、送信時に注入する形に
- [ ] `app/api/reports` (`POST`) — body の `facilityId` を信用せず、Cookie の `siteKey` から決定した値で上書き
- [ ] `app/api/reports` (`GET`) — 現在の `facilityId` で絞る（後段 6.2 と統合してもOK）
- [ ] `app/reports/page.tsx` — 現在のサイト名をヘッダーに表示

---

## 7. レイアウト更新

- [ ] `app/layout.tsx`
  - ヘッダーに現在のサイト名（`GET /api/me` 経由でServer Componentから取得）
  - ログアウトボタン（Client Componentで `POST /api/logout` → `/login`）
  - 未ログインページ (`/login`) ではヘッダーを出さない

---

## 8. 既存データの扱い

- [ ] `aeon-mall-kanda` から見た時に既存の `store-001` 紐付きデータがどう見えるか確認
  - `frame_assets.facility_id = "store-001"` のレコードは、当面 `aeon-mall-kanda` として読めるようにエイリアス対応するか、SQL を1本叩いて `store-001 → aeon-mall-kanda` に更新するかを選択（→ Azure 側変更が必要なら声をかける）

---

## 9. 動作確認

- [ ] `pnpm dev` 起動 → 未ログインで `/` にアクセスすると `/login` へリダイレクト
- [ ] `kanda` / `goodjob` でログインすると `/` に遷移、ヘッダーに「神田事務所サイト」が表示される
- [ ] 新規事故報作成 → DB の `input_json.facilityId` が `kanda-office` になっている
- [ ] ログアウトすると `/login` に戻り、Cookie が消える
- [ ] 別ブラウザで `mall` / `goodjob` ログイン → 同じ操作で `aeon-mall-kanda` になる

---

## 10. デプロイ (ユーザー対応)

- [ ] `git push origin main` で Container Apps にデプロイ
- [ ] 本番でも `/login` が機能することを確認

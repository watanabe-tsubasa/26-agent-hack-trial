# Phase 8.1 タスク管理 — 写真削除の反映バグ修正

> 方針: PATCH時に送られてきた `photos` を「新しい写真台帳の正」として扱う。
> 現状の `mergePhotos`（current.photos を起点に patch を当てる）が削除・追加・並び替えに反応しないので置き換える。
>
> 依存: なし
> Azure 側変更: 不要

---

## 1. フロントエンド: PATCH時に必要な表示情報を全部送る

- [x] `app/(app)/reports/[id]/page.tsx`
  - `handleSave` の `photos` payload を `editedReport.photos.map(...)` で次に変更
    - `id`, `imageUrl`, `cameraName`, `capturedAt`, `photoLocationName`, `blobContainer`, `blobName`, `caption`, `relevanceScore`, `observedFacts`
  - 削除・並び替え・名称変更が同じ保存経路で永続化される

---

## 2. API: photos を正として受け取る

- [x] `app/api/reports/[id]/route.ts`
  - `mergePhotos` を削除
  - 受け取った `updates.photos` をそのまま `updatedPhotos` に
  - 型ガード（id, imageUrl などの必須プロパティ存在）を最小限で実施
  - `recordFeedbacks` には影響しない（photosは現状feedback対象外）

---

## 3. 動作確認

- [x] tsc clean / pnpm test / pnpm build OK
- [x] 写真台帳タブで写真を「✕」削除 → 保存 → 再読込で削除が反映される
- [x] 「↑↓」並び替え → 保存 → 再読込で順序が保持される
- [x] photoLocationName 編集 → 保存 → 再読込で反映される
- [x] 確定後の preview にも反映される

---

## 4. デプロイ

- [x] `git push origin main`

# Phase 8.2 タスク管理 — 現地写真アップロード

> 方針: カメラ画像とは別ライフサイクルの「現地写真」をアップロード可能にする。
> Blob container は `report-photos` を新設。アップロード成功時に `Photo` を返し、
> フロントは `editedReport.photos` に append → 保存ボタンで永続化（=8.1 のフロー）。
>
> 依存: Phase 8.1（photos が正として保存される）
> Azure 側変更: `report-photos` コンテナ作成（ユーザー側で実施）

---

## 1. 型拡張

- [x] `lib/types.ts`
  - `PhotoSourceType = "camera_frame" | "uploaded_photo"` を追加
  - `Photo` に optional `sourceType?: PhotoSourceType` を追加
  - 既存のカメラ画像は `sourceType` 省略時 `"camera_frame"` 相当として扱う

---

## 2. アップロード API

- [x] `app/api/reports/[id]/photos/upload/route.ts`（新規）
  - `POST`, `multipart/form-data`, field `file`, optional field `photoLocationName`
  - content-type allow list: `image/jpeg`, `image/png`, `image/webp`
  - size 上限 10MB（超過は 413）
  - レポート存在確認（404）
  - Blob container = `report-photos`、blobName = `{reportId}/{uuid}.{ext}`
  - `uploadFile` で保存
  - 返却 `Photo`:
    - `id`: `photo_uploaded_{uuid}`
    - `imageUrl`: `getBlobUrl(...)`
    - `cameraName`: `"現地アップロード"`
    - `capturedAt`: `new Date().toISOString()`
    - `photoLocationName`: form の値、無ければ `"現地写真"`
    - `blobContainer`, `blobName`
    - `sourceType`: `"uploaded_photo"`
  - 認証/権限は既存の `requireSiteUserSession` パターンに合わせる（無ければ無認証で良い）

---

## 3. 写真台帳タブ UI

- [x] `app/(app)/reports/[id]/page.tsx` の `PhotosTab`
  - 既存の amber 注意書きを置き換え、「現地写真を追加」ボタン
  - 押下で `<input type="file" accept="image/*">` を起動（hidden input + ref）
  - 選択時に FormData で `/api/reports/{id}/photos/upload` POST
  - レスポンスの `Photo` を `editedReport.photos` に append（最大8枚制約は UI で disable）
  - アップロード中はボタン disabled + spinner
  - 失敗時は inline エラー表示
  - 確定済みの場合は非表示

---

## 4. 動作確認

- [x] tsc clean / pnpm test / pnpm build OK
- [x] アップロード → 写真台帳に表示される
- [x] 保存 → 再読込で残る（Phase 8.1 が前提）
- [x] 削除可能、並び替え可能
- [x] 確定後 preview にも表示される
- [x] サイズ超過・形式違反は適切にエラー

---

## 5. デプロイ

- [ ] Azure: `report-photos` コンテナ作成（ユーザー）
- [ ] `git push origin main`

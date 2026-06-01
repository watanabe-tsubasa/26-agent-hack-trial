了解です。イオンモール神田はOK、問題は **神田事務所の時刻検索UX** と **写真レビュー/確定制御** に絞れましたね。
修正対応は **Phase 8.4** としてまとめるのが良さそうです。

## Phase 8.4 修正対応まとめ

### 目的

神田事務所の時刻近傍検索をデモ入力に耐えるようにしつつ、写真台帳のレビュー体験を「AIが勝手に8枚確定」ではなく、**AIが候補を整理し、人間が8枚以下に絞って確定する** 形にする。

あわせて、文書・写真の未保存変更がある状態で確定できてしまう問題を防ぐ。

---

## 1. 神田事務所の時刻検索窓を広げる

### 現状の問題

神田事務所では、`15:21` 入力では該当画像が拾えたが、`15:20` 入力では拾えなかった。

原因は、現在の検索範囲が `T-12s〜T+15s` 相当でシビアなため。
フォーム入力が分単位になると、実際の事故時刻 `15:20:36` からズレて候補が外れる。

### 修正方針

神田事務所の `time_window_frames` 戦略では、候補検索範囲を広げる。

おすすめ設定:

```txt
T - 60s 〜 T + 90s
```

3秒間隔のフレームなら最大約51枚程度。
その中からAI評価対象を絞る。

### 実装案

```ts
const KANDA_OFFICE_SEARCH_WINDOW = {
  beforeSeconds: 60,
  afterSeconds: 90,
  maxCandidatesForEvaluation: 30,
};
```

検索自体は `T-60s〜T+90s` で取り、AI評価対象は事故時刻に近い順またはタグ一致優先で最大30枚程度にする。

### 期待挙動

```txt
occurredAt = 2026-05-26 15:20 JST
```

でも、`15:20:36` 周辺の転倒・救助フレームが候補に含まれる。

---

## 2. 写真候補を最初から8枚に絞らない

### 現状の問題

AI評価後に優先度上位8枚だけが表示されている。
そのため、ユーザーが写真を削除したときに、次点候補のような意図しない写真が出てきて「変な写真が増えた」ように見える。

### 修正方針

AI評価で引っかかった画像は、最初から8枚に絞らず **候補一覧としてすべて表示** する。

ユーザーが候補から採用/除外を選び、**採用写真が8枚以下になるまで確定不可** にする。

### 推奨する型変更

`Photo` に採用状態を持たせる。

```ts
export type Photo = {
  id: string;
  imageUrl: string;
  cameraName: string;
  capturedAt: string;
  photoLocationName: string;
  sourceType?: PhotoSourceType;

  selected?: boolean;
  candidateRank?: number;
  selectionReason?: string;
  exclusionReason?: string;

  blobContainer?: string;
  blobName?: string;
  caption?: string;
  relevanceScore?: number;
  observedFacts?: string[];
};
```

### UI方針

写真台帳タブでは、削除ボタン中心ではなく以下のようにする。

```txt
[採用する / 除外する]
```

またはチェックボックス。

```txt
☑ 写真台帳に採用
```

### 表示ルール

```txt
候補写真:
  report.photos 全件を表示

採用写真数:
  report.photos.filter(p => p.selected !== false).length

preview / confirm:
  selected !== false の写真のみ使用
```

既存データとの互換性を考えると、`selected` が未定義の場合は採用扱いにする。

```ts
function isSelectedPhoto(photo: Photo) {
  return photo.selected !== false;
}
```

---

## 3. 採用写真が8枚を超える場合は確定不可

### 現状の問題

写真台帳は最大8枚だが、候補表示を増やすと8枚超になる可能性がある。

### 修正方針

採用写真が8枚を超えている場合、確定ボタンをdisabledにする。

```ts
const selectedPhotoCount = editedReport.photos.filter((p) => p.selected !== false).length;
const hasTooManyPhotos = selectedPhotoCount > 8;
```

```tsx
<button
  disabled={confirming || isDirty || hasTooManyPhotos}
>
  この内容で確定
</button>
```

警告表示:

```tsx
{hasTooManyPhotos && (
  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
    写真台帳に掲載できる写真は最大8枚です。採用する写真を8枚以下にしてください。
  </div>
)}
```

---

## 4. 未保存変更がある場合は確定不可

### 現状の問題

文書修正・写真追加削除を行ったあと、「修正内容を保存」を押さずに確定すると、古い出力状態で確定される。

### 修正方針

`report` と `editedReport` を比較して dirty 判定を行い、未保存変更がある場合は確定ボタンをdisabledにする。

### 実装案

```ts
function normalizeReportForDirtyCheck(report: Report) {
  return {
    summary: report.summary,
    fiveWTwoH: report.fiveWTwoH,
    cause: report.cause,
    treatment: report.treatment,
    preventiveAction: report.preventiveAction,
    body: report.body,
    photos: report.photos,
  };
}

const isDirty =
  editedReport && report
    ? JSON.stringify(normalizeReportForDirtyCheck(editedReport)) !==
      JSON.stringify(normalizeReportForDirtyCheck(report))
    : false;
```

確定ボタン:

```tsx
<button
  onClick={handleConfirm}
  disabled={confirming || isDirty || hasTooManyPhotos}
>
  {isDirty ? "保存後に確定できます" : "この内容で確定"}
</button>
```

警告表示:

```tsx
{isDirty && (
  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
    未保存の修正があります。「修正内容を保存」を押すと確定できるようになります。
  </div>
)}
```

---

## 5. 保存時の写真payload

写真はフル配列で保存する方針を維持する。

追加で `selected`, `candidateRank`, `selectionReason`, `exclusionReason` も保存対象に含める。

```ts
photos: editedReport.photos.map((p) => ({
  id: p.id,
  imageUrl: p.imageUrl,
  cameraName: p.cameraName,
  capturedAt: p.capturedAt,
  photoLocationName: p.photoLocationName,
  sourceType: p.sourceType,
  selected: p.selected,
  candidateRank: p.candidateRank,
  selectionReason: p.selectionReason,
  exclusionReason: p.exclusionReason,
  blobContainer: p.blobContainer,
  blobName: p.blobName,
  caption: p.caption,
  relevanceScore: p.relevanceScore,
  observedFacts: p.observedFacts,
}))
```

---

## 6. preview / 確定時の写真扱い

### 修正方針

帳票プレビューや確定レポートでは、`selected !== false` の写真だけを使う。

最大8枚制限はUIで担保するが、防御的にpreview側でも以下にしてよい。

```ts
const ledgerPhotos = report.photos
  .filter((p) => p.selected !== false)
  .slice(0, 8);
```

ただし、UX上は `.slice(0, 8)` で黙って切るより、レビュー画面で8枚以下にさせる方が良い。

---

## 7. 現地写真アップロードの扱い

現地写真はアップロード時点で `selected: true` にする。

```ts
const uploadedPhoto: Photo = {
  id,
  imageUrl,
  cameraName: "現地アップロード",
  capturedAt: new Date().toISOString(),
  photoLocationName: "現地写真",
  sourceType: "uploaded_photo",
  selected: true,
  blobContainer: "report-photos",
  blobName,
};
```

8枚超になる場合は、追加自体を止めるのではなく、追加後に「採用写真が8枚を超えています」と表示し、どれかを除外させる方が自然。

---

## 8. テスト観点

追加・修正したいテストはこのあたり。

```txt
camera-search:
- kanda-office は T-60s〜T+90s の範囲で候補を拾う
- 15:20 入力でも 15:20:36 周辺が候補に入る
- aeon-mall-kanda は fixed_generated_images のまま変わらない

photo selection:
- selected !== false の写真だけが採用扱い
- selected が undefined の既存写真は採用扱い
- selected 写真が8枚超なら確定不可

dirty check:
- 本文変更で isDirty = true
- 写真 selected 変更で isDirty = true
- 写真アップロードで isDirty = true
- 保存後は isDirty = false
```

---

## 実装優先順位

```txt
1. dirty判定 + 未保存時の確定disabled
2. selected写真数が8枚超のとき確定disabled
3. Photo.selected を導入して、削除ではなく採用/除外UIに変更
4. preview / 保存payload / upload photo に selected 対応
5. 神田事務所の検索窓を T-60s〜T+90s に拡大
6. AI評価後の候補を8枚で切らず、候補全件を保持・表示
```

## 完了条件

```txt
- イオンモール神田は既存どおり正常動作する
- 神田事務所で 15:20 入力でも転倒・救助フレームが候補に含まれる
- 写真候補が8枚超でも全候補がレビュー画面に表示される
- 採用写真が8枚超の間は確定できない
- 文書・写真の変更後、保存前は確定できない
- 保存後、採用写真が8枚以下なら確定できる
- preview / 確定レポートには採用写真だけが出る
```

この修正で、Phase 8 はかなり「人間が最終確認する事故報エージェント」っぽくなります。
AIが勝手に確定するのではなく、**AIが候補と理由を出し、人間が採用写真を選び、保存して確定する** という流れになるので、デモの説得力もかなり上がるはずです。

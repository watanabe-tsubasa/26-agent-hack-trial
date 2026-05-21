# 事故報告書作成AIエージェント プロトタイプ 要件定義書

## 1. 概要

施設管理業務における事故報告書作成を支援するWebアプリケーションを開発する。

現場担当者が事故の概要、発生日時、発生場所などを入力すると、AIエージェントが関連するカメラ画像を取得した想定で、事故報告書ドラフトを自動生成する。

プロトタイプでは、実際のカメラ連携・Azure AI連携は行わず、固定画像とモック処理で動作を再現する。

出力する事故報告書は、実際の帳票フォーマットを参考に、以下の2ページ構成を想定する。

- 1ページ目：事故報告書本体
- 2ページ目：写真台帳

---

## 2. プロトタイプの目的

- 事故報告書作成AIエージェントの動作イメージを共有する
- 施設管理の現場担当者が使う画面イメージを確認する
- 実際の事故報告書フォーマットに近い出力を確認する
- 画像付き事故報告書の作成・修正・確定フローを確認する

---

## 3. 技術スタック

- Next.js
- TypeScript
- Tailwind CSS
- Node.js
- Next.js Route Handler / BFF
- モックデータによるAI生成処理

---

## 4. 実装方針

プロトタイプでは、Next.jsアプリ内にフロントエンドとBFFを同居させる。

```text
Browser
  ↓
Next.js Frontend
  ↓
Next.js BFF / API Routes
  ↓
Mock Agent Service
  ↓
Mock Camera Image / Mock Vision / Mock Report Store
````

将来的には以下に差し替える想定。

* Microsoft Foundry Agent Service
* Azure OpenAI
* Azure AI Vision
* Azure Blob Storage
* Azure Cosmos DB
* 社内PC上のカメラ画像取得API
* Microsoft Entra ID

---

## 5. 想定事故シナリオ

* プロトタイプでは、取得できる画像は天板の落下とエスカレーターのアクリルボード落下のみとする（publicに画像を配置）
* それ以外のシナリオの場合、該当する画像は発見されませんでしたと返し、画像貼り付けページは空欄で生成する

---

## 6. 画面要件

### 6.1 新規事故報告書作成画面

現場担当者が事故概要を入力する画面。

#### 入力項目

* 事故概要
* 発生日時
* 発生場所
* 補足情報
* 被害者有無
* 復旧状況
* 金額影響の有無

#### 初期入力例

```text
事故概要:
本館3階 南側廊下で天井ボードが落下していた。

発生日時:
2025-05-20 10:15

発生場所:
本館 3階 南側廊下

補足情報:
現時点で人的被害は確認されていない。
```

#### 操作

* 「AIエージェントに作成を依頼」ボタンを押下
* 作成中画面へ遷移
* 数秒後にドラフト確認画面へ遷移

---

### 6.2 作成中画面

AIエージェントが処理している様子を表示する。

#### 表示ステップ

1. 入力内容を確認中
2. 発生日時・場所から関連カメラを検索中
3. カメラ画像を取得中
4. 画像を解析中
5. 事故報告書フォーマットに整理中
6. 写真台帳を作成中
7. 事故報告書ドラフトを生成中

---

### 6.3 ドラフト確認・編集画面

AIが生成した事故報告書ドラフトを確認・修正する画面。

#### 表示タブ

* 事故報告書
* 写真台帳
* AI出力と修正差分

---

## 7. 事故報告書本体要件

事故報告書本体は、実帳票の1ページ目を参考にする。

### 7.1 基本情報

以下の項目を表示・編集できること。

* 報告書タイトル
* 事故概要
* 発生日時
* 発生場所
* 復旧日時
* 報告日
* 報告者
* 担当部署
* 金額

### 7.2 被害者情報

以下を表示・編集できること。

* 被害者有無
* 被害者区分

  * 従業員
  * 協力会社
  * 来館者
  * テナント関係者
  * その他
* 性別
* 年齢
* 被害程度
* 備考

人的被害がない場合は、以下のように表示する。

```text
人的被害なし
```

### 7.3 事故詳細

5W2H形式で事故内容を整理する。

#### 項目

* When：いつ
* Where：どこで
* Who：誰が / 誰に
* What：何が起きたか
* Why：なぜ起きたと考えられるか
* How：どのような状況だったか
* How much：金額影響

#### 例

```text
When:
2025年5月20日 10時15分頃

Where:
本館3階 南側廊下

Who:
通行者への接触は確認されていない

What:
天井ボードの一部が落下し、床面に散乱した

Why:
天井ボード固定部の劣化、下地部材の緩み、漏水等の可能性がある

How:
監視カメラ画像上、廊下床面に天井材が複数散乱している

How much:
現時点では金額影響は未算定
```

### 7.4 原因

AIが推定した原因を表示する。

例:

```text
天井ボード固定部の経年劣化、下地部材の緩み、または天井裏設備からの漏水等により、天井ボードが落下した可能性がある。
```

### 7.5 処置

初動対応や現場対応を表示する。

例:

```text
該当エリアを一時立入禁止とし、カラーコーン等で区画した。
施設管理担当者が現地確認を実施し、落下物の撤去および周辺天井の安全確認を行う。
```

### 7.6 防止対策

再発防止策を表示する。

例:

```text
同一フロアおよび類似箇所の天井ボード固定状態を点検する。
天井裏の漏水、設備振動、下地部材の劣化有無を確認する。
必要に応じて補修計画を作成する。
```

### 7.7 報告書本文

AIが自然文で生成した本文を表示する。

例:

```text
2025年5月20日10時15分頃、本館3階南側廊下にて天井ボードの落下が確認された。取得画像では、廊下床面に天井材が散乱しており、天井面の一部に破損または開口が見られる。現時点で人的被害は確認されていないが、二次被害防止のため該当エリアを一時立入禁止とし、施設管理担当者による現地確認を実施する。
```

---

## 8. 写真台帳要件

写真台帳は、実帳票の2ページ目を参考にする。

### 8.1 表示形式

* 最大8枚の画像を表示する
* 2列×4行のグリッド表示にする
* 各写真枠には番号を表示する

  * ①
  * ②
  * ③
  * ④
  * ⑤
  * ⑥
  * ⑦
  * ⑧

### 8.2 各写真に保持する項目

| 項目     | 内容              |
| ------ | --------------- |
| 画像     | カメラ取得画像またはモック画像 |
| 写真場所名称 | 写真の説明・場所名       |
| 撮影日時   | カメラ取得日時またはモック日時 |
| カメラ名   | 取得元カメラ名         |

### 8.3 初期写真

プロトタイプでは2枚以上の固定画像を設定する。

#### 写真1

```text
画像:
天井ボード落下箇所の全景

写真場所名称:
本館3階 南側廊下 天井ボード落下箇所
```

#### 写真2

```text
画像:
床面に散乱した天井材

写真場所名称:
落下した天井ボードおよび床面散乱状況
```

### 8.4 編集機能

ユーザーは以下を編集できること。

* 写真場所名称
* 写真の並び順
* 写真の削除
* 写真の追加

ただし、プロトタイプでは写真追加はモック画像選択でよい。

---

## 9. AI出力と修正差分要件

ユーザーがAI生成内容を修正した場合、以下を保存する。

* AIの初期出力
* ユーザー修正後の内容
* 差分
* 修正日時
* 修正者

### 9.1 差分対象

* 事故概要
* 5W2H
* 原因
* 処置
* 防止対策
* 報告書本文
* 写真場所名称

### 9.2 表示内容

差分表示画面では、以下を表示する。

```text
AI出力:
天井ボード固定部の劣化により落下した可能性がある。

修正後:
天井ボード固定部の劣化または天井裏漏水の影響により落下した可能性がある。

差分:
「天井裏漏水の影響」が追加されました。
```

### 9.3 改善サイクル表示

保存時に以下のメッセージを表示する。

```text
修正内容を保存しました。
この内容は今後のAI出力改善に活用されます。
```

---

## 10. API要件

### 10.1 事故報告書作成API

```http
POST /api/reports
```

#### Request

```json
{
  "summary": "本館3階 南側廊下で天井ボードが落下していた。",
  "occurredAt": "2025-05-20T10:15:00+09:00",
  "location": "本館 3階 南側廊下",
  "note": "現時点で人的被害は確認されていない。",
  "hasVictim": false,
  "recoveryStatus": "未復旧",
  "amountImpact": "未算定"
}
```

#### Response

```json
{
  "reportId": "report_001",
  "status": "processing"
}
```

---

### 10.2 作成状況取得API

```http
GET /api/reports/:reportId/status
```

#### Response

```json
{
  "reportId": "report_001",
  "status": "completed",
  "steps": [
    { "label": "入力内容を確認中", "status": "completed" },
    { "label": "カメラ画像を検索中", "status": "completed" },
    { "label": "画像を解析中", "status": "completed" },
    { "label": "写真台帳を作成中", "status": "completed" },
    { "label": "事故報告書を作成中", "status": "completed" }
  ]
}
```

---

### 10.3 事故報告書取得API

```http
GET /api/reports/:reportId
```

#### Response

```json
{
  "id": "report_001",
  "status": "review",
  "title": "事故報告書",
  "summary": "本館3階 南側廊下で天井ボードが落下していた。",
  "occurredAt": "2025-05-20T10:15:00+09:00",
  "location": "本館 3階 南側廊下",
  "reportedAt": "2025-05-20T11:00:00+09:00",
  "reporter": "施設管理担当者",
  "department": "施設管理部",
  "recoveredAt": null,
  "amount": "未算定",
  "victim": {
    "hasVictim": false,
    "category": "なし",
    "gender": null,
    "age": null,
    "damageLevel": "人的被害なし",
    "note": ""
  },
  "fiveWTwoH": {
    "when": "2025年5月20日 10時15分頃",
    "where": "本館3階 南側廊下",
    "who": "通行者への接触は確認されていない",
    "what": "天井ボードの一部が落下し、床面に散乱した",
    "why": "天井ボード固定部の劣化、下地部材の緩み、漏水等の可能性がある",
    "how": "監視カメラ画像上、廊下床面に天井材が複数散乱している",
    "howMuch": "現時点では金額影響は未算定"
  },
  "cause": "天井ボード固定部の経年劣化、下地部材の緩み、または天井裏設備からの漏水等により、天井ボードが落下した可能性がある。",
  "treatment": "該当エリアを一時立入禁止とし、カラーコーン等で区画した。施設管理担当者が現地確認を実施し、落下物の撤去および周辺天井の安全確認を行う。",
  "preventiveAction": "同一フロアおよび類似箇所の天井ボード固定状態を点検する。天井裏の漏水、設備振動、下地部材の劣化有無を確認する。",
  "body": "2025年5月20日10時15分頃、本館3階南側廊下にて天井ボードの落下が確認された。取得画像では、廊下床面に天井材が散乱しており、天井面の一部に破損または開口が見られる。現時点で人的被害は確認されていないが、二次被害防止のため該当エリアを一時立入禁止とし、施設管理担当者による現地確認を実施する。",
  "photos": [
    {
      "id": "photo_001",
      "imageUrl": "/mock/ceiling-board-fall-1.jpg",
      "cameraName": "本館3階 南側廊下カメラ",
      "capturedAt": "2025-05-20T10:15:00+09:00",
      "photoLocationName": "本館3階 南側廊下 天井ボード落下箇所"
    },
    {
      "id": "photo_002",
      "imageUrl": "/mock/ceiling-board-fall-2.jpg",
      "cameraName": "本館3階 南側廊下カメラ",
      "capturedAt": "2025-05-20T10:15:10+09:00",
      "photoLocationName": "落下した天井ボードおよび床面散乱状況"
    }
  ]
}
```

---

### 10.4 事故報告書更新API

```http
PATCH /api/reports/:reportId
```

#### Request

```json
{
  "fiveWTwoH": {
    "why": "天井ボード固定部の劣化または天井裏漏水の影響により落下した可能性がある"
  },
  "cause": "天井ボード固定部の劣化または天井裏漏水の影響により落下した可能性がある。",
  "treatment": "該当エリアを一時立入禁止とし、施設管理担当者が現地確認を実施した。",
  "preventiveAction": "同一フロアの天井ボード固定状態と天井裏漏水有無を確認する。",
  "body": "修正後の報告書本文",
  "photos": [
    {
      "id": "photo_001",
      "photoLocationName": "本館3階 南側廊下 落下箇所全景"
    }
  ]
}
```

#### Response

```json
{
  "reportId": "report_001",
  "status": "updated",
  "savedFeedback": true
}
```

---

### 10.5 確定API

```http
POST /api/reports/:reportId/confirm
```

#### Response

```json
{
  "reportId": "report_001",
  "status": "confirmed"
}
```

---

## 11. データモデル

```ts
type ReportStatus = "processing" | "review" | "updated" | "confirmed";

type Victim = {
  hasVictim: boolean;
  category: "なし" | "従業員" | "協力会社" | "来館者" | "テナント関係者" | "その他";
  gender?: "男性" | "女性" | "その他" | null;
  age?: number | null;
  damageLevel: string;
  note?: string;
};

type FiveWTwoH = {
  when: string;
  where: string;
  who: string;
  what: string;
  why: string;
  how: string;
  howMuch: string;
};

type Photo = {
  id: string;
  imageUrl: string;
  cameraName: string;
  capturedAt: string;
  photoLocationName: string;
};

type Report = {
  id: string;
  status: ReportStatus;

  title: string;
  summary: string;
  occurredAt: string;
  location: string;
  note?: string;

  reportedAt: string;
  reporter: string;
  department: string;
  recoveredAt?: string | null;
  amount?: string;

  victim: Victim;
  fiveWTwoH: FiveWTwoH;

  cause: string;
  treatment: string;
  preventiveAction: string;
  body: string;

  photos: Photo[];

  originalAiOutput: {
    victim: Victim;
    fiveWTwoH: FiveWTwoH;
    cause: string;
    treatment: string;
    preventiveAction: string;
    body: string;
    photos: Photo[];
  };

  feedbacks: Feedback[];

  createdAt: string;
  updatedAt: string;
};

type Feedback = {
  id: string;
  reportId: string;
  fieldName: string;
  before: string;
  after: string;
  diffSummary: string;
  savedAt: string;
};
```

---

## 12. モック仕様

### 12.1 カメラ画像取得モック

```ts
async function fetchCameraImagesMock(input: {
  occurredAt: string;
  location: string;
}): Promise<Photo[]>;
```

#### 戻り値例

```json
[
  {
    "id": "photo_001",
    "imageUrl": "/mock/ceiling-board-fall-1.jpg",
    "cameraName": "本館3階 南側廊下カメラ",
    "capturedAt": "2025-05-20T10:15:00+09:00",
    "photoLocationName": "本館3階 南側廊下 天井ボード落下箇所"
  },
  {
    "id": "photo_002",
    "imageUrl": "/mock/ceiling-board-fall-2.jpg",
    "cameraName": "本館3階 南側廊下カメラ",
    "capturedAt": "2025-05-20T10:15:10+09:00",
    "photoLocationName": "落下した天井ボードおよび床面散乱状況"
  }
]
```

---

### 12.2 AI画像解析モック

```ts
async function analyzeImagesMock(photos: Photo[]): Promise<string>;
```

#### 戻り値例

```text
廊下の床面に天井ボードと思われる建材が複数散乱している。
天井面の一部に破損または開口が確認できる。
周辺に人の転倒や接触を示す明確な様子は確認できない。
```

---

### 12.3 事故報告書生成モック

```ts
async function generateReportDraft(input: {
  summary: string;
  occurredAt: string;
  location: string;
  note?: string;
  photos: Photo[];
  imageObservation: string;
}): Promise<Report>;
```

---

## 13. 画面構成

```text
/
  新規事故報告書作成画面

/reports
  事故報告書一覧画面

/reports/[id]
  事故報告書確認・編集画面

/reports/[id]/preview
  帳票プレビュー画面

/reports/[id]/diff
  AI出力と修正差分画面
```

---

## 14. 帳票プレビュー要件

### 14.1 1ページ目

事故報告書本体を表示する。

表示項目:

* 基本情報
* 被害者情報
* 5W2H
* 原因
* 処置
* 防止対策
* 報告書本文
* 復旧日時
* 金額

### 14.2 2ページ目

写真台帳を表示する。

表示項目:

* 最大8枚の画像枠
* 写真番号
* 画像
* 写真場所名称
* 撮影日時
* カメラ名

---

## 15. UI方針

### トーン

* 施設管理業務向け
* 業務アプリらしくマテリアルデザインベースで、AIが作業している部分についてはグラスモーフィズムを活用しAIらしさをだす
* 非エンジニアにも分かりやすい
* AIが何をしているかが見える

* スケルトンデザインによるレイアウトシフト防止

### 重要な見せ方

* 「AIが勝手に作る」ではなく「担当者が確認・修正できる」ことを強調する
* カメラ画像がある場合は、客観情報として報告書に反映されることを示す
* カメラ画像がない場合でも、入力概要をもとにドラフトを作れることを示す
* 修正内容が次回以降の改善に使われることを示す

## 16. ディレクトリ構成案

```text
.
├── app
│   ├── page.tsx
│   ├── reports
│   │   ├── page.tsx
│   │   └── [id]
│   │       ├── page.tsx
│   │       ├── preview
│   │       │   └── page.tsx
│   │       └── diff
│   │           └── page.tsx
│   ├── api
│   │   └── reports
│   │       ├── route.ts
│   │       └── [id]
│   │           ├── route.ts
│   │           ├── status
│   │           │   └── route.ts
│   │           └── confirm
│   │               └── route.ts
│   └── globals.css
├── components
│   ├── report-form.tsx
│   ├── report-editor.tsx
│   ├── report-preview.tsx
│   ├── photo-ledger.tsx
│   ├── diff-viewer.tsx
│   ├── progress-steps.tsx
│   └── notification-card.tsx
├── lib
│   ├── mock-agent.ts
│   ├── mock-camera.ts
│   ├── mock-vision.ts
│   ├── report-store.ts
│   ├── report-template.ts
│   └── diff.ts
├── public
│   └── mock
│       ├── ceiling-board-fall-1.jpg
│       └── ceiling-board-fall-2.jpg
├── next.config.ts
├── package.json
└── README.md
```

---

## 17. プロトタイプで実装しないこと

以下はスコープ外。

* 実際のAzure OpenAI連携
* 実際のMicrosoft Foundry Agent Service連携
* 実際のAzure AI Vision連携
* 実際のAzure Blob Storage連携
* 実際のCosmos DB連携
* 実際のカメラAPI連携
* 実際のVPN接続
* 実際のメール通知
* 実際のTeams通知
* 認証・権限管理
* Word / PDFの完全生成

ただし、将来差し替えやすい関数境界は用意する。

---

## 18. 受け入れ条件

* 事故概要、日時、場所を入力できる
* AIエージェントへの作成依頼ができる
* 作成中ステップが表示される
* 事故報告書ドラフトが表示される
* 1ページ目の事故報告書本体を確認できる
* 2ページ目の写真台帳を確認できる
* 最大8枚の写真枠を表示できる
* 写真場所名称を編集できる
* 5W2Hを編集できる
* 原因、処置、防止対策を編集できる
* 報告書本文を編集できる
* 修正内容を保存できる
* AI出力と修正後の差分を確認できる
* 確定操作ができる
* 一覧画面で確定済み報告書を確認できる

---

## 19. デモシナリオ

1. 現場担当者がWebアプリを開く
2. 事故概要、発生日時、発生場所を入力する
3. 「AIエージェントに作成を依頼」を押す
4. AIがカメラ画像を取得・解析しているように表示する
5. 天井ボード落下の画像付き事故報告書ドラフトが生成される
6. 1ページ目の事故報告書本体を確認する
7. 2ページ目の写真台帳を確認する
8. 写真場所名称を修正する
9. 原因や防止対策を一部修正する
10. 修正内容を保存する
11. AI出力との差分を確認する
12. 「この内容で確定」を押す
13. 確定済み事故報告書として一覧に表示される

---

## 20. 将来拡張

* Microsoft Foundry Agent Service連携
* Azure OpenAIによる報告書生成
* Azure AI Visionによる画像解析
* Azure Blob Storageへの画像保存
* Cosmos DBへの事故報告書・修正履歴保存
* 社内PC上のカメラ画像取得API連携
* Microsoft Entra ID認証
* Teams通知
* PDF / Word出力
* 帳票テンプレート管理
* プロンプト改善管理画面

```

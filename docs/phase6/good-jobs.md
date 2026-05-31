いい感じに使い分けるなら、**UI状態名とファイル名を揃える**のが一番わかりやすいです。

おすすめはこの6種類です。

| 用途        | 表示タイトル     | ファイル名                       |
| --------- | ---------- | --------------------------- |
| 通常・待機     | 通常のグッジョくん  | `goodjob-idle.png`          |
| 考え中       | 考え中のグッジョくん | `goodjob-thinking.png`      |
| 集中・処理中    | 集中するグッジョくん | `goodjob-working.png`       |
| 画像探索・確認中  | 調査中のグッジョくん | `goodjob-investigating.png` |
| 完了・成功     | 完了したグッジョくん | `goodjob-success.png`       |
| 警告・失敗・要確認 | 困ったグッジョくん  | `goodjob-warning.png`       |

実装側ではこんな感じで持つと扱いやすいです。

```ts
export const GOODJOB_KUN_ASSETS = {
  idle: {
    src: "/goodjob/goodjob-idle.png",
    title: "通常のグッジョくん",
  },
  thinking: {
    src: "/goodjob/goodjob-thinking.png",
    title: "考え中のグッジョくん",
  },
  working: {
    src: "/goodjob/goodjob-working.png",
    title: "集中するグッジョくん",
  },
  investigating: {
    src: "/goodjob/goodjob-investigating.png",
    title: "調査中のグッジョくん",
  },
  success: {
    src: "/goodjob/goodjob-success.png",
    title: "完了したグッジョくん",
  },
  warning: {
    src: "/goodjob/goodjob-warning.png",
    title: "困ったグッジョくん",
  },
} as const;
```

生成ステップにはこう割り当てると自然です。

```ts
export const GENERATION_STEP_GOODJOB_STATE = {
  parse_input: "thinking",
  search_camera_frames: "investigating",
  evaluate_images: "working",
  generate_report: "working",
  prepare_review: "success",
  failed: "warning",
} as const;
```

ディレクトリはこれでよさそうです。

```text
public/
  goodjob/
    goodjob-idle.png
    goodjob-thinking.png
    goodjob-working.png
    goodjob-investigating.png
    goodjob-success.png
    goodjob-warning.png
```

デモ中の文言としては、ファイル名よりも **「考え中のグッジョくん」「調査中のグッジョくん」** みたいに日本語で出した方がかわいいです。

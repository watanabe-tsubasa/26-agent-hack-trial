import type { GoodjobTone } from "./generation-steps";

export const GOODJOB_NAME = "事故報お任せグッジョくん";

export const GOODJOB_KUN_ASSETS: Record<GoodjobTone, { src: string; title: string }> = {
  idle: { src: "/goodjob/goodjob-idle.png", title: "通常のグッジョくん" },
  thinking: { src: "/goodjob/goodjob-thinking.png", title: "考え中のグッジョくん" },
  working: { src: "/goodjob/goodjob-working.png", title: "集中するグッジョくん" },
  investigating: { src: "/goodjob/goodjob-investigating.png", title: "調査中のグッジョくん" },
  success: { src: "/goodjob/goodjob-success.png", title: "完了したグッジョくん" },
  warning: { src: "/goodjob/goodjob-warning.png", title: "困ったグッジョくん" },
};

export const GOODJOB_HEADLINE = `${GOODJOB_NAME}が下書きを作成中`;
export const GOODJOB_COMPLETE_COPY =
  "下書きが完成しました。グッジョくんの下書きを確認してください";
export const GOODJOB_FAILED_COPY =
  "ごめんなさい、グッジョくんが下書き作成に失敗しました";
export const GOODJOB_AFTER_CONFIRM_COPY =
  "確認ありがとうございます！今回の修正は、次回以降の施設ナレッジ改善に活用されます。";

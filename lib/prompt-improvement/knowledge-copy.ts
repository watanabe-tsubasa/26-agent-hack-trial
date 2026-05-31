import type { GoodjobTone } from "../generation-steps";
import type { Override, RunStatus } from "@/app/(app)/admin/prompt-improvements/_components/types";

export const KNOWLEDGE_PAGE_TITLE = "施設ナレッジ改善";
export const KNOWLEDGE_PAGE_DESCRIPTION =
  "グッジョくんが、人間による事故報の修正履歴を振り返り、次回の報告書作成に活かせる施設固有の知識を候補として整理します。採用する前に、必ず人間が内容を確認できます。";
export const KNOWLEDGE_PAGE_NOTE =
  "共通の報告ルールは固定したまま、場所名称・注意箇所・過去の設備不具合など、施設ごとの知識だけを候補として追加します。";

export const KNOWLEDGE_PRIMARY_BUTTON_COPY = "グッジョくんに改善案を考えてもらう";
export const KNOWLEDGE_QUEUED_BUTTON_COPY = "順番待ち...";
export const KNOWLEDGE_RUNNING_BUTTON_COPY = "グッジョくんが分析中...";

export const KNOWLEDGE_HEADLINE_RUNNING = "グッジョくんが施設ナレッジを考えています";
export const KNOWLEDGE_HEADLINE_COMPLETE = "施設ナレッジ候補ができました";
export const KNOWLEDGE_HEADLINE_FAILED = "施設ナレッジ候補の作成に失敗しました";
export const KNOWLEDGE_DIALOG_LEAD = "施設ナレッジ改善エージェント";

export const KNOWLEDGE_RECEIVED_COPY = "グッジョくんに改善依頼を渡しました。考えてもらっています...";
export const KNOWLEDGE_ALREADY_RUNNING_COPY =
  "グッジョくんはまだ前回の改善案を考え中です。完了をお待ちください。";
export const KNOWLEDGE_NO_CORRECTIONS_COPY =
  "対象の修正履歴がありません。事故報告書の修正・確定を行ってからお試しください。";
export const KNOWLEDGE_SUPERSEDED_COPY =
  "この改善案は新しい実行で置き換えられました。";

export const SECTION_ACTIVE_TITLE = "現在適用中の施設ナレッジ";
export const SECTION_DRAFT_TITLE = "確認待ちの候補";
export const SECTION_DRAFT_HINT =
  "表示されるのは最新の候補1件です。新しい候補を生成すると、過去の候補は自動で「過去の候補」に移動します。";
export const SECTION_DRAFT_EMPTY =
  "確認待ちの候補はまだありません。上の「グッジョくんに改善案を考えてもらう」ボタンを押してください。";
export const SECTION_ARCHIVED_TITLE = "過去の候補";

export const OVERRIDE_STATUS_LABEL: Record<Override["status"], string> = {
  active: "利用中",
  draft: "確認待ち",
  archived: "過去",
};

export const PROMPT_IMPROVEMENT_STATUS_COPY: Record<
  RunStatus,
  { label: string; description: string; tone: GoodjobTone }
> = {
  queued: {
    label: "順番待ち",
    description: "グッジョくんが確認する準備をしています。",
    tone: "thinking",
  },
  running: {
    label: "分析中",
    description: "グッジョくんが修正履歴から施設固有の知識を探しています。",
    tone: "working",
  },
  completed: {
    label: "候補作成済み",
    description: "施設ナレッジ候補が作成されました。内容を確認してください。",
    tone: "success",
  },
  failed: {
    label: "生成失敗",
    description: "施設ナレッジ候補の作成に失敗しました。時間をおいて再実行してください。",
    tone: "warning",
  },
  superseded: {
    label: "新しい実行で更新済み",
    description: "より新しい改善処理が実行されています。",
    tone: "idle",
  },
};

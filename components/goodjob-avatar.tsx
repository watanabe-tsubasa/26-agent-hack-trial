import { GOODJOB_KUN_ASSETS } from "@/lib/goodjob-copy";
import type { GoodjobTone } from "@/lib/generation-steps";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  xs: "w-6 h-6",
  sm: "w-9 h-9",
  md: "w-16 h-16",
  lg: "w-28 h-28",
};

type Props = {
  tone?: GoodjobTone;
  size?: Size;
  className?: string;
};

export function GoodjobAvatar({ tone = "idle", size = "md", className }: Props) {
  const asset = GOODJOB_KUN_ASSETS[tone];
  return (
    <img
      src={asset.src}
      alt={asset.title}
      title={asset.title}
      className={`${SIZE_CLASS[size]} object-contain ${className ?? ""}`}
    />
  );
}

import Image from "next/image";
import { GOODJOB_KUN_ASSETS } from "@/lib/goodjob-copy";
import type { GoodjobTone } from "@/lib/generation-steps";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  xs: "w-6 h-6",
  sm: "w-9 h-9",
  md: "w-16 h-16",
  lg: "w-28 h-28",
};

const IMAGE_SIZE: Record<Size, number> = {
  xs: 24,
  sm: 36,
  md: 64,
  lg: 112,
};

type Props = {
  tone?: GoodjobTone;
  size?: Size;
  className?: string;
  priority?: boolean;
};

export function GoodjobAvatar({
  tone = "idle",
  size = "md",
  className,
  priority = false,
}: Props) {
  const asset = GOODJOB_KUN_ASSETS[tone];
  const imageSize = IMAGE_SIZE[size];

  return (
    <Image
      src={asset.src}
      alt={asset.title}
      title={asset.title}
      width={imageSize}
      height={imageSize}
      priority={priority}
      className={`${SIZE_CLASS[size]} object-contain ${className ?? ""}`}
    />
  );
}
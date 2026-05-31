export type CameraSearchStrategy =
  | "fixed_generated_images"
  | "time_window_frames";

export function resolveCameraSearchStrategy(
  facilityId: string | null | undefined
): CameraSearchStrategy {
  if (facilityId === "kanda-office") return "time_window_frames";
  return "fixed_generated_images";
}

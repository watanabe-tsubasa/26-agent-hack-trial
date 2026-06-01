import type { CreateReportInput, Photo } from "../types";
import {
  searchFrameAssets,
  searchFrameAssetsByTimeWindow,
} from "../agent/frame-asset-repository";
import { resolveCameraSearchStrategy } from "./camera-search-strategy";

type TagRule = { tag: string; keywords: string[] };

const TAG_RULES: TagRule[] = [
  { tag: "ceiling", keywords: ["天井", "天板", "ボード"] },
  { tag: "escalator", keywords: ["エスカレーター", "エスカレータ"] },
  { tag: "fall", keywords: ["転倒", "倒れ", "つまずき", "滑り"] },
  { tag: "rescue", keywords: ["救助", "起き上がれない", "介助"] },
  { tag: "water-leak", keywords: ["漏水", "水漏れ", "雨漏り"] },
  { tag: "glass-damage", keywords: ["ガラス", "破損", "割れ"] },
];

export function detectScenarioTags(input: CreateReportInput): string[] {
  const text = `${input.location} ${input.summary}`;
  return TAG_RULES.filter((r) => r.keywords.some((k) => text.includes(k))).map(
    (r) => r.tag
  );
}

export async function searchCameraFrames(input: CreateReportInput): Promise<Photo[]> {
  if (!input.facilityId) return [];
  const strategy = resolveCameraSearchStrategy(input.facilityId);

  if (strategy === "time_window_frames") {
    return searchFrameAssetsByTimeWindow({
      facilityId: input.facilityId,
      occurredAt: input.occurredAt,
      beforeSeconds: 60,
      afterSeconds: 90,
      maxCandidates: 30,
      scenarioTags: detectScenarioTags(input),
    });
  }

  const tags = detectScenarioTags(input);
  const primary = tags[0] ?? null;
  const tagged = primary ? await searchFrameAssets(primary, input.facilityId) : [];
  if (tagged.length > 0) return tagged;
  return searchFrameAssets(null, input.facilityId);
}

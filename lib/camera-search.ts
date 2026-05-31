import type { CreateReportInput, Photo } from "./types";
import { searchFrameAssets } from "./frame-asset-repository";

const CEILING_KEYWORDS = ["天井", "天板", "ボード"];
const ESCALATOR_KEYWORDS = ["エスカレーター", "エスカレータ"];

function detectScenarioTag(input: CreateReportInput): string | null {
  const text = `${input.location} ${input.summary}`;
  if (CEILING_KEYWORDS.some((k) => text.includes(k))) return "ceiling";
  if (ESCALATOR_KEYWORDS.some((k) => text.includes(k))) return "escalator";
  return null;
}

export async function searchCameraFrames(input: CreateReportInput): Promise<Photo[]> {
  if (!input.facilityId) return [];
  const tag = detectScenarioTag(input);
  // タグが当たれば優先、当たらなくても facilityId のフレームから上位を返す
  const tagged = tag ? await searchFrameAssets(tag, input.facilityId) : [];
  if (tagged.length > 0) return tagged;
  return searchFrameAssets(null, input.facilityId);
}

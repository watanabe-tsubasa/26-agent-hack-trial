import type { Photo } from "../types";

const CEILING_KEYWORDS = ["天井", "天板", "ボード"];
const ESCALATOR_KEYWORDS = ["エスカレーター", "エスカレータ"];

function detectScenario(
  location: string,
  summary: string
): "ceiling" | "escalator" | "none" {
  const text = location + " " + summary;
  if (CEILING_KEYWORDS.some((k) => text.includes(k))) return "ceiling";
  if (ESCALATOR_KEYWORDS.some((k) => text.includes(k))) return "escalator";
  return "none";
}

export async function fetchCameraImagesMock(input: {
  occurredAt: string;
  location: string;
  summary?: string;
}): Promise<Photo[]> {
  const scenario = detectScenario(input.location, input.summary ?? "");
  if (scenario === "none") return [];

  const prefix =
    scenario === "ceiling"
      ? "ceiling-board-fall"
      : "escalator-acrylic-fall";
  const cameraName = `${input.location}カメラ`;
  const capturedAt2 = new Date(
    new Date(input.occurredAt).getTime() + 10_000
  ).toISOString();

  const locationNames =
    scenario === "ceiling"
      ? [
          `${input.location} 天井ボード落下箇所`,
          "落下した天井ボードおよび床面散乱状況",
        ]
      : [
          `${input.location} アクリルボード落下箇所`,
          "落下したアクリルボードおよび周辺散乱状況",
        ];

  return [
    {
      id: "photo_001",
      imageUrl: `/mock/${prefix}-1.png`,
      cameraName,
      capturedAt: input.occurredAt,
      photoLocationName: locationNames[0],
    },
    {
      id: "photo_002",
      imageUrl: `/mock/${prefix}-2.png`,
      cameraName,
      capturedAt: capturedAt2,
      photoLocationName: locationNames[1],
    },
  ];
}

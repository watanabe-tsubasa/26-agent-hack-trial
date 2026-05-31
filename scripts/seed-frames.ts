import { readFileSync } from "fs";
import { join } from "path";
import { uploadFile } from "../lib/blob-storage";
import { upsertFrameAsset } from "../lib/frame-asset-repository";
import { getDbPool } from "../lib/db";

const CONTAINER = "frames";
const FACILITY_ID = "aeon-mall-kanda";

// Blob パスに "ceiling" / "escalator" を含めることで mock-vision.ts のURL判定が継続動作する
const SEED_DATA = [
  {
    id: "frame_escalator_guard_0001",
    cameraId: "camera-escalator-2f-1f-down",
    cameraName: "2階→1階 下りエスカレーター監視カメラ",
    locationName: "2階から1階 下りエスカレーター三角部付近",
    floorLabel: "2F",
    capturedAt: "2026-05-21T10:15:00Z",
    frameIndex: 1,
    blobName:
      "aeon-mall-kanda/camera-escalator-2f-1f-down/escalator-guard-panel/demo/frame-0001.png",
    localFile: "escalator-guard-panel-fall.png",
    scenarioTags: ["escalator", "guard-panel"],
    description: "エスカレーター三角部付近を撮影したフレーム",
  },
  {
    id: "frame_ceiling_board_0001",
    cameraId: "camera-shopping-center-ceiling-1f",
    cameraName: "ショッピングセンター1階 共用部天井監視カメラ",
    locationName: "ショッピングセンター1階 共用通路",
    floorLabel: "1F",
    capturedAt: "2026-05-21T11:25:00Z",
    frameIndex: 1,
    blobName:
      "aeon-mall-kanda/camera-shopping-center-ceiling-1f/ceiling-board-fall/demo/frame-0001.png",
    localFile: "shopping-center-ceiling-board-fall.png",
    scenarioTags: ["ceiling", "board-fall"],
    description: "ショッピングセンター共用通路を撮影したフレーム",
  },
  {
    id: "frame_lighting_fixture_0001",
    cameraId: "camera-tenant-2f-lighting",
    cameraName: "2階テナント内 間接照明監視カメラ",
    locationName: "2階テナント内 壁面間接照明付近",
    floorLabel: "2F",
    capturedAt: "2026-05-21T13:35:00Z",
    frameIndex: 1,
    blobName:
      "aeon-mall-kanda/camera-tenant-2f-lighting/lighting-fixture-fall/demo/frame-0001.png",
    localFile: "tenant-lighting-fixture-fall.png",
    scenarioTags: ["lighting", "fixture-fall"],
    description: "2階テナント内の間接照明付近を撮影したフレーム",
  },
  {
    id: "frame_polisher_glass_0001",
    cameraId: "camera-food-area-cold-case",
    cameraName: "食品売場 冷ケース周辺監視カメラ",
    locationName: "食品売場 冷ケース前",
    floorLabel: "1F",
    capturedAt: "2026-05-21T15:10:00Z",
    frameIndex: 1,
    blobName:
      "aeon-mall-kanda/camera-food-area-cold-case/polisher-glass-damage/demo/frame-0001.png",
    localFile: "polisher-cold-case-glass-damage.png",
    scenarioTags: ["polisher", "glass-damage"],
    description: "食品売場の冷ケース付近を撮影したフレーム",
  },
] as const;

async function seed() {
  console.log("seeding frame assets...");

  const mockDir = join(process.cwd(), "public", "mock");

  for (const item of SEED_DATA) {
    const localPath = join(mockDir, item.localFile);
    const data = readFileSync(localPath);
    const contentType = "image/png";

    console.log(`  uploading ${item.blobName}...`);
    await uploadFile(CONTAINER, item.blobName, data, contentType);

    console.log(`  upserting frame_assets: ${item.id}...`);
    await upsertFrameAsset({
      id: item.id,
      videoAssetId: null,
      facilityId: FACILITY_ID,
      cameraId: item.cameraId,
      cameraName: item.cameraName,
      locationName: item.locationName,
      floorLabel: item.floorLabel,
      capturedAt: item.capturedAt,
      frameOffsetSeconds: null,
      frameIndex: item.frameIndex,
      blobContainer: CONTAINER,
      blobName: item.blobName,
      scenarioTags: [...item.scenarioTags],
      description: item.description,
    });

    console.log(`  ✓ ${item.id}`);
  }

  console.log("seed completed.");
  const pool = await getDbPool();
  pool.close();
}

seed().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});

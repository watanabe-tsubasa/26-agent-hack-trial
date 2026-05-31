import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { uploadFile } from "../lib/blob-storage";
import { upsertFrameAsset } from "../lib/agent/frame-asset-repository";
import { getDbPool } from "../lib/db";

const CONTAINER = "frames";
const FACILITY_ID = "kanda-office";
const CAMERA_ID = "camera-kanda-office-2f-open-space";
const CAMERA_NAME = "神田事務所 2階カメラ";
const LOCATION_NAME = "神田事務所 2階オープンスペース";
const FLOOR_LABEL = "2F";
const SCENARIO_TAGS = [
  "fall",
  "person-fall",
  "unable-to-stand",
  "assistance",
  "rescue",
  "office",
  "open-space",
  "kanda-office",
  "転倒",
  "起き上がれない",
  "救助",
  "事務所",
  "オープンスペース",
];
const FRAME_INTERVAL_SECONDS = 3;
const BASE_CAPTURED_AT = new Date("2026-05-28T09:00:00Z");

const FRAMES_DIR = join(process.cwd(), "public", "generated-frames", "kanda-office");

async function seed() {
  console.log(`seeding kanda-office frames from ${FRAMES_DIR}...`);

  let entries: string[];
  try {
    entries = readdirSync(FRAMES_DIR)
      .filter((f) => f.endsWith(".jpg"))
      .sort();
  } catch (err) {
    console.error(`directory not found. Run scripts/extract-kanda-office-frames.sh first.`);
    throw err;
  }

  if (entries.length === 0) {
    console.error("no frames found");
    process.exit(1);
  }

  console.log(`  ${entries.length} frames to upload`);

  let idx = 0;
  for (const filename of entries) {
    idx += 1;
    const localPath = join(FRAMES_DIR, filename);
    const data = readFileSync(localPath);

    const blobName = `kanda-office/${filename}`;
    const id = `frame_kanda_office_${String(idx).padStart(3, "0")}`;
    const capturedAt = new Date(
      BASE_CAPTURED_AT.getTime() + (idx - 1) * FRAME_INTERVAL_SECONDS * 1000
    ).toISOString();

    console.log(`  [${idx}/${entries.length}] uploading ${blobName}...`);
    await uploadFile(CONTAINER, blobName, data, "image/jpeg");

    await upsertFrameAsset({
      id,
      videoAssetId: null,
      facilityId: FACILITY_ID,
      cameraId: CAMERA_ID,
      cameraName: CAMERA_NAME,
      locationName: LOCATION_NAME,
      floorLabel: FLOOR_LABEL,
      capturedAt,
      frameOffsetSeconds: (idx - 1) * FRAME_INTERVAL_SECONDS,
      frameIndex: idx,
      blobContainer: CONTAINER,
      blobName,
      scenarioTags: [...SCENARIO_TAGS],
      description: `神田事務所動画から抽出 (フレーム ${idx})`,
    });
  }

  console.log("seed completed.");
  const pool = await getDbPool();
  pool.close();
}

seed().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});

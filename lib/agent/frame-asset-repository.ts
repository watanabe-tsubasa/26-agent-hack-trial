import { getDbPool, sql } from "../db";
import { getBlobUrl } from "../blob-storage";
import type { FrameAsset, Photo } from "../types";

type FrameAssetRow = {
  id: string;
  video_asset_id: string | null;
  facility_id: string;
  camera_id: string;
  camera_name: string;
  location_name: string;
  floor_label: string | null;
  captured_at: Date;
  frame_offset_seconds: number | null;
  frame_index: number | null;
  blob_container: string;
  blob_name: string;
  scenario_tags: string | null;
  description: string | null;
  created_at: Date;
};

function rowToFrameAsset(row: FrameAssetRow): FrameAsset {
  return {
    id: row.id,
    videoAssetId: row.video_asset_id,
    facilityId: row.facility_id,
    cameraId: row.camera_id,
    cameraName: row.camera_name,
    locationName: row.location_name,
    floorLabel: row.floor_label,
    capturedAt: row.captured_at.toISOString(),
    frameOffsetSeconds: row.frame_offset_seconds,
    frameIndex: row.frame_index,
    blobContainer: row.blob_container,
    blobName: row.blob_name,
    scenarioTags: row.scenario_tags ? JSON.parse(row.scenario_tags) : [],
    description: row.description,
    createdAt: row.created_at.toISOString(),
  };
}

function rowToPhoto(row: FrameAssetRow): Photo {
  const asset = rowToFrameAsset(row);
  return {
    id: asset.id,
    imageUrl: getBlobUrl(asset.blobContainer, asset.blobName),
    cameraName: asset.cameraName,
    capturedAt: asset.capturedAt,
    photoLocationName: asset.locationName,
    blobContainer: asset.blobContainer,
    blobName: asset.blobName,
  };
}

export async function searchFrameAssets(
  scenarioTag: string | null,
  facilityId: string
): Promise<Photo[]> {
  const pool = await getDbPool();
  const request = pool.request().input("facilityId", sql.NVarChar, facilityId);

  let where = "facility_id = @facilityId";
  if (scenarioTag) {
    request.input("tag", sql.NVarChar, `%${scenarioTag}%`);
    where += " and scenario_tags like @tag";
  }

  const result = await request.query<FrameAssetRow>(`
    select top 8 *
    from frame_assets
    where ${where}
    order by captured_at asc
  `);

  return result.recordset.map(rowToPhoto);
}

export async function upsertFrameAsset(asset: Omit<FrameAsset, "createdAt">): Promise<void> {
  const pool = await getDbPool();

  await pool
    .request()
    .input("id", sql.NVarChar, asset.id)
    .input("videoAssetId", sql.NVarChar, asset.videoAssetId ?? null)
    .input("facilityId", sql.NVarChar, asset.facilityId)
    .input("cameraId", sql.NVarChar, asset.cameraId)
    .input("cameraName", sql.NVarChar, asset.cameraName)
    .input("locationName", sql.NVarChar, asset.locationName)
    .input("floorLabel", sql.NVarChar, asset.floorLabel ?? null)
    .input("capturedAt", sql.DateTime2, new Date(asset.capturedAt))
    .input("frameOffsetSeconds", sql.Int, asset.frameOffsetSeconds ?? null)
    .input("frameIndex", sql.Int, asset.frameIndex ?? null)
    .input("blobContainer", sql.NVarChar, asset.blobContainer)
    .input("blobName", sql.NVarChar, asset.blobName)
    .input("scenarioTags", sql.NVarChar, JSON.stringify(asset.scenarioTags))
    .input("description", sql.NVarChar, asset.description ?? null)
    .query(`
      merge frame_assets as target
      using (select @id as id) as source on target.id = source.id
      when matched then
        update set
          camera_name = @cameraName,
          location_name = @locationName,
          blob_container = @blobContainer,
          blob_name = @blobName,
          scenario_tags = @scenarioTags,
          description = @description
      when not matched then
        insert (
          id, video_asset_id, facility_id, camera_id, camera_name,
          location_name, floor_label, captured_at, frame_offset_seconds,
          frame_index, blob_container, blob_name, scenario_tags, description
        ) values (
          @id, @videoAssetId, @facilityId, @cameraId, @cameraName,
          @locationName, @floorLabel, @capturedAt, @frameOffsetSeconds,
          @frameIndex, @blobContainer, @blobName, @scenarioTags, @description
        );
    `);
}

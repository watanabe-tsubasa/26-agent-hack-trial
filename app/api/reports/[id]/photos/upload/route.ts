import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getReportById } from "@/lib/reports/report-repository";
import { getCurrentSiteFromCookies } from "@/lib/auth/demo-auth";
import { getBlobUrl, uploadFile } from "@/lib/blob-storage";
import type { Photo } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const REPORT_PHOTOS_CONTAINER = "report-photos";
const MAX_BYTES = 10 * 1024 * 1024;

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest, { params }: Params) {
  const site = await getCurrentSiteFromCookies();
  if (!site) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await getReportById(id);
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  const contentType = file.type;
  const ext = CONTENT_TYPE_TO_EXT[contentType];
  if (!ext) {
    return Response.json(
      { error: "unsupported content type", contentType },
      { status: 415 }
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "file too large", maxBytes: MAX_BYTES },
      { status: 413 }
    );
  }

  const photoLocationName =
    (form.get("photoLocationName") as string | null)?.trim() || "現地写真";

  const uuid = randomUUID();
  const blobName = `${id}/${uuid}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(REPORT_PHOTOS_CONTAINER, blobName, buffer, contentType);

  const photo: Photo = {
    id: `photo_uploaded_${uuid}`,
    imageUrl: getBlobUrl(REPORT_PHOTOS_CONTAINER, blobName),
    cameraName: "現地アップロード",
    capturedAt: new Date().toISOString(),
    photoLocationName,
    sourceType: "uploaded_photo",
    selected: true,
    blobContainer: REPORT_PHOTOS_CONTAINER,
    blobName,
  };

  return Response.json(photo);
}

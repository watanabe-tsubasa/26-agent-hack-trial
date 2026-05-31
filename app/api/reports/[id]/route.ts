import { NextRequest } from "next/server";
import { getReportById, saveUserDraft } from "@/lib/reports/report-repository";
import { recordFeedbacks } from "@/lib/agent/diff";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const report = await getReportById(id);
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(report);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const updates = await request.json();

  const current = await getReportById(id);
  if (!current) return Response.json({ error: "Not found" }, { status: 404 });

  const newFeedbacks = recordFeedbacks(current, updates);
  const updatedPhotos = updates.photos
    ? mergePhotos(current.photos, updates.photos)
    : current.photos;

  const updated = {
    ...current,
    ...updates,
    photos: updatedPhotos,
    fiveWTwoH: updates.fiveWTwoH
      ? { ...current.fiveWTwoH, ...updates.fiveWTwoH }
      : current.fiveWTwoH,
    feedbacks: [...current.feedbacks, ...newFeedbacks],
    updatedAt: new Date().toISOString(),
  };

  await saveUserDraft(id, updated);
  return Response.json({ reportId: id, status: "updated", savedFeedback: true });
}

function mergePhotos(
  current: { id: string; [key: string]: unknown }[],
  patches: { id?: string; [key: string]: unknown }[]
) {
  return current.map((photo) => {
    const patch = patches.find((p) => p.id === photo.id);
    return patch ? { ...photo, ...patch } : photo;
  });
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { isSelectedPhoto, countSelectedPhotos } from "../photos/photo-selection";
import type { Photo } from "../types";

function makePhoto(partial: Partial<Photo> = {}): Photo {
  return {
    id: "p",
    imageUrl: "http://example.com/p.jpg",
    cameraName: "cam",
    capturedAt: "2026-05-26T15:20:00+09:00",
    photoLocationName: "loc",
    ...partial,
  };
}

test("selected=true は採用", () => {
  assert.equal(isSelectedPhoto(makePhoto({ selected: true })), true);
});

test("selected=false は除外", () => {
  assert.equal(isSelectedPhoto(makePhoto({ selected: false })), false);
});

test("selected=undefined は採用（既存写真互換）", () => {
  assert.equal(isSelectedPhoto(makePhoto({ selected: undefined })), true);
});

test("countSelectedPhotos は selected !== false の枚数を返す", () => {
  const photos = [
    makePhoto({ id: "a", selected: true }),
    makePhoto({ id: "b", selected: false }),
    makePhoto({ id: "c" }),
    makePhoto({ id: "d", selected: false }),
  ];
  assert.equal(countSelectedPhotos(photos), 2);
});

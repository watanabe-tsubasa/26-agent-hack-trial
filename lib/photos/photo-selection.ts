import type { Photo } from "../types";

export function isSelectedPhoto(photo: Photo): boolean {
  return photo.selected !== false;
}

export function countSelectedPhotos(photos: Photo[]): number {
  return photos.filter(isSelectedPhoto).length;
}

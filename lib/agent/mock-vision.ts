import type { Photo } from "../types";

const CEILING_OBSERVATION = `廊下の床面に天井ボードと思われる建材が複数散乱している。
天井面の一部に破損または開口が確認できる。
周辺に人の転倒や接触を示す明確な様子は確認できない。`;

const ESCALATOR_OBSERVATION = `エスカレーター側面のアクリルボードが落下し、周辺に散乱している。
エスカレーター本体の稼働状況は画像上では確認できない。
周辺に人の接触や転倒を示す明確な様子は確認できない。`;

const NO_IMAGE_OBSERVATION = `該当する画像は発見されませんでした。`;

export async function analyzeImagesMock(photos: Photo[]): Promise<string> {
  if (photos.length === 0) return NO_IMAGE_OBSERVATION;

  const firstUrl = photos[0].imageUrl;
  if (firstUrl.includes("ceiling")) return CEILING_OBSERVATION;
  if (firstUrl.includes("escalator")) return ESCALATOR_OBSERVATION;
  return NO_IMAGE_OBSERVATION;
}

import type { LandmarkKit } from './landmark-kit';

// 按两侧盘上关系压缩成折道；具体折数、尺度不是遗址实测复原。
export const HANYUAN_APPROACH = [
  [104, 77, -9.85],
  [104, 62, 0.4], [88, 62, 1.2], [88, 50, 2.2], [80, 50, 3.2],
  [80, 36, 4.2], [72, 36, 5.2], [72, 16, 6.25], [58, 16, 6.25],
] as const;

export function createHanyuanApproach(kit: LandmarkKit): void {
  const { block, batches, prototypes } = kit;
  // 两阙向外展开，给内侧盘道留出空间，不再把坡道埋在阁台里。
  for (const side of [-1, 1]) {
    const x = 520 + side * 122;
    block('stone', x, 13, -828, 48, 6, 40);
    batches.hall(prototypes.tower, x, -828, 34, 27, 1.18, 0, 16);
    // 向北折回的廊庑连接角部朵楼，再接主殿侧面；廊身落在连续基座上。
    block('stone', x, 13, -853, 9, 6, 50);
    batches.hall(prototypes.gable, x, -853, 36, 7, 0.52, Math.PI / 2, 16);
    const galleryX = 520 + side * 89;
    block('stone', galleryX, 13, -872, 66, 6, 9);
    batches.hall(prototypes.gable, galleryX, -872, 57, 6, 0.52, 0, 16);
    batches.hall(prototypes.tower, 520 + side * 100, -872,
      20, 15, 0.92, 0, 16);

    for (let i = 0; i < HANYUAN_APPROACH.length - 1; i++) {
      const [ax, az, ah] = HANYUAN_APPROACH[i];
      const [bx, bz, bh] = HANYUAN_APPROACH[i + 1];
      const length = Math.hypot(bx - ax, bz - az);
      const count = Math.ceil(length / 1.4);
      const alongX = az === bz;
      for (let step = 0; step < count; step++) {
        const t = (step + 0.5) / count;
        const h = ah + (bh - ah) * ((step + 1) / count);
        const px = 520 + side * (ax + (bx - ax) * t);
        const pz = -860 + az + (bz - az) * t;
        // 前半从低庭起步，台阶落地，进入台地后才改由台地承托。
        const base = pz <= -811 ? 10 : 0;
        const top = 10 + h;
        block('stone', px, (top + base) / 2, pz,
          alongX ? length / count + 0.02 : 5,
          top - base, alongX ? 5 : length / count + 0.02);
      }
      // 折点外侧少量栏柱表明边界，不沿每级台阶堆高精石雕。
      block('stone', 520 + side * ax, 10 + ah + 0.55, -860 + az + 2.7,
        0.45, 1.1, 0.45);
    }
  }
}

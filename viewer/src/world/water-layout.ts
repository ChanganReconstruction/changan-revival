// 曲江由两湾、收窄水口和北岸半岛组成；几何和植被共用同一条岸线。
export const QUJIANG_OUTLINE: readonly [number, number][] = [
  [-96, -66], [-65, -80], [-28, -72], [-10, -57], [16, -65], [56, -70],
  [88, -50], [100, -24], [87, -5], [70, 3], [68, 20], [83, 38],
  [72, 60], [45, 75], [14, 72], [-9, 56], [-19, 39], [-32, 25],
  [-55, 21], [-81, 29], [-103, 19], [-110, -4], [-96, -17],
  [-73, -18], [-55, -29], [-56, -47], [-78, -53],
];

export function nearQujiang(x: number, z: number): boolean {
  const px = x - 689, pz = z - 593;
  let inside = false, distance = Infinity;
  for (let i = 0, j = QUJIANG_OUTLINE.length - 1; i < QUJIANG_OUTLINE.length; j = i++) {
    const [ax, az] = QUJIANG_OUTLINE[j], [bx, bz] = QUJIANG_OUTLINE[i];
    if ((az > pz) !== (bz > pz) && px < (bx - ax) * (pz - az) / (bz - az) + ax) {
      inside = !inside;
    }
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (pz - az) * (bz - az))
      / ((bx - ax) ** 2 + (bz - az) ** 2)));
    distance = Math.min(distance, Math.hypot(px - ax - t * (bx - ax), pz - az - t * (bz - az)));
  }
  // 10米缓冲大于平滑曲线相对手工折线的偏移，树冠与岸坡也不侵水。
  return inside || distance < 10;
}

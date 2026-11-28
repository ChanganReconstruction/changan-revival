import { districtFor } from './districts.ts';
import type { Ward } from './layout.ts';
import { planWard } from './ward-composition.ts';

export interface GroundPatch {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export function planWardGround(ward: Ward): GroundPatch[] {
  const profile = districtFor(ward);
  if (profile.southwest || profile.family === 'garden' || profile.family === 'market'
    || ['E4-9', 'E1-3'].includes(ward.id)) return [];
  const plan = planWard(ward);
  const reserved = [...plan.houses, ...plan.roads, ...plan.courtyards,
    ...plan.publicSquares, ...plan.keepouts, ...plan.greenplots];
  const intersects = (patch: GroundPatch, other: GroundPatch) =>
    Math.abs(patch.x - other.x) < (patch.width + other.width) / 2 + 1
    && Math.abs(patch.z - other.z) < (patch.depth + other.depth) / 2 + 1;
  const columns = 8, rows = 7;
  const width = (ward.width - 12) / columns;
  const depth = (ward.depth - 12) / rows;
  const patches: GroundPatch[] = [];
  const formal = ['temple', 'manor', 'office'].includes(profile.family);
  // 优先保留墙边、后院和社树周边的连续绿地，居住与商业区不强行塞满草坪。
  for (let row = 0; row < rows; row++) {
    let start = -1;
    for (let col = 0; col <= columns; col++) {
      const x = ward.x - (ward.width - 12) / 2 + width * (col + 0.5);
      const z = ward.z - (ward.depth - 12) / 2 + depth * (row + 0.5);
      const cell = { x, z, width, depth };
      const byTree = plan.trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 12);
      const alongWall = col === 0 || col === columns - 1 || row === 0;
      const eligible = col < columns && (formal ? alongWall || byTree : byTree)
        && reserved.every((area) => !intersects(cell, area));
      if (eligible && start < 0) start = col;
      if (!eligible && start >= 0) {
        patches.push({ x: ward.x - (ward.width - 12) / 2 + width * (start + col) / 2,
          z, width: width * (col - start), depth });
        start = -1;
      }
    }
  }
  return patches;
}

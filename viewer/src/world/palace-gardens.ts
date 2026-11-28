import { IcosahedronGeometry } from 'three';
import type { LandmarkKit } from './landmark-kit';
import { ribbonGeometry } from './terrain.ts';

const shrub = new IcosahedronGeometry(1, 1);

export function gardenWalk(kit: LandmarkKit, points: readonly [number, number][],
  width: number, height: number): void {
  kit.batches.add(ribbonGeometry(points, width, () => height),
    'paving', 0, 0, 0, 1, 1, 1, 0, '#d8d4c2');
}

export function gardenGroup(kit: LandmarkKit, x: number, z: number,
  y: number, size: number, angle = 0): void {
  kit.tree(x, z, size, y);
  for (const [offset, length, width, height, color] of [
    [0, 4.1, 1.65, 0.9, '#a0ac7a'], [1.8, 4.6, 1.5, 0.68, '#8e9f74'],
    [3.3, 3.1, 1.7, 0.65, '#b2b78d'],
  ] as const) {
    const a = angle + offset;
    kit.batches.add(shrub, 'grass', x + Math.cos(a) * size * length, y + height * size * 0.7,
      z + Math.sin(a) * size * length, width * size, height * size, width * size, a, color);
  }
}

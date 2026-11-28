import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BufferGeometry } from 'three';
import { createLindeComplex } from '../src/world/linde-complex.ts';
import type { LandmarkKit } from '../src/world/landmark-kit.ts';

test('麟德殿三殿、四侧楼亭与南向回廊有实体支撑', () => {
  const blocks: Parameters<LandmarkKit['block']>[] = [];
  const adds: Array<{ shape: BufferGeometry; material: string; x: number;
    y: number; z: number; sx: number; sy: number; sz: number; rotation: number }> = [];
  const kit = {
    prototypes: { gable: [], hip: [], hipgable: [], pavilion: [], tower: [] },
    batches: {
      add: (shape: BufferGeometry, material: string, x: number, y: number,
        z: number, sx = 1, sy = 1, sz = 1, rotation = 0) => {
        adds.push({ shape, material, x, y, z, sx, sy, sz, rotation });
      },
    },
    block: (...args: Parameters<LandmarkKit['block']>) => blocks.push(args),
    tree: () => undefined, perimeter: () => undefined, pond: () => undefined,
  } as unknown as LandmarkKit;
  createLindeComplex(kit, 402, -970, 10.4);

  const roofs = adds.filter((part) => part.material === 'roof');
  assert.equal(roofs.length, 13, '三殿、四楼亭、两南廊、两侧廊和两轴线连廊');
  assert.equal(new Set(roofs.map((part) => part.shape)).size, 1, '所有屋盖复用几何');
  assert.ok(roofs.every((part) => part.shape.getAttribute('uv')));
  const halls = roofs.slice(0, 3);
  assert.deepEqual(halls.map(({ z }) => z), [-1012, -970, -924],
    '后殿在北，中殿居中，前殿向南');
  assert.ok(halls[0].sx > halls[1].sx, '后殿主体相对更宽');
  assert.ok(halls[2].z > halls[1].z + 17, '前殿与中殿之间保留中庭');
  assert.equal(new Set(halls.map(({ sx, sz, sy }) =>
    [sx, sz, sy].join(','))).size, 3, '三殿屋盖轮廓有别');
  const hallRoofY = halls.map((part) => part.y);
  assert.ok(hallRoofY.every((y) => y === hallRoofY[0]), '三殿檐口共高');
  const hallPeaks = halls.map((part) => part.y + 3.5 * part.sy);
  assert.ok(hallPeaks[1] > hallPeaks[0] && hallPeaks[1] > hallPeaks[2],
    '中殿屋脊最高');
  const sideBuildings = roofs.slice(3, 7);
  assert.deepEqual(sideBuildings.map(({ x, z }) => [x, z]), [
    [362, -970], [442, -970], [362, -1012], [442, -1012],
  ], '中殿两亭、后殿两楼各自独立');

  const longGalleries = roofs.slice(7, 9);
  assert.ok(longGalleries.every((part) => Math.abs(part.rotation) > 1),
    '后楼廊顶沿南北向延伸');
  assert.deepEqual(longGalleries.map(({ x }) => x), [362, 442]);
  for (const gx of [362, 442]) {
    assert.ok(blocks.some(([m, x, , z, w, , d]) => m === 'stone'
      && Math.abs(x - gx) < 0.01 && z < -980 && w >= 5 && d >= 20),
    '南向廊台基连续承地');
    assert.ok(blocks.filter(([m, x, , z]) => m === 'vermilion'
      && Math.abs(x - gx) < 3 && z < -980 && z > -1005).length >= 5,
    '廊柱实体支撑');
  }
  const extents = halls.map(({ x, z, sx, sz }) => ({
    minX: x - 10 * sx, maxX: x + 10 * sx,
    minZ: z - 6.5 * sz, maxZ: z + 6.5 * sz,
  }));
  assert.ok(Math.min(...extents.map((e) => e.minX)) >= 350);
  assert.ok(Math.max(...extents.map((e) => e.maxX)) <= 454);
  assert.ok(Math.min(...extents.map((e) => e.minZ)) >= -1032);
  assert.ok(Math.max(...extents.map((e) => e.maxZ)) <= -908);

  const windows = blocks.filter(([m]) => m === 'dark');
  assert.equal(windows.length, 66, '三殿两侧门窗常驻');
  for (const [, wx, wy, wz] of windows) {
    assert.ok(!blocks.some(([material, x, y, z, w, h, d]) =>
      (material === 'wall' || material === 'wood')
      && Math.abs(wx - x) < w / 2 && Math.abs(wy - y) < h / 2
      && Math.abs(wz - z) < d / 2), '常驻窗面不能再次藏在实心墙里');
  }
  assert.ok(sideBuildings[2].y > sideBuildings[0].y, '后楼高于中部开敞亭');
  for (const [, wx, , wz] of windows) {
    const hall = Math.abs(wz + 1012) < 20 ? { z: -1012, w: 68 }
      : Math.abs(wz + 970) < 20 ? { z: -970, w: 56 }
        : { z: -924, w: 54 };
    assert.ok(Math.abs(wx - 402) < hall.w / 2 - 2,
      '门窗位于墙面内并留出边柱间距');
  }
  const blockTris = blocks.length * 12;
  const roofTris = roofs.reduce((sum, part) =>
    sum + part.shape.getAttribute('position').count / 3, 0);
  assert.ok(blockTris + roofTris < 6000, '总几何预算低于6000三角面');
});

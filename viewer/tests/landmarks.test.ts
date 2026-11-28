import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BufferGeometry } from 'three';
import { createPalaces } from '../src/world/palaces.ts';
import type { LandmarkKit } from '../src/world/landmark-kit.ts';
import { createLakeGeometry, createShoreGeometry, createIslandGeometry,
  TAIYE_OUTLINE, LONGCHI_OUTLINE, sampleOutline } from '../src/world/waterscape.ts';
import { hanyuanPrototype, HANYUAN_LAYOUT } from '../src/world/royal-architecture.ts';
import { HANYUAN_APPROACH } from '../src/world/palace-approach.ts';
import { terrainHeight, ribbonGeometry } from '../src/world/terrain.ts';
import { CITY, DAMING_SHIFT_Z } from '../src/world/layout.ts';
import { DANFENG_LAYOUT } from '../src/world/danfeng-gate.ts';

function recordPalaces() {
  const blocks: Parameters<LandmarkKit['block']>[] = [];
  const geometry: Array<{ shape: BufferGeometry; material: string; x: number;
    y: number; z: number }> = [];
  const ponds: Parameters<LandmarkKit['pond']>[] = [];
  const perimeters: Parameters<LandmarkKit['perimeter']>[] = [];
  const trees: Parameters<LandmarkKit['tree']>[] = [];
  // 记录组合指令，不依赖 WebGL；曲岸几何也必须进入断言，不能跳过验证。
  const kit = {
    prototypes: { gable: [], hip: [], hipgable: [], pavilion: [], tower: [] },
    batches: { hall: () => undefined,
      add: (shape: BufferGeometry, material: string, x: number, y: number, z: number) =>
        geometry.push({ shape, material, x, y, z }) },
    block: (...args: Parameters<LandmarkKit['block']>) => { blocks.push(args); },
    pond: (...args: Parameters<LandmarkKit['pond']>) => { ponds.push(args); },
    tree: (...args: Parameters<LandmarkKit['tree']>) => trees.push(args),
    perimeter: (...args: Parameters<LandmarkKit['perimeter']>) => perimeters.push(args),
  } as unknown as LandmarkKit;
  createPalaces(kit);
  return { blocks, ponds, geometry, perimeters, trees };
}

test('太液池后苑与龙池园路分处不同标高，路径与池岸树干不落入两池', () => {
  const { geometry, trees } = recordPalaces();
  const walks = geometry.filter(({ material }) => material === 'paving');
  assert.equal(walks.filter(({ z }) => z === DAMING_SHIFT_Z).length, 2);
  assert.equal(walks.filter(({ z }) => z === 0).length, 2);
  for (const [cx, cz, outline] of [
    [626, -1090 + DAMING_SHIFT_Z, TAIYE_OUTLINE],
    [750, -155, LONGCHI_OUTLINE],
  ] as const) {
    const ring = sampleOutline(outline);
    const inside = (worldX: number, worldZ: number) => {
      const x = worldX - cx;
      const z = worldZ - cz;
      return ring.reduce((hit, [ax, az], i) => {
        const [bx, bz] = ring[(i + 1) % ring.length];
        return (az > z) !== (bz > z) && x < ax + (bx - ax) * (z - az) / (bz - az) ? !hit : hit;
      }, false);
    };
    for (const { shape, x, z } of walks) {
      const points = shape.getAttribute('position');
      for (let i = 0; i < points.count; i++) {
        assert.ok(!inside(x + points.getX(i), z + points.getZ(i)), '园路进入池内');
      }
    }
    for (const [x, z] of trees) {
      // 蓬莱山是太液池中刻意留设的岛上植栽。
      if (cx === 626 && Math.abs(x - 628) <= 12 && Math.abs(z - cz) <= 12) continue;
      assert.ok(!inside(x, z), `树干 ${x},${z} 落入池内`);
    }
  }
});

test('两处宫苑用独立曲岸水面，池水不被完整地基盖住', () => {
  const { blocks, ponds, geometry } = recordPalaces();
  assert.equal(ponds.length, 0, '不得退回椭圆盘池塘');
  const allWater = geometry.filter((part) => part.material === 'water');
  assert.equal(allWater.length, 3, '两池外新增一段龙首西支，不把水道当第三座池');
  const water = allWater.filter((part) => part.shape.userData.channel !== 'longshou');
  assert.equal(water.length, 2);
  assert.equal(geometry.filter((part) => part.material === 'earth').length, 4);
  for (const { x, y, z, shape } of water) {
    assert.ok(shape.getAttribute('position').count >= 100, '岸线需要曲线细分');
    const px = x > 700 ? x : x - 26;
    for (const [material, bx, by, bz, w, h, d] of blocks) {
      const covers = Math.abs(px - bx) < w / 2 && Math.abs(z - bz) < d / 2;
      if (covers) assert.ok(by + h / 2 < y, `${material} 地基挡住池面`);
    }
  }
  assert.ok(blocks.some(([material, x, y, z, w, h, d]) => material === 'earth'
    && Math.abs(600 - x) < w / 2 && Math.abs(-1147 + DAMING_SHIFT_Z - z) < d / 2 && y + h / 2 >= 10));
});

test('丹凤门五条门道地面不被高台或实心门楼封堵', () => {
  const { blocks, perimeters } = recordPalaces();
  assert.equal(DANFENG_LAYOUT.z, CITY.north);
  assert.ok(perimeters.some(([x, z, , depth, , , floor, gate]) =>
    x === DANFENG_LAYOUT.x && z + depth / 2 === CITY.north && floor === 0 && gate === 108),
  '南宫墙须与外郭北垣共线，从地面围合并为五门道整体让位');
  for (const px of [480, 500, 520, 540, 560]) {
    for (const [material, x, y, z, w, h, d] of blocks) {
      const inside = Math.abs(px - x) < w / 2 && Math.abs(DANFENG_LAYOUT.z - z) < d / 2
        && 3 > y - h / 2 && 3 < y + h / 2;
      assert.equal(inside, false, `${material} 封堵了 ${px} 门道`);
    }
  }
});

test('湖面与岸坡采用同向坐标、同密度采样，水面及岛顶法线朝上', () => {
  for (const outline of [TAIYE_OUTLINE, LONGCHI_OUTLINE]) {
    const lake = createLakeGeometry(outline).rotateX(-Math.PI / 2);
    const points = sampleOutline(outline);
    const outer = outline.map(([x, z]) => [x * 1.1, z * 1.1] as [number, number]);
    const shore = createShoreGeometry(outline, outer);
    assert.ok(shore.getAttribute('uv'));
    lake.computeBoundingBox();
    assert.ok(Math.abs(lake.boundingBox!.min.z - Math.min(...points.map((p) => p[1]))) < 0.01);
    const normals = lake.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) assert.ok(normals.getY(i) > 0.99);
  }
  const island = createIslandGeometry();
  const position = island.getAttribute('position'), normal = island.getAttribute('normal');
  let upward = 0;
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getY(i) - 5.4) < 0.001 && normal.getY(i) > 0.99) upward++;
  }
  assert.ok(upward >= 14, '岛顶要有可见实体面');
});

test('含元主体十一间进深四间，与周匝十三间副阶分别构造', () => {
  assert.equal(HANYUAN_LAYOUT.coreX.length - 1, 11);
  assert.equal(HANYUAN_LAYOUT.depthBays, 4);
  assert.equal(HANYUAN_LAYOUT.outerX.length - 1, 13);
  assert.equal(HANYUAN_LAYOUT.outerZ.length - 1, 6);
  const parts = hanyuanPrototype();
  for (const key of ['dark', 'wall', 'vermilion']) {
    assert.ok(parts.some((part) => part.material === key && !part.detail));
  }
  const roofs = parts.filter((part) => part.material === 'roof' && !part.tint);
  assert.equal(roofs.length, 2, '下檐是环形挑檐，不是第二座完整屋顶');
  for (const part of roofs) {
    const normals = part.geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) assert.ok(normals.getY(i) > 0);
  }
  const tris = parts.reduce((sum, { geometry }) => sum
    + (geometry.index?.count ?? geometry.getAttribute('position').count) / 3, 0);
  assert.ok(tris < 6000, '重点殿堂允许独立柱网，但仍限制几何预算');
});

test('含元保留两侧盘道，不再混用早期正南三条直阶', () => {
  const { blocks } = recordPalaces();
  assert.ok(HANYUAN_APPROACH.every(([x]) => x >= 58), '盘道位于中轴两侧');
  for (let i = 1; i < HANYUAN_APPROACH.length; i++) {
    assert.ok(HANYUAN_APPROACH[i][2] >= HANYUAN_APPROACH[i - 1][2]);
  }
  for (const x of [500, 520, 540]) {
    for (const z of [-775, -780, -790, -801]) {
      assert.ok(terrainHeight(x, z + DAMING_SHIFT_Z) < 0.2, '门内前庭保持低平');
      assert.ok(!blocks.some(([, bx, y, bz, w, h, d]) => y + h / 2 > 0.3 && y - h / 2 < 1
        && Math.abs(x - bx) < w / 2 && Math.abs(z + DAMING_SHIFT_Z - bz) < d / 2),
      '前导空间不再有任何横贯主轴的提前登台');
    }
  }
});

test('原坡标高连续，道路沿坡且法线朝上', () => {
  assert.ok(terrainHeight(620, 315) > 8);
  assert.equal(terrainHeight(0, 630), 0);
  const road = ribbonGeometry([[0, 0], [30, 0], [60, 0]], 10, (x) => x * 0.02);
  const position = road.getAttribute('position'), normal = road.getAttribute('normal');
  assert.equal(position.count, 12);
  for (let i = 0; i < position.count; i++) {
    assert.ok(Math.abs(position.getY(i) - position.getX(i) * 0.02) < 0.00001);
    assert.ok(normal.getY(i) > 0.99);
  }
});

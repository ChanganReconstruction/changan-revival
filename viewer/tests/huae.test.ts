import assert from 'node:assert/strict';
import test from 'node:test';
import { createHuaeComplex, huaePrototype, HUAE_LAYOUT } from '../src/world/huae-complex.ts';
import { LONGCHI_OUTLINE, sampleOutline } from '../src/world/waterscape.ts';
import type { LandmarkKit } from '../src/world/landmark-kit.ts';

function inside(x: number, z: number, outline: [number, number][]): boolean {
  let result = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i], b = outline[j];
    if ((a[1] > z) !== (b[1] > z)
      && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

test('花萼为两层长翼与偏置三层主楼，使用六个常驻材质构件', () => {
  const parts = huaePrototype();
  assert.equal(parts.length, 6);
  assert.ok(parts.every((part) => !part.detail));
  const levels = HUAE_LAYOUT.levels;
  assert.equal(levels.length, 3);
  assert.equal(levels[0].width, levels[1].width);
  assert.ok(levels[2].x > 0 && levels[2].width < levels[1].width / 2);
  let triangles = 0;
  for (const part of parts) {
    const positions = part.geometry.getAttribute('position');
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    assert.ok(part.geometry.getAttribute('uv'));
    triangles += positions.count / 3;
    part.geometry.computeBoundingBox();
    assert.ok(part.geometry.boundingBox!.min.y >= -0.001);
  }
  const roof = parts[4].geometry;
  assert.ok(Array.from(roof.getAttribute('normal').array)
    .filter((_, i) => i % 3 === 1).every((y) => y > 0));
  assert.ok(triangles < 6500, `专属构件预算：${triangles}`);
  for (const part of parts) part.geometry.dispose();
});

test('花萼檐圈不截断上一层墙身，窗中心均在素壁外', () => {
  const parts = huaePrototype();
  const roof = parts[4].geometry.getAttribute('position');
  for (let i = 0; i < roof.count; i += 3) {
    const x = (roof.getX(i) + roof.getX(i + 1) + roof.getX(i + 2)) / 3;
    const y = (roof.getY(i) + roof.getY(i + 1) + roof.getY(i + 2)) / 3;
    const z = (roof.getZ(i) + roof.getZ(i + 1) + roof.getZ(i + 2)) / 3;
    for (const level of HUAE_LAYOUT.levels.slice(1)) {
      const wx = level.width / 2 - 0.7, wz = level.depth / 2 - 2.2;
      assert.ok(!(y > level.base + 0.01 && y < level.eave - 0.01
        && Math.abs(x - level.x) < wx && Math.abs(z) < wz), '屋盖不得穿入上层墙身');
    }
  }
  const windows = parts[2].geometry.getAttribute('position');
  // 每个合并窗片是十二个三角面的盒子；中心不能被任一层素壁吞掉。
  for (let i = 0; i < windows.count; i += 36) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 36; k++) {
      x += windows.getX(i + k) / 36;
      y += windows.getY(i + k) / 36;
      z += windows.getZ(i + k) / 36;
    }
    for (const level of HUAE_LAYOUT.levels) {
      if (y < level.base || y > level.eave) continue;
      const wx = level.width / 2 - 0.7, wz = level.depth / 2 - 2.2;
      const onFront = Math.abs(Math.abs(z) - wz) < 0.125 && Math.abs(x - level.x) < wx;
      const onSide = Math.abs(Math.abs(x - level.x) - wx) < 0.125 && Math.abs(z) < wz;
      assert.ok(!onFront && !onSide, '常驻窗中心不能落在墙体内');
    }
  }
  const wood = parts[3].geometry.getAttribute('position');
  for (const level of HUAE_LAYOUT.levels) {
    for (let i = 0; i < wood.count; i++) {
      const y = wood.getY(i);
      if (y < level.base - 0.001 || y > level.base + 1.2) continue;
      assert.ok(Math.abs(wood.getZ(i)) <= level.depth / 2 + 0.01,
        '栏柱须落在楼板上，不能摆到屋檐外悬空');
    }
  }
  for (const part of parts) part.geometry.dispose();
});

test('花萼位于龙池西南岸，基础和屋体不跨水，原型仅提交共享批次', () => {
  const blocks: Parameters<LandmarkKit['block']>[] = [];
  const shapes: unknown[] = [];
  createHuaeComplex({
    block: (...args: Parameters<LandmarkKit['block']>) => blocks.push(args),
    batches: { add: (...args: unknown[]) => shapes.push(args) },
  } as unknown as LandmarkKit);
  assert.equal(shapes.length, 6);
  assert.ok(HUAE_LAYOUT.x < 750 && HUAE_LAYOUT.z > -155);
  const shore = sampleOutline(LONGCHI_OUTLINE).map(([x, z]): [number, number] =>
    [750 + x, -155 + z]);
  for (const [, x, , z, width, , depth] of blocks) {
    for (let dx = -width / 2; dx <= width / 2; dx += 2) {
      for (let dz = -depth / 2; dz <= depth / 2; dz += 2) {
        assert.ok(!inside(x + dx, z + dz, shore), '基础不得盖住龙池水面');
      }
    }
  }
});

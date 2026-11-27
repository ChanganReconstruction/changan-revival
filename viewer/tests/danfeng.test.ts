import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BufferGeometry } from 'three';
import { createDanfengGate, danfengTowerPrototype, DANFENG_LAYOUT }
  from '../src/world/danfeng-gate.ts';
import type { LandmarkKit } from '../src/world/landmark-kit.ts';

test('丹凤门六实体墩留出五条全深贯通的门道', () => {
  const blocks: Parameters<LandmarkKit['block']>[] = [];
  const kit = {
    block: (...args: Parameters<LandmarkKit['block']>) => blocks.push(args),
    batches: { add: () => undefined },
  } as unknown as LandmarkKit;
  createDanfengGate(kit);
  const plan = DANFENG_LAYOUT;
  assert.equal(plan.doorCenters.length, 5);
  assert.equal(plan.pierCenters.length, 6);
  const width = plan.pierCenters.at(-1)! - plan.pierCenters[0] + plan.pierWidth;
  assert.ok(Math.abs(width / plan.depth - plan.sourceBaseWidth / plan.sourceBaseDepth) < 0.02);
  for (const dx of plan.doorCenters) {
    for (const dz of [-23, -12, 0, 12, 23]) {
      for (const height of [1, 3, 7, 11.5]) {
        for (const [material, x, y, z, w, h, d] of blocks) {
          const inside = Math.abs(plan.x + dx - x) < w / 2
            && Math.abs(plan.z + dz - z) < d / 2
            && height > y - h / 2 && height < y + h / 2;
          assert.ok(!inside, `${material} 不能堵门道 ${dx}/${dz}/${height}`);
        }
      }
    }
  }
});

test('丹凤门专属檐廊与门窗常驻，屋盖不使用住宅五间原型', () => {
  const parts = danfengTowerPrototype();
  assert.equal(parts.length, 7);
  assert.ok(parts.every((part) => !part.detail));
  const roofParts = parts.filter((part) => part.material === 'roof' && !part.tint);
  assert.equal(roofParts.length, 2);
  for (const { geometry } of roofParts) {
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    assert.ok(geometry.getAttribute('uv'));
    for (let i = 0; i < positions.count; i++) {
      assert.ok(Number.isFinite(positions.getY(i)));
      assert.ok(normals.getY(i) > 0);
    }
  }
  const wall = parts.find((part) => part.material === 'wall')!.geometry;
  const windows = parts.find((part) => part.material === 'dark')!.geometry;
  assert.equal(windows.getAttribute('position').count / 36, 28);
  // 每个合并前盒体仍占36顶点，用包围盒检测窗面不能藏在墙内。
  function bounds(shape: BufferGeometry) {
    const p = shape.getAttribute('position');
    const boxes = [];
    for (let start = 0; start < p.count; start += 36) {
      const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
      for (let i = start; i < start + 36; i++) {
        [p.getX(i), p.getY(i), p.getZ(i)].forEach((value, axis) => {
          low[axis] = Math.min(low[axis], value);
          high[axis] = Math.max(high[axis], value);
        });
      }
      boxes.push({ low, high });
    }
    return boxes;
  }
  const walls = bounds(wall);
  for (const opening of bounds(windows)) {
    const center = opening.low.map((low, i) => (low + opening.high[i]) / 2);
    assert.ok(!walls.some(({ low, high }) =>
      center.every((value, i) => value > low[i] && value < high[i])));
  }
  const triangles = parts.reduce((sum, { geometry }) => sum
    + (geometry.index?.count ?? geometry.getAttribute('position').count) / 3, 0);
  assert.ok(triangles < 3000);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createMingdeGate, mingdeDoorCenters, mingdePrototype,
  MINGDE_LAYOUT } from '../src/world/mingde-gate.ts';
import { pagodaLevels, pagodaPrototype, PAGODAS } from '../src/world/temple-pagodas.ts';
import type { LandmarkKit } from '../src/world/landmark-kit.ts';

function checkGeometry(parts: ReturnType<typeof mingdePrototype>, budget: number) {
  let triangles = 0;
  for (const part of parts) {
    const positions = part.geometry.getAttribute('position');
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    assert.ok(part.geometry.getAttribute('normal'));
    assert.ok(part.geometry.getAttribute('uv'));
    assert.ok(!part.detail, '地标轮廓及开口保持常驻');
    triangles += (part.geometry.index?.count ?? positions.count) / 3;
  }
  assert.ok(triangles < budget, `共享构件预算：${triangles}`);
}

test('明德门五条门道全深贯通，不用三柱隔出四孔', () => {
  const blocks: number[][] = [];
  const parts: ReturnType<typeof mingdePrototype> = [];
  const kit = {
    block: (_: string, ...values: number[]) => blocks.push(values),
    batches: { add: (geometry: THREE.BufferGeometry, material: string) => {
      parts.push({ geometry, material: material as 'roof' });
    } },
  } as unknown as LandmarkKit;
  createMingdeGate(kit);
  assert.equal(mingdeDoorCenters().length, 5);
  for (const x of mingdeDoorCenters()) {
    for (const dx of [-2.4, 0, 2.4]) {
      for (const z of [702, 710, 718]) {
        for (const y of [0.5, 4, 7.8]) {
          assert.ok(!blocks.some(([bx, by, bz, w, h, d]) =>
            Math.abs(x + dx - bx) < w / 2 && Math.abs(y - by) < h / 2
            && Math.abs(z - bz) < d / 2), '实际构件不得堵住门道');
        }
      }
    }
  }
  assert.equal(MINGDE_LAYOUT.width / MINGDE_LAYOUT.depth, 55.5 / 17.5);
  checkGeometry(parts, 2000);
  for (const part of parts) part.geometry.dispose();
});

test('两塔区分七层楼阁与十五层密檐，首层不按等高方盒重复', () => {
  const big = pagodaLevels('dayan'), small = pagodaLevels('xiaoyan');
  assert.equal(big.length, 7);
  assert.equal(small.length, 15);
  assert.ok(small[0].height > small[1].height * 3);
  assert.ok(small[1].height > small.at(-1)!.height);
  for (const [kind, levels] of [['dayan', big], ['xiaoyan', small]] as const) {
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      assert.ok(level.top < level.bottom && level.height > 0);
      if (i > 0) {
        assert.ok(Math.abs(level.y - levels[i - 1].y - levels[i - 1].height) < 0.00001);
        assert.equal(level.bottom, levels[i - 1].top);
      }
    }
    assert.ok(Math.abs(levels.at(-1)!.y + levels.at(-1)!.height
      - 1 - PAGODAS[kind].height) < 0.00001);
  }
});

test('砖塔三组共享几何，窗片沿收分墙面外置且不套住宅瓦檐', () => {
  for (const kind of ['dayan', 'xiaoyan'] as const) {
    const parts = pagodaPrototype(kind);
    assert.equal(parts.length, 3);
    assert.ok(!parts.some((part) => part.material === 'roof'));
    checkGeometry(parts, 3000);
    const openings = parts[2].geometry.getAttribute('position');
    const levels = pagodaLevels(kind);
    assert.equal(openings.count / 6, levels.length * (kind === 'dayan' ? 4 : 2));
    assert.ok(Math.abs(Math.min(...Array.from({ length: openings.count },
      (_, i) => openings.getY(i))) - 1) < 0.00001, '首层券门落到台面');
    for (let i = 0; i < openings.count; i++) {
      const y = openings.getY(i);
      const level = levels.find((l) => y >= l.y && y <= l.y + l.height)!;
      const half = THREE.MathUtils.lerp(level.bottom, level.top,
        (y - level.y) / level.height) / 2;
      assert.ok(Math.max(Math.abs(openings.getX(i)), Math.abs(openings.getZ(i))) > half);
    }
    for (const part of parts) part.geometry.dispose();
  }
});

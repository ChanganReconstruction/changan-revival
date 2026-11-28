import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hallPrototype, towerPrototype } from '../src/world/architecture.ts';
import { elevationForAppearance, proportionPrototype, sampleRoofTint, districtAppearance }
  from '../src/world/appearance.ts';
import { makeWards } from '../src/world/layout.ts';
import { buildWardInterior, planWard } from '../src/world/ward-composition.ts';
import type { PrototypePart } from '../src/world/architecture.ts';

test('背景只提交简体，重点坊仍保留近景构件，实例色不复制几何', () => {
  const source = hallPrototype('gable');
  const calls: PrototypePart[][] = [];
  const kit = {
    prototypes: { gable: source, hip: source, hipgable: source, tower: source, pavilion: source },
    batches: { hall: (parts: PrototypePart[]) => calls.push(parts) },
    block: () => undefined, tree: () => undefined,
  };
  const wards = makeWards();
  buildWardInterior(kit as never, wards.find((ward) => ward.id === 'W3-9')!);
  assert.ok(calls.length > 10);
  assert.ok(calls.every((parts) => parts.every((part) => !part.detail)));
  assert.ok(calls.every((parts) => parts.some((part) => part.material === 'facade')));
  assert.equal(new Set(calls.map((parts) => parts[0].geometry)).size, 1);
  calls.length = 0;
  buildWardInterior(kit as never, wards.find((ward) => ward.id === 'E3-2')!);
  assert.ok(calls.some((parts) => parts.some((part) => part.detail)));
  const plans = wards.filter((ward) => ward.id !== 'E1-7').map(planWard);
  const small = plans.flatMap((plan) => plan.houses).filter((house) => house.height < 1.15);
  assert.ok(small.filter((house) => house.height >= 0.78).length > small.length * 0.85);
});

test('屋盖坡度与墙柱高度解耦，两档坡度仍复用墙身和立面', () => {
  const source = hallPrototype('hipgable');
  const full = proportionPrototype(source, 'ceremonial', 1);
  const low = proportionPrototype(source, 'ceremonial', 0.5);
  for (const material of ['facade', 'stone']) {
    assert.equal(full.find((part) => part.material === material)!.geometry,
      low.find((part) => part.material === material)!.geometry);
  }
  const roof = low.find((part) => part.material === 'roof')!.geometry;
  roof.computeBoundingBox();
  const eave = elevationForAppearance(5.72, 'ceremonial');
  assert.ok(roof.boundingBox!.max.y - eave < 2.5);
  assert.ok(Array.from(roof.attributes.normal.array).every(Number.isFinite));
});

test('通用建筑仅保留两档屋坡与一份基础立面，不按坊族额外拆绘制批次', () => {
  const source = hallPrototype('gable');
  const calls: PrototypePart[][] = [];
  const kit = {
    prototypes: { gable: source, hip: source, hipgable: source, tower: source, pavilion: source },
    batches: { hall: (parts: PrototypePart[]) => calls.push(parts) },
    block: () => undefined, tree: () => undefined,
  };
  for (const ward of makeWards().filter((item) =>
    ['W3-9', 'E1-5', 'E3-2'].includes(item.id))) {
    buildWardInterior(kit as never, ward);
  }
  assert.ok(calls.length > 30);
  const shared = calls.filter((parts) => parts.some((part) => part.material === 'facade'));
  assert.equal(calls.length - shared.length, 1, '只豁免大兴善寺主殿');
  const roofs = shared.map((parts) => parts.find((part) => part.material === 'roof')!.geometry);
  const facades = shared.map((parts) => parts.find((part) => part.material === 'facade')!.geometry);
  assert.ok(new Set(roofs).size <= 2);
  assert.equal(new Set(facades).size, 1);
});

test('街区配色可复现、有冷暖组别且礼制建筑素壁衬朱木', () => {
  const colors = makeWards().map((ward) => districtAppearance(ward.id, 'dense', ward.x, ward.z));
  assert.ok(new Set(colors.map((color) => color.wall)).size >= 3);
  assert.ok(new Set(colors.map((color) => color.roof)).size <= 4);
  assert.deepEqual(districtAppearance('E1-5', 'temple', 80, 208),
    districtAppearance('E1-5', 'temple', 80, 208));
  assert.equal(districtAppearance('E1-5', 'temple', 80, 208).wall, '#fff0da');
});

// 样板只能改变标高，不能暗中扩大占地、压巷或把共享源原型也改掉。
test('样板分别调整墙身和屋面，台基与建筑占地保持不变', () => {
  assert.equal(elevationForAppearance(0.9, 'dwelling'), 0.9);
  assert.equal(elevationForAppearance(5.4, 'dwelling'), 6.5);
  assert.equal(elevationForAppearance(5.4, 'ceremonial'), 7.1);
  for (const source of [hallPrototype('gable'), towerPrototype('hipgable')]) {
    const original = source.map((part) => Array.from(part.geometry.attributes.position.array));
    const parts = proportionPrototype(source, 'dwelling');
    for (let i = 0; i < parts.length; i++) {
      const from = source[i].geometry, to = parts[i].geometry;
      from.computeBoundingBox();
      if (parts[i].material === 'stone') assert.equal(from, to);
      else assert.notEqual(from, to);
      to.computeBoundingBox();
      assert.equal(to.attributes.position.count, from.attributes.position.count);
      assert.equal(to.boundingBox!.min.x, from.boundingBox!.min.x);
      assert.equal(to.boundingBox!.max.z, from.boundingBox!.max.z);
      assert.ok(Array.from(to.attributes.normal.array).every(Number.isFinite));
      assert.deepEqual(Array.from(from.attributes.position.array), original[i]);
    }
    for (const part of [...source, ...parts]) part.geometry.dispose();
  }
});

test('同一源构件的样板变体复用几何，不重复复制墙与门窗', () => {
  const source = hallPrototype('gable');
  const a = proportionPrototype(source, 'dwelling');
  const b = proportionPrototype(source.map((part) => ({ ...part })), 'dwelling');
  assert.ok(a.every((part, i) => part.geometry === b[i].geometry));
  for (const geometry of new Set([...source, ...a, ...b].map((part) => part.geometry))) {
    geometry.dispose();
  }
});

test('阁楼的标高映射单调，不使上层墙体重新穿入下层屋檐', () => {
  for (const style of ['dwelling', 'ceremonial'] as const) {
    let previous = -Infinity;
    for (let y = 0; y < 24; y += 0.02) {
      const next = elevationForAppearance(y, style);
      assert.ok(next > previous);
      previous = next;
    }
    assert.ok(elevationForAppearance(7, style) < elevationForAppearance(7.008, style));
  }
});

test('屋瓦色调固定可复现，只保留有限共享色域', () => {
  const colors = Array.from({ length: 20 }, (_, i) => sampleRoofTint(i, i * 2));
  assert.ok(new Set(colors).size <= 4);
  assert.ok(new Set(colors).size >= 3);
  assert.equal(sampleRoofTint(203, 526), sampleRoofTint(203, 526));
});

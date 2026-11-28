import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_VIEWS, CITY, isDryShore, makeWards, QUJIANG, random, VIEWS }
  from '../src/world/layout.ts';
import { hallPrototype, roofGeometry, towerPrototype } from '../src/world/architecture.ts';
import { districtFor, sampleHeights } from '../src/world/districts.ts';

test('108个坊位唯一，且位于外郭城内', () => {
  const wards = makeWards();
  assert.equal(wards.length, 108);
  assert.equal(new Set(wards.map((ward) => ward.id)).size, 108);
  for (const ward of wards) {
    assert.ok(ward.x - ward.width / 2 > CITY.west);
    assert.ok(ward.x + ward.width / 2 < CITY.east);
    assert.ok(ward.z - ward.depth / 2 > -285);
    assert.ok(ward.z + ward.depth / 2 < CITY.south);
    assert.ok(Math.abs(ward.x) - ward.width / 2 >= 30);
  }
});

test('坊位互不重叠，东西两市对称且各占两个坊位', () => {
  const wards = makeWards();
  for (let i = 0; i < wards.length; i++) {
    for (let j = i + 1; j < wards.length; j++) {
      const a = wards[i], b = wards[j];
      const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
      const overlapZ = Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;
      assert.ok(!overlapX || !overlapZ, `${a.id} 与 ${b.id} 重叠`);
    }
  }
  for (const side of [-1, 1]) {
    assert.equal(wards.filter((ward) => ward.side === side && ward.kind === 'market').length, 2);
  }
});

test('布局与随机流可复现', () => {
  assert.deepEqual(makeWards(), makeWards());
  const a = random(83), b = random(83), c = random(84);
  const sequence = Array.from({ length: 100 }, () => a());
  assert.deepEqual(sequence, Array.from({ length: 100 }, () => b()));
  assert.notDeepEqual(sequence, Array.from({ length: 100 }, () => c()));
  assert.ok(sequence.every((value) => value >= 0 && value < 1));
});

test('四类屋顶有真实坡度、统一UV、向上法线和正确占地', () => {
  for (const kind of ['gable', 'hip', 'pyramid', 'hipgable'] as const) {
    const roof = roofGeometry(kind);
    const pos = roof.getAttribute('position');
    const normal = roof.getAttribute('normal');
    assert.ok(Array.from(pos.array).every(Number.isFinite));
    roof.computeBoundingBox();
    assert.equal(roof.boundingBox!.max.y - roof.boundingBox!.min.y, 3.5);
    assert.equal(roof.boundingBox!.max.x - roof.boundingBox!.min.x, 20);
    assert.equal(roof.boundingBox!.max.z - roof.boundingBox!.min.z, 13);
    assert.equal(roof.getAttribute('uv').count, pos.count);
    for (let i = 0; i < normal.count; i++) {
      assert.ok(normal.getY(i) >= -0.001, `${kind} 屋顶存在向下法线`);
    }
    roof.dispose();
  }
});

test('建筑原型按材质合并，保留可裁剪近景细节', () => {
  for (const kind of ['gable', 'hip', 'pyramid', 'hipgable'] as const) {
    const parts = hallPrototype(kind, kind === 'hip');
    assert.ok(parts.length <= 7);
    assert.equal(parts.filter((part) => part.detail).length, 2);
    assert.ok(parts.some((part) => part.material === 'facade' && !part.detail));
    const triangles = (detail: boolean) => parts.filter((part) => !!part.detail === detail)
      .reduce((sum, part) => sum + part.geometry.getAttribute('position').count / 3, 0);
    assert.ok(triangles(false) < 180, `${kind} 背景几何超预算`);
    assert.ok(triangles(true) < 260, `${kind} 近景几何超预算`);
    for (const part of parts) {
      assert.ok(Array.from(part.geometry.getAttribute('position').array).every(Number.isFinite));
      assert.ok(part.geometry.getAttribute('normal'));
      assert.equal(part.geometry.index, null);
      part.geometry.dispose();
    }
  }
});

test('曲江树木避开不规则水岸，保留干燥岸边', () => {
  assert.equal(isDryShore(QUJIANG.x, QUJIANG.z), false);
  assert.equal(isDryShore(QUJIANG.x + 100, QUJIANG.z - 24), false);
  assert.equal(isDryShore(QUJIANG.x + QUJIANG.radiusX * 1.25, QUJIANG.z), true);
  assert.equal(isDryShore(QUJIANG.x, QUJIANG.z - QUJIANG.radiusZ * 1.25), true);
});

test('坊市样板保留已有空间类型，并加入西南疏居', () => {
  const profiles = makeWards().map((ward) => ({ id: ward.id, ...districtFor(ward) }));
  assert.deepEqual(new Set(profiles.map((profile) => profile.family)),
    new Set(['dense', 'artisan', 'manor', 'office', 'temple', 'market', 'garden', 'sparse']));
  assert.equal(profiles.find((profile) => profile.id === 'E1-5')!.name, '靖善坊');
  assert.equal(profiles.find((profile) => profile.id === 'E3-2')!.family, 'artisan');
  assert.ok(profiles.every((profile) => profile.name && !profile.name.includes('undefined')));
  assert.equal(profiles.find((profile) => profile.id === 'E4-9')!.name, '晋昌坊');
  assert.equal(profiles.find((profile) => profile.id === 'E5-6')!.name, '新昌坊');
  assert.equal(profiles.find((profile) => profile.id === 'E1-3')!.name, '安仁坊');
  assert.ok(profiles.filter((profile) => profile.family === 'market')
    .every((profile) => profile.name.endsWith('市')));
  assert.ok(new Set(profiles.map((profile) => profile.roadTint)).size >= 4);
  const sizes = Array.from({ length: 30 }, (_, i) => sampleHeights(i * 103));
  assert.ok(new Set(sizes.map((size) => size.wall)).size > 20);
});

test('两层阁楼的屋檐留空且二层不被完整下层屋顶截断', () => {
  const parts = towerPrototype('hipgable');
  const roofs = parts.filter((part) => part.material === 'roof');
  assert.equal(roofs.length, 2);
  assert.equal(roofs[0].geometry.getAttribute('position').count / 3, 8);
  // 只检查挑檐坡面；上层屋脊盒子的底面有向下法线是正常的封闭几何。
  const normal = roofs[0].geometry.getAttribute('normal');
  for (let i = 0; i < normal.count; i++) assert.ok(normal.getY(i) >= -0.001);
  roofs[0].geometry.computeBoundingBox();
  const upperWall = parts.filter((part) => part.material === 'wall')[1].geometry;
  upperWall.computeBoundingBox();
  assert.ok(roofs[0].geometry.boundingBox!.max.y <= upperWall.boundingBox!.min.y + 0.02);
  for (const part of parts) part.geometry.dispose();
});

test('所有机位有有效目标与相机位置', () => {
  assert.equal(Object.keys(VIEWS).length, 23);
  assert.equal(CLASSIC_VIEWS.length, 18);
  assert.equal(new Set(CLASSIC_VIEWS).size, 18);
  assert.ok(CLASSIC_VIEWS.every((id) => VIEWS[id]));
  for (const view of Object.values(VIEWS)) {
    assert.ok([...view.position, ...view.target].every(Number.isFinite));
    assert.ok(view.position[1] > view.target[1]);
  }
});

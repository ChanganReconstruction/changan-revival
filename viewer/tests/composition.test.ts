import { test } from 'node:test';
import assert from 'node:assert/strict';
import { districtFor } from '../src/world/districts.ts';
import { planWardGround } from '../src/world/ground-cover.ts';
import { makeWards } from '../src/world/layout.ts';
import { buildWardInterior, planWard } from '../src/world/ward-composition.ts';

const intersects = (a: { x: number; z: number; width: number; depth: number },
  b: { x: number; z: number; width: number; depth: number }) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2
  && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;

test('坊巷拓扑确定且 dense/artisan 保留多种分割方式', () => {
  const wards = makeWards().filter((ward) => ['dense', 'artisan'].includes(
    districtFor(ward).family,
  ));
  const plans = wards.map(planWard);
  assert.deepEqual(plans[0], planWard(wards[0]));
  assert.ok(new Set(plans.map((plan) => plan.topology)).size >= 3);
  assert.ok(plans.every((plan) => plan.houses.length >= 10));
  const named = ['E3-2', 'W3-2', 'W3-7'].map((id) => planWard(
    makeWards().find((ward) => ward.id === id)!,
  ));
  assert.ok(new Set(named.map((plan) => plan.topology)).size > 1);
});

test('普通宅屋低矮、尺度适宜且朝向和疏密有变化', () => {
  const wards = makeWards();
  const dense = wards.find((ward) => ward.id === 'W3-9')!;
  const artisan = wards.find((ward) => ward.id === 'E3-2')!;
  const d = planWard(dense).houses;
  const a = planWard(artisan).houses;
  for (const house of [...d, ...a]) {
    const normal = house.width >= 9 && house.width <= 26
      && house.depth >= 5 && house.depth <= 12;
    const rotated = house.width >= 5 && house.width <= 12
      && house.depth >= 9 && house.depth <= 26;
    assert.ok(normal || rotated, `${house.width}×${house.depth} 米宅屋包围盒`);
    assert.ok(house.height <= 1.15);
  }
  assert.ok([...d, ...a].some((house) => house.rotation !== 0));
  assert.notEqual(d.length, a.length);
});

test('寺观、官署与府第各有三种拓扑并明确留出院落', () => {
  for (const family of ['temple', 'office', 'manor']) {
    const wards = makeWards().filter((ward) => districtFor(ward).family === family);
    const plans = wards.map(planWard);
    assert.ok(new Set(plans.map((plan) => plan.topology)).size >= 3,
      `${family} 拓扑不足三类`);
    for (const plan of plans) {
      assert.ok(plan.courtyards.length > 0, `${family} 缺少礼制/院落留白`);
      for (const house of plan.houses) {
        assert.ok(plan.courtyards.every((yard) => !intersects(house, yard)),
          `${family} 在庭院内落屋`);
        assert.ok(plan.greenplots.every((plot) => !intersects(house, plot)),
          `${family} 在林圃内落屋`);
      }
    }
  }
  for (const id of ['E1-5', 'W1-5']) {
    const ward = makeWards().find((candidate) => candidate.id === id)!;
    const plan = planWard(ward);
    assert.equal(plan.topology, 'temple-full-axis');
    assert.ok(plan.houses.length >= 5 && plan.houses.length <= 8);
    assert.ok(plan.greenplots.length >= 2);
  }
});

test('坊门道路由 builder 实际提交，连续接入坊内主巷', () => {
  const ward = makeWards().find((candidate) => candidate.id === 'W1-2')!;
  const plan = planWard(ward);
  const blocks: Array<{
    material: string;
    x: number;
    z: number;
    y: number;
    height: number;
    width: number;
    depth: number;
  }> = [];
  const halls: Array<{ rotation: number; width: number; depth: number }> = [];
  const kit = {
    prototypes: { gable: [], hip: [], hipgable: [], pavilion: [], tower: [] },
    batches: { hall: (_parts: unknown, _x: number, _z: number, width: number,
      depth: number, _height: number, rotation: number) => {
      halls.push({ rotation, width, depth });
    } },
    block: (material: string, x: number, y: number, z: number,
      width: number, height: number, depth: number) => {
      blocks.push({ material, x, y, z, width, height, depth });
    },
    tree: () => undefined,
    perimeter: () => undefined,
    pond: () => undefined,
  };
  buildWardInterior(kit as never, ward);
  const roads = blocks.filter((block) => block.material === 'road');
  assert.equal(roads.length, plan.roads.length);
  const baseTop = districtFor(ward).elevation + 0.055;
  assert.ok(blocks.every((block) => block.y + block.height / 2 > baseTop + 0.1),
    '巷道、院坪与草地必须露在整地平台上方，并留出鸟瞰深度精度余量');
  assert.ok(roads.some((road) => road.x === ward.x && road.z > ward.z));
  assert.ok(blocks.some((block) => block.material === 'paving'));
  assert.ok(blocks.some((block) => block.material === 'grass'));
  assert.ok(halls.some((hall) => hall.rotation !== 0 && hall.width !== hall.depth));
});

test('既有曲井台广场与坊门侧鼓楼均留足净空', () => {
  const wards = makeWards();
  const well = planWard(wards.find((ward) => ward.id === 'E2-8')!);
  assert.deepEqual(well.publicSquares, [{ x: 223, z: 538, width: 14, depth: 12 }]);
  assert.ok(well.roads.some((road) => road.z === 538 && road.x < 223));
  assert.ok(well.houses.every((house) => well.publicSquares.every((square) =>
    !intersects(house, square))));
  const gateWard = planWard(wards.find((ward) => ward.id === 'E1-7')!);
  assert.ok(gateWard.keepouts.some((area) => area.x === 112 && area.z === 458));
  assert.ok(gateWard.houses.every((house) => gateWard.keepouts.every((area) =>
    !intersects(house, area))));
});

test('西南六坊按相对坊序落位，仅保留局部园圃', () => {
  const wards = makeWards();
  const expected = Object.entries({
    'W6-8': '和平坊', 'W6-9': '永阳坊', 'W5-8': '归义坊',
    'W5-9': '昭行坊', 'W4-8': '大通坊', 'W4-9': '大安坊',
  });
  const scope = wards.filter((ward) => districtFor(ward).southwest);
  assert.equal(scope.length, expected.length);
  for (const [id, name] of expected) {
    const named = wards.filter((ward) => districtFor(ward).name === name);
    assert.deepEqual(named.map((ward) => ward.id), [id]);
    const [ward] = named;
    const plan = planWard(ward);
    assert.ok(plan.houses.length >= 3 && plan.houses.length < 10, `${id} 疏居体量`);
    assert.ok(plan.courtyards.length > 0 && plan.greenplots.length > 0, `${id} 缺院落或园圃`);
    assert.deepEqual(planWardGround(ward), [], `${id} 不额外铺设草坪`);
    assert.ok(plan.roads.some((road) => road.x === ward.x
      && road.z - road.depth / 2 === ward.z
      && road.z + road.depth / 2 > ward.z + ward.depth / 2), `${id} 巷道须穿过门洞`);
  }
  const corner = wards.find((ward) => ward.id === 'W6-9')!;
  assert.equal(corner.x, Math.min(...wards.map((ward) => ward.x)));
  assert.equal(corner.z, Math.max(...wards.map((ward) => ward.z)));
  const temple = planWard(corner);
  assert.ok(temple.houses.every((house) => house.x - house.width / 2 > corner.x));
  assert.ok(temple.houses.some((house) => house.roof === 'tower'));
  assert.ok(temple.courtyards.some((yard) => yard.x < corner.x), '大总持寺一侧只留院落');
  const north = wards.find((ward) => ward.id === 'W6-8')!;
  const heping = planWard(north);
  assert.ok(heping.courtyards.some((yard) => yard.z > north.z && yard.x < north.x));
  assert.ok(heping.courtyards.some((yard) => yard.z > north.z && yard.x > north.x));
  assert.ok(!heping.houses.some((house) => house.roof === 'tower'));
});

test('建筑不越坊界、不压街巷且互不穿插', () => {
  for (const ward of makeWards()) {
    const plan = planWard(ward);
    for (const house of plan.houses) {
      assert.ok(house.x - house.width / 2 >= ward.x - ward.width / 2 + 6,
        `${ward.id} 建筑越过西界`);
      assert.ok(house.x + house.width / 2 <= ward.x + ward.width / 2 - 6,
        `${ward.id} 建筑越过东界`);
      assert.ok(house.z - house.depth / 2 >= ward.z - ward.depth / 2 + 6,
        `${ward.id} 建筑越过北界`);
      assert.ok(house.z + house.depth / 2 <= ward.z + ward.depth / 2 - 6,
        `${ward.id} 建筑越过南界`);
      for (const road of plan.roads) assert.ok(!intersects(house, road),
        `${ward.id} 建筑压巷`);
    }
    for (let i = 0; i < plan.houses.length; i++) {
      for (let j = i + 1; j < plan.houses.length; j++) {
        assert.ok(!intersects(plan.houses[i], plan.houses[j]), `${ward.id} 建筑重叠`);
      }
    }
  }
});

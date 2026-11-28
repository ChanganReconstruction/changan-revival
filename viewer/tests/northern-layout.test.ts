import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { districtFor } from '../src/world/districts.ts';
import { officePrototype } from '../src/world/office-architecture.ts';
import { paintedPalacePrototype, palacePrototype } from '../src/world/royal-architecture.ts';
import { createImperialCity, createNorthernQuarters } from '../src/world/imperial-city.ts';
import type { LandmarkKit } from '../src/world/landmark-kit.ts';
import { makeSceneLabels } from '../src/world/landmark-labels.ts';
import { CITY, makeWards } from '../src/world/layout.ts';
import {
  DAMING_WALL, DANFENG_AVENUE, FANGLIN_X, IMPERIAL, KAIYUAN_STREET_Z, NORTHERN_CONNECTORS,
  NORTHERN_SITES, NORTHERN_WARDS, PALACE_CROSS_STREET, TAIJI, northernLot,
} from '../src/world/northern-layout.ts';

const wards = makeWards();
const northwestern = (column: string) =>
  NORTHERN_WARDS.filter(({ id }) => id.startsWith(`nw-${column}-`)).sort((a, b) => a.z - b.z);

test('西北坊序由东向西排列，丹凤门前两列分列街道东西', () => {
  const [inner, middle, outer] = ['inner', 'middle', 'outer'].map(northwestern);
  assert.deepEqual(inner!.map(({ name }) => name), ['修德坊', '辅兴坊', '颁政坊', '布政坊']);
  assert.deepEqual(middle!.map(({ name }) => name), ['安定坊', '休祥坊', '金城坊', '醴泉坊']);
  assert.deepEqual(outer!.map(({ name }) => name), ['修真坊', '普宁坊', '义宁坊', '居德坊']);
  assert.ok(outer![0]!.x < middle![0]!.x && middle![0]!.x < inner![0]!.x);
  assert.ok(inner![0]!.x + inner![0]!.width / 2 < FANGLIN_X && FANGLIN_X < TAIJI.west);
  for (const [west, east, out] of [['光宅坊', '翊善坊', '延政坊'], ['永昌坊', '来庭坊', '太宁坊']]) {
    const [a, b, c] = [west, east, out].map((name) => NORTHERN_WARDS.find((ward) => ward.name === name)!);
    assert.equal(a!.z, b!.z);
    assert.equal(b!.z, c!.z);
    assert.ok(a!.x < DANFENG_AVENUE.x && DANFENG_AVENUE.x < b!.x && b!.x < c!.x);
  }
  assert.ok(NORTHERN_WARDS.find(({ name }) => name === '光宅坊')!.z
    < NORTHERN_WARDS.find(({ name }) => name === '永昌坊')!.z);
});

test('北部坊块不重叠或侵占街道、宫墙，旧坊网不重复挂名', () => {
  const avenue = {
    x: DANFENG_AVENUE.x, width: DANFENG_AVENUE.width,
    z: (DANFENG_AVENUE.north + DANFENG_AVENUE.south) / 2,
    depth: DANFENG_AVENUE.south - DANFENG_AVENUE.north,
  };
  const names = new Set(wards.map((ward) => districtFor(ward).name));
  const labels = makeSceneLabels(wards);
  for (const [i, ward] of NORTHERN_WARDS.entries()) {
    assert.ok(ward.x - ward.width / 2 > CITY.west && ward.x + ward.width / 2 < CITY.east, ward.id);
    assert.ok(ward.z - ward.depth / 2 > CITY.north && ward.z + ward.depth / 2 < -260, ward.id);
    assert.ok(ward.x + ward.width / 2 < TAIJI.west || ward.x - ward.width / 2 > TAIJI.east, ward.id);
    for (const other of [...NORTHERN_WARDS.slice(i + 1), ...wards, avenue]) {
      assert.ok(Math.abs(ward.x - other.x) >= (ward.width + other.width) / 2
        || Math.abs(ward.z - other.z) >= (ward.depth + other.depth) / 2, ward.id);
    }
    assert.ok(!names.has(ward.name), ward.name);
    assert.equal(labels.find(({ id }) => id === ward.id)?.name, ward.name || undefined);
    if (ward.name) names.add(ward.name);
  }
  assert.equal(wards.length, 108);
  assert.ok(!labels.some(({ name }) => /禁苑|仓场/.test(name)));
});

test('宫皇中间留横街；丹凤门大街在外郭北垣上对准宫门', () => {
  assert.equal(TAIJI.north, CITY.north);
  assert.equal(DANFENG_AVENUE.north, CITY.north);
  assert.equal(DAMING_WALL.south, CITY.north);
  assert.equal(DANFENG_AVENUE.x, (DAMING_WALL.west + DAMING_WALL.east) / 2);
  assert.ok(TAIJI.south < PALACE_CROSS_STREET && PALACE_CROSS_STREET < IMPERIAL.north);
  assert.ok(TAIJI.west < TAIJI.westPartition && TAIJI.eastPartition < TAIJI.east);
  const blocks: Parameters<LandmarkKit['block']>[] = [];
  const kit: LandmarkKit = {
    block: (...args) => { blocks.push(args); },
    batches: { hall() {}, add() {} },
    prototypes: { gable: [], hip: [], hipgable: [], pavilion: [], tower: [] },
    perimeter() {}, tree() {}, pond() {},
  };
  createImperialCity(kit);
  assert.ok(blocks.some(([m, , , z]) => m === 'road' && z === PALACE_CROSS_STREET));
  assert.ok(!blocks.some(([m, , , z, , , d]) => m === 'vermilion'
    && z - d / 2 < PALACE_CROSS_STREET && z + d / 2 > PALACE_CROSS_STREET));
  blocks.length = 0;
  const connectors: [number, number][][] = [];
  createNorthernQuarters(kit, (points) => connectors.push(points));
  assert.ok(blocks.some(([m, x, , z, w, , d]) => m === 'road' && x === DANFENG_AVENUE.x
    && w === DANFENG_AVENUE.width && z - d / 2 === CITY.north && z + d / 2 === DANFENG_AVENUE.south));
  assert.ok(!blocks.some(([m, , , z, w, , d]) => m === 'road'
    && w === DANFENG_AVENUE.width && z + d / 2 > DANFENG_AVENUE.south));
  assert.ok(blocks.some(([m, x, , z, w]) => m === 'road'
    && z === KAIYUAN_STREET_Z && x - w / 2 === CITY.west));
  assert.deepEqual(connectors.map((points) => [points[0], points.at(-1)]),
    NORTHERN_CONNECTORS.map(([northX, regularX]) => [[northX, -285], [regularX, -269]]));
});

test('有据寺院落在所记坊内方位，标注与展示院原型共用坐标', () => {
  const labels = makeSceneLabels(wards);
  for (const site of NORTHERN_SITES) {
    const ward = NORTHERN_WARDS.find(({ id }) => id === site.ward)!;
    const lot = northernLot(ward, site.side, site.column, site.half);
    const label = labels.find(({ id }) => id === site.id)!;
    assert.equal(label.x, lot.x);
    assert.equal(label.z, lot.z - 10);
    assert.ok(Math.abs(site.side) === 1 && Math.sign(lot.x - ward.x) === site.side);
    assert.ok(lot.z < ward.z && lot.z - 21 > ward.z - ward.depth / 2);
    assert.match(label.name, /意象/);
  }
});

test('太极宫保留独大的正殿，皇城则以沿横街的低檐署院为主', () => {
  const halls: Parameters<LandmarkKit['batches']['hall']>[] = [];
  const kit: LandmarkKit = {
    block() {}, perimeter() {}, tree() {}, pond() {},
    batches: { hall: (...args) => { halls.push(args); }, add() {} },
    prototypes: { gable: [], hip: [], hipgable: [], pavilion: [], tower: [] },
  };
  createImperialCity(kit);
  const hall = halls.find(([, x, z]) => x === 0 && z === -650)!;
  const east = halls.find(([, x, z]) => x === 181 && z === -662)!;
  assert.equal(hall[0], palacePrototype('state-hall'));
  assert.equal(east[0], palacePrototype('east-hall'));
  assert.ok(hall[3]! > east[3]! && hall[5]! > east[5]!);
  assert.ok(halls.some(([prototype, x, z]) => prototype === palacePrototype('gate')
    && x === east[1] && z > east[2]));
  const offices = halls.filter(([prototype]) => prototype === officePrototype('hall'));
  assert.equal(offices.length, 12);
  for (const [, , z, width = 0, , height = 1] of offices) {
    assert.ok(z > IMPERIAL.north && z < IMPERIAL.south);
    assert.ok((hall[3] ?? 0) > width * 2 && (hall[5] ?? 0) > height * 2);
    assert.ok(east[3]! > width * 1.5 && east[5]! > height * 1.8);
  }
  const labels = makeSceneLabels(wards);
  assert.ok(labels.some(({ id, x, z }) => id === 'east-palace' && x === east[1] && z === east[2]));
});

test('宫门实心门墩分列两侧，中路在地面高度可贯通', () => {
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const meshes = palacePrototype('gate').map(({ geometry }) => new Mesh(geometry, material));
  const cross = (x: number) => new Raycaster(new Vector3(x, 1, 9), new Vector3(0, 0, -1))
    .intersectObjects(meshes).length;
  assert.equal(cross(0), 0);
  assert.ok(cross(-5) > 0 && cross(5) > 0);
  material.dispose();
});

test('太极宫后殿、寝院和偏殿用三种轮廓，但立面只提交十二个三角面', () => {
  const halls: Parameters<LandmarkKit['batches']['hall']>[] = [];
  createImperialCity({
    block() {}, perimeter() {}, tree() {}, pond() {},
    batches: { hall: (...args) => { halls.push(args); }, add() {} },
    prototypes: { gable: [], hip: [], hipgable: [], pavilion: [], tower: [] },
  });
  const expectation = [
    ['audience', 'taiji-inner-hall'], ['residence', 'taiji-residence'], ['side', null],
  ] as const;
  const labels = makeSceneLabels(wards);
  const roofCounts = new Set<number>();
  for (const [form, id] of expectation) {
    const parts = paintedPalacePrototype(form);
    assert.equal(paintedPalacePrototype(form), parts, '同形制重复使用同一批次原型');
    assert.equal(parts.length, 3, '只有台基、墙体、屋顶');
    const facade = parts.find(({ material }) => material === 'palaceFacade')!.geometry;
    assert.equal(facade.index!.count, 36);
    roofCounts.add(parts.find(({ material }) => material === 'roof')!.geometry
      .getAttribute('position').count);
    if (id) {
      const label = labels.find((item) => item.id === id)!;
      assert.ok(halls.some(([prototype, x, z]) => prototype === parts && x === label.x && z === label.z));
    }
  }
  assert.ok(roofCounts.size >= 2, '屋顶不只缩放一种形制');
});

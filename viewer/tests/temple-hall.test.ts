import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { hallPrototype, templeHallPrototype, type PrototypePart } from '../src/world/architecture.ts';
import { makeWards } from '../src/world/layout.ts';
import { buildWardInterior, planWard } from '../src/world/ward-composition.ts';

test('寺殿主立面是通透柱廊，屋檐伸出柱列，不贴民房门窗图集', () => {
  const parts = templeHallPrototype();
  const byMaterial = (key: PrototypePart['material']) => parts.find(({ material }) => material === key)!;
  assert.ok(hallPrototype('gable').some(({ material }) => material === 'facade'));
  assert.ok(!parts.some(({ material, detail }) => material === 'facade' || detail));
  const material = new THREE.MeshBasicMaterial();
  const ray = (key: PrototypePart['material'], x: number) => new THREE.Raycaster(
    new THREE.Vector3(x, 2.4, 8), new THREE.Vector3(0, 0, -1),
  ).intersectObject(new THREE.Mesh(byMaterial(key).geometry, material))[0]?.point.z;
  assert.ok(ray('vermilion', 5.1)! > 2.9, '前檐柱应在殿身前方');
  assert.ok(ray('wall', 3.4)! < 1, '柱间需留出前廊深度');
  assert.ok(ray('wall', 0)! < 0 && ray('dark', 0)! < 0, '中门向内打开，不被前墙封死');
  for (const { geometry } of parts) geometry.computeBoundingBox();
  assert.ok(byMaterial('roof').geometry.boundingBox!.max.z > 5.3);
  assert.ok(byMaterial('stone').geometry.boundingBox!.max.z > 5.4);
  for (const { geometry } of parts) geometry.dispose();
  material.dispose();
});

test('独立原型只提交给大兴善寺主殿，不替换民房或同院配殿', () => {
  const wards = makeWards();
  const special = wards.flatMap((ward) => planWard(ward).houses
    .filter((house) => house.form === 'temple-hall').map((house) => ({ ward, house })));
  assert.equal(special.length, 1);
  const [{ ward, house }] = special;
  assert.equal(ward.id, 'E1-5');
  const rendered = new Map<number, PrototypePart[]>();
  const kit = {
    prototypes: { gable: [], hip: [], hipgable: [], pavilion: [], tower: [] },
    batches: { hall: (parts: PrototypePart[], x: number, z: number) => {
      if (x === house.x) rendered.set(z, parts);
    } },
    block: () => undefined,
    tree: () => undefined,
  };
  buildWardInterior(kit as never, ward);
  assert.ok(rendered.get(house.z)?.some(({ material }) => material === 'vermilion'));
  assert.ok(!rendered.get(ward.z - 34)?.length);
});

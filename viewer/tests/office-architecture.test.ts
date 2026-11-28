import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, Raycaster, Vector3 } from 'three';
import { elevationForAppearance } from '../src/world/appearance.ts';
import { createImperialCity } from '../src/world/imperial-city.ts';
import type { LandmarkKit } from '../src/world/landmark-kit.ts';
import { IMPERIAL } from '../src/world/northern-layout.ts';
import { officePrototype } from '../src/world/office-architecture.ts';

test('署厅有独立台基、前檐柱列和窗格，署门中间留真实的通口', () => {
  const main = officePrototype('hall');
  assert.equal(officePrototype('hall'), main);
  for (const material of ['stone', 'paving', 'vermilion', 'wood', 'dark', 'wall', 'roof']) {
    assert.equal(main.filter((part) => part.material === material).length, 1);
  }
  const gate = officePrototype('gate').map(({ geometry }) => new Mesh(geometry));
  const ray = (x: number) => new Raycaster(new Vector3(x, 1.2, 8),
    new Vector3(0, 0, -1), 0, 16).intersectObjects(gate);
  assert.equal(ray(0).length, 0);
  assert.ok(ray(5.7).length > 0);
});

test('署厅前檐只保留四柱，背檐和厢房不加独立柱列', () => {
  const probe = (form: 'hall' | 'wing', x: number, side: number) => {
    const meshes = officePrototype(form)
      .filter(({ material }) => material === 'wood' || material === 'vermilion')
      .map(({ geometry }) => new Mesh(geometry));
    return new Raycaster(new Vector3(x, 2, side * 4.8),
      new Vector3(0, 0, -side), 0, 1.55).intersectObjects(meshes).length;
  };
  for (const x of [-8, -2.75, 2.75, 8]) {
    assert.ok(probe('hall', x, 1) > 0);
    assert.equal(probe('hall', x, -1), 0);
  }
  for (const x of [-8, -4.8, -1.6, 0, 1.6, 4.8, 8]) {
    if (Math.abs(x) !== 8) assert.equal(probe('hall', x, 1), 0);
    assert.equal(probe('wing', x, 1), 0);
    assert.equal(probe('wing', x, -1), 0);
  }
});

test('署厅檐口高于比对民居，前庭主路留通，院内有不同植栽与厢房配置', () => {
  const halls: Parameters<LandmarkKit['batches']['hall']>[] = [];
  const blocks: Parameters<LandmarkKit['block']>[] = [];
  const kit: LandmarkKit = {
    perimeter() {}, tree() {}, pond() {},
    block: (...args) => { blocks.push(args); },
    batches: { hall: (...args) => { halls.push(args); }, add() {} },
    prototypes: { gable: [], hip: [], hipgable: [], pavilion: [], tower: [] },
  };
  createImperialCity(kit);
  const prototype = officePrototype('hall');
  const roof = prototype.find(({ material }) => material === 'roof')!.geometry;
  roof.computeBoundingBox();
  const eaves = roof.boundingBox!.min.y;
  const offices = halls.filter(([parts]) => parts === prototype);
  assert.equal(offices.length, 12);
  for (const [, x, z, , , h = 1, , y = 0] of offices) {
    assert.ok(y + h * eaves >= elevationForAppearance(5.72, 'dwelling') * 1.2);
    assert.ok(blocks.some(([material, px, , pz, , , d]) =>
      material === 'paving' && px === x && pz === z + 35 && d === 48));
    assert.ok(!blocks.some(([material, px, , pz, w]) => material === 'grass'
      && Math.abs(px - x) < w / 2 + 3.9 && pz > z && pz <= z + 56));
  }
  const wings = halls.filter(([parts]) => parts === officePrototype('wing'));
  assert.equal(wings.length, 16, '部分院有两厢，其他院仅留一侧');
  assert.equal(blocks.filter(([material, , , z]) =>
    material === 'grass' && z > IMPERIAL.north && z < IMPERIAL.south).length, 24);
});

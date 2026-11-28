import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { functionalPrototype, type BuildingForm } from '../src/world/functional-architecture.ts';
import { makeSceneLabels } from '../src/world/landmark-labels.ts';
import { makeWards } from '../src/world/layout.ts';
import { planWard } from '../src/world/ward-composition.ts';

test('功能建筑各有独立轮廓，按材质合并且同类复用原型', () => {
  const forms: BuildingForm[] = ['shop', 'office', 'academy', 'manor', 'pavilion', 'drum', 'passage'];
  const roofs = forms.map((form) => {
    const parts = functionalPrototype(form);
    assert.equal(functionalPrototype(form), parts);
    assert.equal(new Set(parts.map(({ material }) => material)).size, parts.length);
    assert.ok(parts.every(({ geometry }) =>
      geometry.attributes.position.count > 0 && geometry.attributes.uv && geometry.attributes.normal));
    return parts.find(({ material }) => material === 'roof')?.geometry;
  });
  assert.equal(new Set(roofs).size, forms.length);
  assert.ok(roofs.every(Boolean));
  assert.ok(functionalPrototype('shop').some(({ material }) => material === 'cloth'));
  assert.ok(functionalPrototype('drum').some(({ material }) => material === 'cloth'));
});

test('坊门中央真实贯通，店面与讲堂不是在实墙上贴门窗', () => {
  function check(form: BuildingForm, wallsOnly: boolean, x: number, far: number) {
    const meshes = functionalPrototype(form)
      .filter(({ material }) => !wallsOnly || material === 'wall')
      .map(({ geometry }) => new THREE.Mesh(geometry, material));
    return new THREE.Raycaster(new THREE.Vector3(x, 2, 8), new THREE.Vector3(0, 0, -1),
      0, far).intersectObjects(meshes);
  }
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  assert.equal(check('passage', false, 0, 16).length, 0);
  assert.ok(check('passage', false, 8, 16).length > 0);
  assert.equal(check('shop', true, 4.05, 8).length, 0);
  assert.ok(check('shop', true, 4.05, 15).length > 0);
  assert.equal(check('academy', true, 3, 8).length, 0);
  assert.ok(check('manor', true, 4, 8).length > 0);
  material.dispose();
});

test('近景标签有唯一标识，具名建筑锚定实际主殿，保留小雁塔入口', () => {
  const wards = makeWards();
  const labels = makeSceneLabels(wards);
  const byId = new Map(labels.map((label) => [label.id, label]));
  assert.equal(byId.size, labels.length);
  assert.ok(labels.every(({ x, y, z }) => [x, y, z].every(Number.isFinite)));
  assert.equal(byId.get('xiaoyan')?.near, undefined);
  for (const [wardId, form, expectedName] of [
    ['E1-5', 'temple-hall', '大兴善寺'], ['E2-1', 'academy', '国子监讲堂（意象）'],
  ]) {
    const house = planWard(wards.find(({ id }) => id === wardId)!).houses.find((item) => item.form === form)!;
    const label = byId.get(`site-${wardId}`)!;
    assert.equal(label.name, expectedName);
    assert.deepEqual([label.x, label.z], [house.x, house.z]);
    assert.ok(label.near! < 600);
  }
  const manor = planWard(wards.find(({ id }) => id === 'E3-1')!);
  assert.equal(manor.houses.filter(({ form }) => form === 'manor').length, 2);
  assert.ok(manor.houses.some(({ form }) => form === 'screen'));
  assert.ok(manor.houses.some(({ form }) => form === 'pavilion'));
  assert.ok(byId.has('gate-E1-7'));
  assert.ok(!byId.has('gate-E6-9') && !byId.has('gate-W4-5'));
  assert.ok(!labels.some(({ name }) => name.includes('大总持寺')));
});

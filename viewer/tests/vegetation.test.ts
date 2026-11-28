import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Vegetation, vegetationTier, crownCards } from '../src/render/vegetation.ts';

test('植被投影分级带滞回，远树不会因阈值消失', () => {
  assert.equal(vegetationTier(80, 'medium'), 'near');
  assert.equal(vegetationTier(20, 'medium'), 'middle');
  assert.equal(vegetationTier(2, 'medium'), 'far');
  assert.equal(vegetationTier(8, 'medium', 'middle'), 'middle');
  assert.equal(vegetationTier(10, 'medium', 'far'), 'far');
  assert.equal(vegetationTier(11, 'medium', 'far'), 'middle');
  assert.equal(vegetationTier(35, 'medium', 'near'), 'near');
  assert.equal(vegetationTier(37, 'medium', 'middle'), 'middle');
  assert.equal(vegetationTier(200, 'high', 'far'), 'near');
});

test('植被只保留四个共享实例网格，三层互斥且保留全部树位', () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshLambertMaterial();
  const foliage = new Vegetation(scene, { leaf: material, trunk: material }, material);
  for (const x of [15, 500, 5000]) {
    foliage.add({ x, y: 0, z: 0, size: 1, rotation: 0.3, tint: '#aac496' });
  }
  foliage.finish();
  const camera = new THREE.PerspectiveCamera(40);
  camera.position.set(0, 7, 0);
  assert.equal(foliage.update(camera, 900, 'medium'), true);
  assert.deepEqual([foliage.stats.near, foliage.stats.middle, foliage.stats.far], [1, 1, 1]);
  assert.deepEqual(foliage.meshes.map((mesh) => mesh.count), [1, 1, 1, 1]);
  assert.equal(scene.children.length, 4);
  const matrix = new THREE.Matrix4();
  const expected = [15, 15, 500, 5000];
  foliage.meshes.forEach((mesh, i) => {
    mesh.getMatrixAt(0, matrix);
    assert.equal(matrix.elements[12], expected[i]);
    assert.equal(mesh.castShadow, false);
    assert.ok(mesh.boundingSphere!.radius > 1000);
  });
  const versions = foliage.meshes.map((mesh) => mesh.instanceMatrix.version);
  const uploads = foliage.stats.uploads;
  assert.equal(foliage.update(camera, 900, 'medium'), false);
  assert.equal(foliage.stats.uploads, uploads);
  assert.deepEqual(foliage.meshes.map((mesh) => mesh.instanceMatrix.version), versions);
  camera.position.set(0, 7, 10000);
  foliage.update(camera, 900, 'medium');
  assert.equal(foliage.stats.far, 3);
  assert.equal(foliage.meshes[0].count, 0);
  assert.equal(foliage.meshes[1].count, 0);
  assert.equal(foliage.meshes[2].count, 0);
  assert.equal(foliage.meshes[3].count, 3);
  assert.equal(foliage.stats.near + foliage.stats.middle + foliage.stats.far, 3);
  foliage.meshes.forEach((mesh) => mesh.geometry.dispose());
  material.dispose();
});

test('远景树冠六个三角面覆盖俯视方向，并保留透明裁切所需UV', () => {
  const cards = crownCards();
  assert.equal(cards.getIndex()!.count / 3, 6);
  assert.equal(cards.getAttribute('uv').count, 12);
  const normals = cards.getAttribute('normal');
  assert.ok(Array.from(normals.array).every(Number.isFinite));
  assert.equal(Array.from({ length: normals.count }, (_, i) => normals.getY(i))
    .filter((y) => y > 0.99).length, 4);
  const material = new THREE.MeshBasicMaterial();
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 20, 0), new THREE.Vector3(0, -1, 0));
  assert.ok(ray.intersectObject(new THREE.Mesh(cards, material)).length > 0);
  material.dispose();
  cards.dispose();
});

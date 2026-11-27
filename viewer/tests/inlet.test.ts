import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  HUANG_INLET, inletSamples, inletGeometries, inletMouthCut, inletWallSegments,
} from '../src/world/qujiang-inlet.ts';
import { QUJIANG_OUTLINE } from '../src/world/water-layout.ts';
import { createLakeGeometry, createShoreGeometry } from '../src/world/waterscape.ts';
import { CITY } from '../src/world/layout.ts';

const contains = (part: ReturnType<typeof inletWallSegments>[number], x: number, y: number) =>
  Math.abs(x - part.x) < part.width / 2 && Math.abs(y - part.y) < part.height / 2;

test('黄渠首段只呈现入池末段，来流在城外东南，水位连续向曲江下降', () => {
  const points = inletSamples();
  assert.equal(HUANG_INLET.wallZ, CITY.south);
  assert.ok(points[0].z > CITY.south);
  assert.ok(points[0].x > points.at(-1)!.x);
  assert.equal(points.at(-1)!.level, HUANG_INLET.lakeLevel);
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i].level <= points[i - 1].level);
    assert.ok(points[i].z < points[i - 1].z);
    assert.ok(points[i].level >= HUANG_INLET.lakeLevel);
  }
  const lake = new THREE.Mesh(createLakeGeometry(QUJIANG_OUTLINE).rotateX(-Math.PI / 2));
  const end = points.at(-1)!;
  const ray = new THREE.Raycaster(
    new THREE.Vector3(end.x - 689, 10, end.z - 593), new THREE.Vector3(0, -1, 0),
  );
  assert.ok(ray.intersectObject(lake).length > 0, '末端必须实际落入池内');
  lake.geometry.dispose();
});

test('渠水与两岸不是叠在封闭湖岸上的蓝条，岸口与涵道均真实留空', () => {
  const parts = inletWallSegments(594, 840);
  const points = inletSamples().filter((point) => Math.abs(point.z - CITY.south) < 4.5);
  for (const point of points) for (const dx of [-2.8, 0, 2.8]) {
    assert.ok(parts.every((part) => !contains(part, point.x + dx, point.level + 0.1)));
  }
  assert.ok(parts.some((part) => contains(part, HUANG_INLET.wallX, 6)), '城墙上部不能被全高删掉');
  const outer = QUJIANG_OUTLINE.map(([x, z]) => [x * 1.065, z * 1.09] as [number, number]);
  const bank = QUJIANG_OUTLINE.map(([x, z]) => [x * 1.14, z * 1.19] as [number, number]);
  const shores = [
    new THREE.Mesh(createShoreGeometry(QUJIANG_OUTLINE, outer, -1.3, inletMouthCut)),
    new THREE.Mesh(createShoreGeometry(outer, bank, 1.5, inletMouthCut)),
  ];
  shores[0].position.set(689, 0.36, 593);
  shores[1].position.set(689, 1.66, 593);
  shores.forEach((mesh) => mesh.updateMatrixWorld());
  for (const point of inletSamples().filter((p) => p.z < 690 && p.z > 667)) {
    for (const dx of [-2.5, 0, 2.5]) {
      const ray = new THREE.Raycaster(
        new THREE.Vector3(point.x + dx, 10, point.z), new THREE.Vector3(0, -1, 0),
      );
      assert.ok(ray.intersectObjects(shores).every((hit) => hit.point.y < point.level));
    }
  }
  shores.forEach((mesh) => mesh.geometry.dispose());
});

test('渠面与岸坡法线向上、统一UV且首段预算不超过2000三角面', () => {
  const geometries = inletGeometries();
  let triangles = 0;
  for (const [name, geometry] of Object.entries(geometries)) {
    const positions = geometry.getAttribute('position');
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    assert.equal(positions.count, geometry.getAttribute('uv').count);
    if (name !== 'skirts') {
      assert.ok(Array.from({ length: positions.count }, (_, i) =>
        geometry.getAttribute('normal').getY(i)).every((y) => y > 0));
    }
    triangles += positions.count / 3;
    geometry.dispose();
  }
  assert.ok(triangles <= 2000);
});

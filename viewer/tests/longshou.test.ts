import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LONGSHOU_INLET, longshouSamples, longshouMouthCut, longshouRoadCut,
  longshouApproaches, createLongshouInlet } from '../src/world/longshou-inlet.ts';
import { channelGeometries, channelWallSegments } from '../src/world/channel-geometry.ts';
import { LONGCHI_OUTLINE, createLakeGeometry, createShoreGeometry } from '../src/world/waterscape.ts';
import { ribbonGeometry } from '../src/world/terrain.ts';
import { createPalaces } from '../src/world/palaces.ts';
import type { LandmarkKit } from '../src/world/landmark-kit.ts';

function recordPalaces() {
  const blocks: Parameters<LandmarkKit['block']>[] = [];
  const walls: Parameters<LandmarkKit['perimeter']>[] = [];
  const kit = { prototypes: { gable: [], hip: [], hipgable: [], pavilion: [], tower: [] },
    batches: { add: () => undefined, hall: () => undefined },
    block: (...args: Parameters<LandmarkKit['block']>) => blocks.push(args),
    perimeter: (...args: Parameters<LandmarkKit['perimeter']>) => walls.push(args),
    tree: () => undefined, pond: () => undefined } as unknown as LandmarkKit;
  createPalaces(kit);
  return { kit, blocks, walls };
}

const profile = { halfWidth: 2, crestOffset: 3, outerOffset: 4, rise: 0.45 };

test('龙首西支自城东北外侧入兴庆，水位单调下降且末端进入龙池', () => {
  const points = longshouSamples();
  assert.ok(points[0].x > LONGSHOU_INLET.wallX);
  assert.ok(points[0].z < -155 && LONGSHOU_INLET.wallZ > -585);
  for (let i = 1; i < points.length; i++) assert.ok(points[i].level <= points[i - 1].level);
  assert.equal(points.at(-1)!.level, 0.45);
  const lake = new THREE.Mesh(createLakeGeometry(LONGCHI_OUTLINE).rotateX(-Math.PI / 2));
  const end = points.at(-1)!;
  assert.ok(new THREE.Raycaster(new THREE.Vector3(end.x - 750, 10, end.z + 155),
    new THREE.Vector3(0, -1, 0)).intersectObject(lake).length > 0);
  lake.geometry.dispose();
});

test('东墙涵口全墙厚贯通，水面不穿越宫殿基座、院墙或便桥支墩', () => {
  const { blocks, walls } = recordPalaces();
  const geometry = channelGeometries(longshouSamples(), profile);
  const p = geometry.water.getAttribute('position');
  const wall = channelWallSegments(64, 496, -55 - LONGSHOU_INLET.wallZ,
    LONGSHOU_INLET.clearWidth, LONGSHOU_INLET.clearHeight);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    for (const [material, bx, by, bz, w, h, d] of blocks) {
      assert.ok(!(Math.abs(x - bx) < w / 2 && Math.abs(z - bz) < d / 2
        && y > by - h / 2 && y < by + h / 2), `${material} 封堵水面 ${x}, ${z}`);
    }
    for (const [wx, wz, w, d] of walls) {
      const insideX = Math.abs(x - wx) < w / 2 + 1;
      const insideZ = Math.abs(z - wz) < d / 2 + 1;
      assert.ok(!(insideX && Math.abs(Math.abs(z - wz) - d / 2) < 1)
        && !(insideZ && Math.abs(Math.abs(x - wx) - w / 2) < 1), '院墙封堵水面');
    }
    if (Math.abs(x - 840) < 4.5) {
      const local = -55 - z;
      assert.ok(wall.every((part) => !(Math.abs(local - part.x) < part.width / 2
        && Math.abs(y - part.y) < part.height / 2)), '东城墙堵水');
    }
  }
  Object.values(geometry).forEach((shape) => shape.dispose());
});

test('龙池岸口实际开口，便桥下删除原低路面而两侧路段仍连续', () => {
  const shore = new THREE.Mesh(createShoreGeometry(LONGCHI_OUTLINE,
    LONGCHI_OUTLINE.map(([x, z]) => [x * 1.12, z * 1.16]), 1.1, longshouMouthCut));
  shore.position.set(750, 1.05, -155);
  shore.updateMatrixWorld();
  const road = new THREE.Mesh(ribbonGeometry(
    [[819, -264], [819, -212], [819, -202], [819, -195], [819, -185], [819, -175], [819, 0]],
    13, () => 0.12, longshouRoadCut));
  for (const point of longshouSamples()) {
    const ray = new THREE.Raycaster(new THREE.Vector3(point.x, 10, point.z),
      new THREE.Vector3(0, -1, 0));
    assert.ok(ray.intersectObject(shore).every((hit) => hit.point.y < point.level));
    assert.equal(ray.intersectObject(road).length, 0, '原低路面必须真正移除，不能藏在水底');
  }
  for (const z of [-220, -170]) {
    assert.ok(new THREE.Raycaster(new THREE.Vector3(819, 10, z),
      new THREE.Vector3(0, -1, 0)).intersectObject(road).length > 0);
  }
  shore.geometry.dispose(); road.geometry.dispose();
});

test('支渠共用断面、保持向上法线与UV，不为每段创建独立网格', () => {
  const geometries = channelGeometries(longshouSamples(), profile);
  let triangles = 0;
  for (const [name, shape] of Object.entries(geometries)) {
    const p = shape.getAttribute('position'), n = shape.getAttribute('normal');
    assert.equal(p.count, shape.getAttribute('uv').count);
    assert.ok(Array.from(p.array).every(Number.isFinite));
    if (name !== 'skirts') {
      assert.ok(Array.from({ length: n.count }, (_, i) => n.getY(i)).every((y) => y > 0));
    }
    triangles += p.count / 3;
    shape.dispose();
  }
  const approach = longshouApproaches();
  triangles += approach.getAttribute('position').count / 3;
  assert.ok(triangles < 2600);
  approach.dispose();
  const { kit } = recordPalaces();
  assert.doesNotThrow(() => createLongshouInlet(kit));
});

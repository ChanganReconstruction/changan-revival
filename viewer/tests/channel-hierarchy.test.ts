import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CHANNEL_PROFILES } from '../src/world/channel-profiles.ts';
import { WESTERN_CHANNELS, WESTERN_CROSSINGS, westernSamples, westernRoadCut,
  westernRoadBoundaries, westernRoadLayout, westernRoadHeight,
  createWesternChannels } from '../src/world/western-channels.ts';
import { channelGeometries } from '../src/world/channel-geometry.ts';
import { terrainHeight, ribbonGeometry } from '../src/world/terrain.ts';
import { avenueDrainSamples } from '../src/world/avenue-drains.ts';
import type { LandmarkKit } from '../src/world/landmark-kit.ts';

const ray = (x: number, z: number) => new THREE.Raycaster(
  new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));

test('主渠、支渠与细沟断面宽深有级差，不把视觉尺寸冒充古代实测', () => {
  const { main, branch, drain } = CHANNEL_PROFILES;
  assert.ok(main.width > branch.width * 1.5 && branch.width > drain.width * 2);
  assert.ok(main.depth > branch.depth && branch.depth > drain.depth);
  for (const profile of Object.values(CHANNEL_PROFILES)) {
    assert.equal(profile.width, profile.section.halfWidth * 2);
    assert.equal(profile.depth, profile.section.depth);
    assert.ok(profile.section.outerOffset > profile.section.crestOffset);
  }
});

test('西部街段顺坡向北，水不埋入地形、不压坊墙，保留不同断面', () => {
  for (const channel of WESTERN_CHANNELS) {
    const profile = CHANNEL_PROFILES[channel.tier];
    const samples = westernSamples(channel);
    for (let i = 0; i < samples.length; i++) {
      const point = samples[i];
      assert.ok(point.level > terrainHeight(point.x, point.z) - 0.2);
      if (i) assert.ok(point.level <= samples[i - 1].level && point.z < samples[i - 1].z);
    }
    // 两条街的相邻坊墙边界分别为414/396、276/258，渠岸和人行路不能压墙。
    const [outerWall, innerWall] = channel.id === 'yongan' ? [-414, -396] : [-276, -258];
    assert.ok(channel.x - profile.section.outerOffset > outerWall + 0.5);
    const road = westernRoadLayout(channel.streetX);
    assert.ok(road.x + road.width / 2 < innerWall - 0.49);
    assert.ok(channel.x + profile.section.outerOffset < road.x - road.width / 2);
    const geometry = channelGeometries(samples, profile.section);
    for (const shape of Object.values(geometry)) {
      const position = shape.getAttribute('position'), normal = shape.getAttribute('normal');
      for (let n = 0; n < position.count; n++) {
        assert.ok(Number.isFinite(position.getY(n)) && Number.isFinite(normal.getY(n)));
      }
      assert.ok(shape.getAttribute('uv'));
      shape.dispose();
    }
  }
});

test('十八处过街桥下没有旧路面，桥面高于水，纵横接坡连续', () => {
  const blocks: Parameters<LandmarkKit['block']>[] = [];
  const shapes: THREE.BufferGeometry[] = [];
  const kit = { batches: { add: (geometry: THREE.BufferGeometry) => shapes.push(geometry) },
    block: (...args: Parameters<LandmarkKit['block']>) => blocks.push(args),
  } as unknown as LandmarkKit;
  createWesternChannels(kit);
  for (const channel of WESTERN_CHANNELS) for (const z of WESTERN_CROSSINGS) {
    const points = [-500, ...westernRoadBoundaries(), -200].sort((a, b) => a - b)
      .map((x) => [x, z] as [number, number]);
    const road = new THREE.Mesh(ribbonGeometry(points, 14,
      (x, rz) => westernRoadHeight(x, rz, 0.12), westernRoadCut));
    for (const dx of [-1, 0, 1]) assert.equal(ray(channel.x + dx, z).intersectObject(road).length, 0);
    const deck = blocks.find(([mat, x, , zz]) => mat === 'wood' && x === channel.x && zz === z)!;
    assert.ok(deck && deck[2] - deck[5] / 2 > channel.source);
    const layout = westernRoadLayout(channel.streetX);
    const heights = [0, 7, 12, 17].map((dz) => westernRoadHeight(layout.x, z + dz, 0.12));
    assert.ok(heights[0] === heights[1] && heights[1] > heights[2] && heights[2] > heights[3]);
    road.geometry.dispose();
  }
  assert.equal(shapes.length, 7, '两条渠各三份合并几何和一份共享桥侧裙');
  const triangles = shapes.reduce((sum, shape) => sum + shape.getAttribute('position').count / 3, 0);
  assert.ok(triangles < 5500);
  shapes.forEach((shape) => shape.dispose());
});

test('细沟在路面之下随原坡分区排水，不当作逆坡引水主渠', () => {
  for (const x of [-17.5, 17.5]) {
    const samples = avenueDrainSamples(x, terrainHeight);
    const geometry = channelGeometries(samples, CHANNEL_PROFILES.drain.section);
    for (const point of samples) assert.ok(point.level < terrainHeight(point.x, point.z) + 0.12);
    const mesh = new THREE.Mesh(geometry.water);
    assert.ok(ray(x, 150).intersectObject(mesh).length > 0);
    assert.equal(geometry.water.getAttribute('position').count / 3, 160);
    Object.values(geometry).forEach((shape) => shape.dispose());
  }
});

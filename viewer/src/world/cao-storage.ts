import * as THREE from 'three';
import type { LandmarkKit } from './landmark-kit';
import { sampleChannel, channelGeometries } from './channel-geometry.ts';

// 742年入金光门、供西市贮木有文献依据；潭址及涵口仅作局部示意。
export const CAO_STORAGE = {
  since: 742, x: -514, z: 261, width: 18, depth: 12, level: 0.7,
  source: '金光门方向；门至西市段省略', destination: '西市贮木潭',
  accuracy: '用途及年代有据，潭址、尺寸、进水口为艺术示意',
};

export function caoStorageGeometry(): THREE.BufferGeometry {
  const p = CAO_STORAGE;
  const geometry = new THREE.PlaneGeometry(p.width, p.depth);
  geometry.rotateX(-Math.PI / 2).translate(p.x, p.level, p.z);
  geometry.name = '742年西市贮木潭（位置推定）';
  geometry.userData = { channel: 'cao', since: p.since, complete: false,
    upstream: p.source, downstream: p.destination, accuracy: p.accuracy };
  return geometry;
}

export function caoStorageInlet() {
  const samples = sampleChannel([[-536.4, 261], [-530, 261], [-522, 261]], 0.8, 0.7, 24);
  return channelGeometries(samples, {
    halfWidth: 1.5, crestOffset: 1.75, outerOffset: 2, rise: 0.18, depth: 0.35,
  });
}

export function createCaoStorage(kit: LandmarkKit): void {
  const p = CAO_STORAGE;
  kit.batches.add(caoStorageGeometry(), 'water', 0, 0, 0);
  const inlet = caoStorageInlet();
  kit.batches.add(inlet.water, 'water', 0, 0, 0);
  kit.batches.add(inlet.banks, 'earth', 0, 0, 0);
  kit.batches.add(inlet.skirts, 'yard', 0, 0, 0);
  // 西侧留进水口，其他三边低岸；不画一条穿越住宅与原路面的假上游。
  for (const sign of [-1, 1]) {
    kit.block('stone', p.x, 0.68, p.z + sign * 6.3, 18.6, 0.5, 0.6);
  }
  kit.block('stone', -504.7, 0.68, p.z, 0.6, 0.5, 12.6);
  for (const sign of [-1, 1]) {
    kit.block('stone', -523.3, 0.68, p.z + sign * 4.1, 0.6, 0.5, 4.2);
  }
  // 圆木复用一份低面数几何，漂木与岸上货栈形成用途区别。
  const log = new THREE.CylinderGeometry(0.28, 0.32, 9, 6);
  log.rotateZ(Math.PI / 2);
  for (let i = 0; i < 7; i++) {
    kit.batches.add(log, 'wood', p.x + (i % 2) * 1.2, 0.87,
      p.z - 4.5 + i * 1.4, 1, 1, 1, (i % 3 - 1) * 0.06, '#c4a77a');
  }
}

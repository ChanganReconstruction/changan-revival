import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxGeometry, roofGeometry, type PrototypePart } from './architecture.ts';
import type { LandmarkKit } from './landmark-kit';

// 五门道有遗址依据；楼身高度、柱网和屋盖仅为可替换的艺术方案。
export const MINGDE_LAYOUT = {
  x: 0, z: 710, width: 55.5, depth: 17.5, doorWidth: 5, passageHeight: 8,
  pierWidth: (55.5 - 25) / 6, floor: 11.2,
};

export function mingdeDoorCenters(): number[] {
  const { width, pierWidth, doorWidth } = MINGDE_LAYOUT;
  return Array.from({ length: 5 }, (_, i) =>
    -width / 2 + pierWidth + doorWidth / 2 + i * (pierWidth + doorWidth));
}

export function mingdePrototype(): PrototypePart[] {
  const wood: THREE.BufferGeometry[] = [];
  const wall: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    const x = -26.1 + i * 5.8;
    for (const sign of [-1, 1]) wood.push(boxGeometry(x, 3.3, sign * 7, 0.65, 6.6, 0.65));
  }
  // 白墙内退、柱廊在外；暗开口常驻，远景也能读出门楼节奏。
  wall.push(boxGeometry(0, 3, 0, 49, 5.8, 10));
  for (let i = 0; i < 9; i++) {
    for (const sign of [-1, 1]) {
      dark.push(boxGeometry(-23.2 + i * 5.8, 3.1, sign * 5.05, 3, 3.8, 0.08));
      wood.push(boxGeometry(-23.2 + i * 5.8, 5.8, sign * 7, 5.8, 0.45, 0.55));
    }
  }
  const roof = roofGeometry('hip').scale(3.1, 1.5, 1.65).translate(0, 6.8, 0);
  const combine = (parts: THREE.BufferGeometry[]) => {
    const plain = parts.map((part) => part.index ? part.toNonIndexed() : part);
    const result = mergeGeometries(plain, false);
    if (!result) throw new Error('明德门构件合并失败');
    for (const part of new Set([...parts, ...plain])) part.dispose();
    return result;
  };
  return [
    { geometry: combine(wood), material: 'vermilion' },
    { geometry: combine(wall), material: 'wall' },
    { geometry: combine(dark), material: 'dark' },
    { geometry: roof, material: 'roof' },
  ];
}

export function createMingdeGate(kit: LandmarkKit): void {
  const p = MINGDE_LAYOUT;
  for (let i = 0; i < 6; i++) {
    const x = -p.width / 2 + p.pierWidth / 2 + i * (p.pierWidth + p.doorWidth);
    kit.block('earth', x, 4, p.z, p.pierWidth, 8, p.depth, 0, '#ded6c5');
  }
  kit.block('earth', 0, 9.5, p.z, p.width, 3, p.depth, 0, '#ded6c5');
  kit.block('paving', 0, 11.1, p.z, p.width, 0.2, p.depth);
  // 与既有68米墙口衔接；补侧墙而非把五门道挤进通用门楼。
  for (const sign of [-1, 1]) {
    kit.block('earth', sign * (34 + p.width / 2) / 2, 5.5, p.z,
      34 - p.width / 2, 11, 9);
  }
  for (const part of mingdePrototype()) {
    part.geometry.name = '明德门专属门楼';
    part.geometry.userData = { landmark: 'mingde', accuracy: '五门道有据，屋盖推定' };
    kit.batches.add(part.geometry, part.material, 0, p.floor, p.z);
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxGeometry, roofGeometry, type PrototypePart } from './architecture.ts';
import type { LandmarkKit } from './landmark-kit.ts';
import { DANFENG_AVENUE } from './northern-layout.ts';

// 五门道与墩台长宽比来自考古综述；楼身层高、柱网、屋盖是可替换的推定层。
export const DANFENG_LAYOUT = {
  x: DANFENG_AVENUE.x, z: DANFENG_AVENUE.north, floor: 15,
  doorCenters: [-40, -20, 0, 20, 40],
  pierCenters: [-50, -30, -10, 10, 30, 50],
  pierWidth: 8, depth: 48, passageHeight: 12,
  sourceBaseWidth: 74.5, sourceBaseDepth: 33,
} as const;

type Box = [number, number, number, number, number, number];

function boxes(parts: Box[]): THREE.BufferGeometry {
  const source = parts.map((part) => {
    const geometry = boxGeometry(...part);
    const normalized = geometry.toNonIndexed();
    geometry.dispose();
    return normalized;
  });
  const result = mergeGeometries(source, false);
  for (const geometry of source) geometry.dispose();
  if (!result) throw new Error('丹凤门构件合并失败');
  return result;
}

function galleryEave(): THREE.BufferGeometry {
  const outer = [[-63, 7.4, -28], [63, 7.4, -28],
    [63, 7.4, 28], [-63, 7.4, 28]];
  const inner = [[-51, 9, -17], [51, 9, -17],
    [51, 9, 17], [-51, 9, 17]];
  const positions: number[] = [], uvs: number[] = [];
  // 下檐留空而非再叠一座完整屋顶，避免上下层互穿。
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    for (const point of [outer[i], inner[j], outer[j], outer[i], inner[i], inner[j]]) {
      positions.push(...point);
      uvs.push(point[0] / 126 + 0.5, point[2] / 56 + 0.5);
    }
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shape.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  shape.computeVertexNormals();
  return shape;
}

export function danfengTowerPrototype(): PrototypePart[] {
  const frame: Box[] = [], walls: Box[] = [], openings: Box[] = [];
  const columnX = Array.from({ length: 12 }, (_, i) => -55 + i * 10);
  for (const x of columnX) {
    for (const z of [-23, 23]) frame.push([x, 3.55, z, 0.8, 7.1, 0.8]);
    for (const z of [-14, 14]) frame.push([x * 0.9, 4.3, z, 0.9, 8.6, 0.9]);
  }
  for (const z of [-23, 23]) frame.push([0, 7.2, z, 112, 0.4, 0.65]);
  for (const x of [-55, 55]) frame.push([x, 7.2, 0, 0.65, 0.4, 47]);
  for (const z of [-14, 14]) {
    frame.push([0, 8.7, z, 101, 0.5, 0.7]);
    walls.push([0, 4.35, z * 0.97, 100, 8.4, 0.4]);
    for (let bay = 0; bay < 11; bay++) {
      openings.push([-45 + bay * 9, 3.9, Math.sign(z) * 14.1, 5.4, 5.8, 0.08]);
    }
  }
  for (const x of [-50, 50]) {
    walls.push([x, 4.35, 0, 0.4, 8.4, 28]);
    for (const z of [-9, 0, 9]) openings.push([Math.sign(x) * 50.25, 3.9, z,
      0.08, 5.8, 5.2]);
  }
  // 檐廊与低栏形成门楼，不沿用普通住宅的台阶、山墙和五开间门窗。
  const rails: Box[] = [];
  for (const z of [-25, 25]) rails.push([0, 0.9, z, 118, 0.2, 0.3]);
  for (const x of [-59, 59]) rails.push([x, 0.9, 0, 0.3, 0.2, 50]);
  for (const x of columnX) {
    for (const z of [-25, 25]) rails.push([x, 0.45, z, 0.35, 0.9, 0.35]);
  }
  const roof = roofGeometry('hip').scale(5.6, 0.95, 2.75).translate(0, 9.1, 0);
  const ridge: Box[] = [[0, 12.48, 0, 61, 0.2, 0.35]];
  for (const x of [-30.5, 30.5]) ridge.push([x, 12.8, 0, 0.6, 1, 0.6]);
  return [
    { geometry: boxes(frame), material: 'vermilion' },
    { geometry: boxes(walls), material: 'wall' },
    { geometry: boxes(openings), material: 'dark' },
    { geometry: boxes(rails), material: 'wood' },
    { geometry: galleryEave(), material: 'roof' },
    { geometry: roof, material: 'roof' },
    { geometry: boxes(ridge), material: 'roof', tint: '#88a89b' },
  ];
}

export function createDanfengGate(kit: LandmarkKit): void {
  const plan = DANFENG_LAYOUT;
  const { block, batches } = kit;
  block('stone', plan.x, 0.35, plan.z, 130, 0.7, 56);
  // 六座实心门墩夹出五道真实贯通门洞；不以黑色贴片冒充洞口。
  for (const dx of plan.pierCenters) {
    block('stone', plan.x + dx, 1.35, plan.z, plan.pierWidth, 1.3, plan.depth);
    block('vermilion', plan.x + dx, 7.35, plan.z, plan.pierWidth, 10.7, plan.depth);
  }
  block('vermilion', plan.x, 13.85, plan.z, 108, 2.3, plan.depth);
  block('paving', plan.x, 15.08, plan.z, 120, 0.16, 52);
  for (const part of danfengTowerPrototype()) {
    batches.add(part.geometry, part.material, plan.x, plan.floor, plan.z,
      1, 1, 1, 0, part.tint);
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roofGeometry, type PrototypePart } from './architecture.ts';

type Box = [number, number, number, number, number, number];
type Point = [number, number, number];

// 依据复原论述区分主体十一间与周匝副阶；归一化尺寸不是遗址测绘坐标。
export const HANYUAN_LAYOUT = {
  coreBays: 11, depthBays: 4, outerBays: 13, outerDepthBays: 6,
  coreX: Array.from({ length: 12 }, (_, i) => -7.7 + i * 1.4),
  // 进深四间减去中央一排柱，不能据此改写为三间进深。
  coreZ: [-2.56, -1.28, 1.28, 2.56],
  outerX: [-9.1, ...Array.from({ length: 12 }, (_, i) => -7.7 + i * 1.4), 9.1],
  outerZ: [-3.76, -2.56, -1.28, 0, 1.28, 2.56, 3.76],
  floor: 0.45, coreColumnTop: 2.25, outerColumnTop: 1.7,
  lowerEave: 1.95, upperEave: 2.65,
} as const;

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized = parts.map((part) => part.index ? part.toNonIndexed() : part);
  const result = mergeGeometries(normalized, false);
  for (const part of new Set([...parts, ...normalized])) part.dispose();
  if (!result) throw new Error('宫殿构件合并失败');
  result.computeBoundingSphere();
  return result;
}

function boxes(items: Box[]): THREE.BufferGeometry {
  return merge(items.map(([x, y, z, w, h, d]) =>
    new THREE.BoxGeometry(w, h, d).translate(x, y, z)));
}

function posts(
  points: readonly Point[], radius: number, floor: number = HANYUAN_LAYOUT.floor,
): THREE.BufferGeometry {
  // 同规格八棱梭柱只复制变换，汇为一件常驻柱网，不逐柱创建 Mesh。
  const prototype = new THREE.CylinderGeometry(radius * 0.88, radius, 1, 8);
  const parts = points.map(([x, top, z]) => prototype.clone()
    .scale(1, top - floor, 1)
    .translate(x, (top + floor) / 2, z));
  prototype.dispose();
  return merge(parts);
}

function lowerEave(): THREE.BufferGeometry {
  const rings = [
    { x: 9.9, z: 4.75, y: 1.95 },
    { x: 9.0, z: 4.0, y: 2.18 },
    { x: 8.1, z: 3.1, y: 2.55 },
  ];
  const corners = ({ x, y, z }: typeof rings[number]): Point[] =>
    [[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z]];
  const positions: number[] = [], uvs: number[] = [];
  for (let ring = 0; ring < rings.length - 1; ring++) {
    const outer = corners(rings[ring]), inner = corners(rings[ring + 1]);
    for (let side = 0; side < 4; side++) {
      const next = (side + 1) % 4;
      const [a, b, c, d] = [outer[side], outer[next], inner[next], inner[side]];
      for (const p of [a, c, b, a, d, c]) {
        positions.push(...p);
        uvs.push(p[0] / 20 + 0.5, p[2] / 10 + 0.5);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function hanyuanPrototype(): PrototypePart[] {
  const plan = HANYUAN_LAYOUT;
  const mainPosts: Point[] = plan.coreX.flatMap((x) =>
    plan.coreZ.map((z) => [x, plan.coreColumnTop, z] as Point));
  const porchPosts: Point[] = [];
  for (const x of plan.outerX) {
    for (const z of [-3.76, 3.76]) porchPosts.push([x, plan.outerColumnTop, z]);
  }
  for (const x of [-9.1, 9.1]) {
    for (const z of plan.outerZ.slice(1, -1)) porchPosts.push([x, plan.outerColumnTop, z]);
  }
  const beams: Box[] = [];
  for (const z of [-2.56, 2.56]) beams.push([0, 2.39, z, 15.7, 0.28, 0.18]);
  for (const x of [-7.7, 7.7]) beams.push([x, 2.39, 0, 0.18, 0.28, 5.3]);
  for (const z of [-3.76, 3.76]) beams.push([0, 1.8, z, 18.5, 0.2, 0.18]);
  for (const x of [-9.1, 9.1]) beams.push([x, 1.8, 0, 0.18, 0.2, 7.7]);

  // 东、西、北墙与敞开的南面分开；没有第二层住宅式白墙楼身。
  const walls: Box[] = [
    [0, 1.45, -2.62, 15.6, 2, 0.18],
    [-7.76, 1.45, 0, 0.18, 2, 5.3], [7.76, 1.45, 0, 0.18, 2, 5.3],
    [-7, 1.45, 2.56, 1.4, 2, 0.16], [7, 1.45, 2.56, 1.4, 2, 0.16],
  ];
  const openings: Box[] = [];
  for (let bay = 0; bay < 11; bay++) {
    const x = -7 + bay * 1.4;
    openings.push([x, 1.35, 2.67, 1.06, 1.65, 0.04]);
    openings.push([x, 1.35, -2.72, 0.8, 1.35, 0.035]);
  }
  for (const x of [-7.86, 7.86]) {
    for (const z of [-1.7, 0, 1.7]) openings.push([x, 1.35, z, 0.035, 1.25, 0.8]);
  }
  const platforms: Box[] = [
    [0, 0.18, 0, 19.2, 0.36, 8.3],
    [0, 0.405, 0, 15.9, 0.09, 5.5],
  ];
  // 两处木阶上副阶，中央保持通透；细石栏与鸱尾是复原层，不冒充出土原貌。
  for (const x of [-4.2, 4.2]) {
    for (let step = 0; step < 3; step++) {
      platforms.push([x, 0.06 * (step + 1), 4.6 - step * 0.22,
        1.35, 0.12 * (step + 1), 0.24]);
    }
  }
  const bracketBoxes: Box[] = porchPosts.flatMap(([x, top, z]) => [
    [x, top + 0.08, z, 0.46, 0.1, 0.18] as Box,
    [x, top + 0.17, z, 0.25, 0.1, 0.5] as Box,
  ]);
  const ridge: Box[] = [[0, 3.99, 0, 9.7, 0.1, 0.13]];
  for (const x of [-4.9, 4.9]) ridge.push([x, 4.16, 0, 0.17, 0.4, 0.2]);
  // 只在局部脊饰用低饱和绿，主屋瓦仍沿用青灰共享材质。
  const upper = roofGeometry('hip').scale(0.88, 0.37, 0.64).translate(0, 2.65, 0);
  return [
    { geometry: boxes(platforms), material: 'stone' },
    { geometry: merge([posts(mainPosts, 0.095), posts(porchPosts, 0.072, 0.36), boxes(beams)]),
      material: 'vermilion' },
    { geometry: boxes(walls), material: 'wall' },
    { geometry: boxes(openings), material: 'dark' },
    { geometry: lowerEave(), material: 'roof' },
    { geometry: upper, material: 'roof' },
    { geometry: boxes(ridge), material: 'roof', tint: '#80a490' },
    { geometry: boxes(bracketBoxes), material: 'vermilion', detail: true },
  ];
}

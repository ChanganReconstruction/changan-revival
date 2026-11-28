import * as THREE from 'three';
import type { LandmarkKit } from './landmark-kit';
import { channelGeometries, sampleChannel } from './channel-geometry.ts';

// 文献约束的是通化门南入城、供兴庆龙池的方向，以下具体线位和便桥均为展示设计。
export const LONGSHOU_INLET = {
  channelId: 'longshou', wallX: 840, wallZ: -318, clearWidth: 12, clearHeight: 2.8,
  sourceLevel: 0.95, lakeLevel: 0.45,
  path: [[920, -345], [865, -318], [850, -318], [830, -318], [830, -290],
    [830, -220], [830, -201], [810, -188], [779, -171]],
  confidence: '西支供兴庆有文献依据，入口、渠宽和桥位为艺术示意',
} as const;
export const LONGSHOU_BRIDGE = { x: 819, north: -202, south: -185, width: 13, top: 1.65 };
export const longshouSamples = () => sampleChannel(
  LONGSHOU_INLET.path, LONGSHOU_INLET.sourceLevel, LONGSHOU_INLET.lakeLevel, 160,
);
const samples = longshouSamples();

export function longshouMouthCut(x: number, z: number): boolean {
  const px = x + 750, pz = z - 155;
  if (px < 771 || pz < -199 || pz > -164) return false;
  return samples.some((point) => point.z > -201 && Math.hypot(px - point.x, pz - point.z) < 5.5);
}

export function longshouRoadCut(x: number, z: number): boolean {
  const bridge = LONGSHOU_BRIDGE;
  return Math.abs(x - bridge.x) <= bridge.width / 2 + 0.01
    && z > bridge.north && z < bridge.south;
}

// 只把现有巡城路局部接上低桥，不改变路网走向，也不把道路面盖在渠水上。
export function longshouApproaches(): THREE.BufferGeometry {
  const vertices: number[] = [], uv: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    vertices.push(...a, ...d, ...b, ...b, ...d, ...c);
  };
  for (const [north, south, hn, hs] of [
    [-212, -202, 0.14, LONGSHOU_BRIDGE.top], [-185, -175, LONGSHOU_BRIDGE.top, 0.14],
  ]) {
    const left = 812.5, right = 825.5;
    const a = [left, hn, north], b = [right, hn, north];
    const c = [right, hs, south], d = [left, hs, south];
    quad(a, b, c, d);
    quad(a, d, [left, -0.3, south], [left, -0.3, north]);
    quad(c, b, [right, -0.3, north], [right, -0.3, south]);
  }
  const geometry = new THREE.BufferGeometry();
  for (let i = 0; i < vertices.length; i += 3) uv.push(vertices[i] / 16, vertices[i + 2] / 16);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function createLongshouInlet(kit: LandmarkKit): void {
  const geometry = channelGeometries(samples,
    { halfWidth: 2, crestOffset: 3, outerOffset: 4, rise: 0.45 });
  geometry.water.name = '龙首西支末段水面（示意）';
  geometry.water.userData = { channel: 'longshou', tier: 'branch', width: 4,
    upstream: '浐水方向；上游省略',
    downstream: '兴庆龙池', accuracy: LONGSHOU_INLET.confidence, complete: false };
  geometry.banks.name = '龙首西支末段两岸';
  geometry.skirts.name = '龙首西支末段岸脚';
  kit.batches.add(geometry.water, 'water', 0, 0, 0);
  kit.batches.add(geometry.banks, 'earth', 0, 0, 0, 1, 1, 1, 0, '#d2ccbc');
  kit.batches.add(geometry.skirts, 'yard', 0, 0, 0);
  const approaches = longshouApproaches();
  approaches.name = '龙首西支便桥接坡';
  kit.batches.add(approaches, 'road', 0, 0, 0);
  const { block } = kit;
  block('stone', 840, 2.95, -318, 10, 0.3, 14);
  // 木梁平桥仅解决模型道路过水，并非已核定的唐代遗址桥梁复原。
  block('wood', 819, 1.475, -193.5, 13, 0.35, 17);
  for (const x of [815, 823]) for (const z of [-202.5, -184.5]) {
    block('stone', x, 0.5, z, 0.9, 1.6, 0.9);
  }
  for (const x of [812.8, 825.2]) {
    for (const z of [-201.5, -193.5, -185.5]) block('wood', x, 2.1, z, 0.22, 0.9, 0.22);
    block('wood', x, 2.49, -193.5, 0.16, 0.12, 17);
  }
}

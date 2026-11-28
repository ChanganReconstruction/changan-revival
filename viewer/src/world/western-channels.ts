import * as THREE from 'three';
import type { LandmarkKit } from './landmark-kit';
import { CHANNEL_PROFILES, type ChannelTier } from './channel-profiles.ts';
import { channelGeometries, sampleChannel } from './channel-geometry.ts';

// 文献支持西部南来北去、永安邻西市；以下只画街段，位置和断面不冒充测绘。
export const WESTERN_CHANNELS = [
  { id: 'yongan', name: '永安渠', x: -408, streetX: -405, roadX: -400.25,
    roadWidth: 6.5, tier: 'main' as ChannelTier, source: 1.05, destination: 0.48 },
  { id: 'qingming', name: '清明渠', x: -270, streetX: -267, roadX: -264,
    roadWidth: 6, tier: 'branch' as ChannelTier, source: 0.9, destination: 0.42 },
] as const;
export const WESTERN_LIMITS = { south: 697, north: -250 };
export const WESTERN_CROSSINGS = Array.from({ length: 9 }, (_, i) => -163 + i * 106);
export const WESTERN_BRIDGE_TOP = 1.85;

export function westernRoadLayout(x: number): { x: number; width: number } {
  const channel = WESTERN_CHANNELS.find((reach) => reach.streetX === x);
  return channel ? { x: channel.roadX, width: channel.roadWidth } : { x, width: 13 };
}

// 仅裁横街过渠的实洞，纵街已让到渠东；调用方在洞口加入精确分段点。
export function westernRoadCut(x: number, z: number): boolean {
  return WESTERN_CHANNELS.some((channel) => {
    const half = CHANNEL_PROFILES[channel.tier].section.outerOffset;
    return Math.abs(x - channel.x) < half - 0.001
      && WESTERN_CROSSINGS.some((cross) => Math.abs(z - cross) <= 7.01);
  });
}

export function westernRoadBoundaries(): number[] {
  return WESTERN_CHANNELS.flatMap((channel) => {
    const half = CHANNEL_PROFILES[channel.tier].section.outerOffset;
    return [-half - 10, -half, half, half + 10].map((dx) => channel.x + dx);
  });
}

// 接坡同时照顾横街与相邻纵街，不能让桥接上横街却在路口挡住南北行路。
export function westernRoadHeight(x: number, z: number, base: number): number {
  let height = base;
  for (const channel of WESTERN_CHANNELS) {
    const half = CHANNEL_PROFILES[channel.tier].section.outerOffset;
    const edgeDistance = Math.max(0, Math.abs(x - channel.x) - half);
    const crossDistance = Math.min(...WESTERN_CROSSINGS.map((cross) => Math.abs(z - cross)));
    if (edgeDistance >= 10 || crossDistance >= 17) continue;
    const crossHeight = WESTERN_BRIDGE_TOP - (WESTERN_BRIDGE_TOP - 0.18) * edgeDistance / 10;
    const weight = Math.min(1, (17 - crossDistance) / 10);
    height = Math.max(height, base + (crossHeight - base) * weight);
  }
  return height;
}

export function westernSamples(channel: typeof WESTERN_CHANNELS[number]) {
  return sampleChannel([[channel.x, WESTERN_LIMITS.south],
    [channel.x, WESTERN_LIMITS.north]], channel.source, channel.destination, 160);
}

export function westernBridgeApproaches(): THREE.BufferGeometry {
  const positions: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    positions.push(...a, ...d, ...b, ...b, ...d, ...c);
  };
  for (const channel of WESTERN_CHANNELS) for (const z of WESTERN_CROSSINGS) {
    const half = CHANNEL_PROFILES[channel.tier].section.outerOffset;
    for (const side of [-1, 1]) {
      const edge = channel.x + side * half, end = edge + side * 10;
      const left = Math.min(edge, end), right = Math.max(edge, end);
      const yl = side < 0 ? 0.18 : WESTERN_BRIDGE_TOP;
      const yr = side < 0 ? WESTERN_BRIDGE_TOP : 0.18;
      // 顶面由连续道路带生成，这里只补侧裙，避免重复共面导致闪纹。
      quad([left, yl, z - 7], [left, -0.3, z - 7],
        [right, -0.3, z - 7], [right, yr, z - 7]);
      quad([right, yr, z + 7], [right, -0.3, z + 7],
        [left, -0.3, z + 7], [left, yl, z + 7]);
    }
    for (const side of [-1, 1]) {
      const x = channel.roadX + side * channel.roadWidth / 2;
      for (const direction of [-1, 1]) {
        const za = z + direction * 7, zb = z + direction * 17;
        const a = [x, westernRoadHeight(x, za, 0.12), za];
        const b = [x, westernRoadHeight(x, zb, 0.12), zb];
        quad(a, b, [x, -0.3, zb], [x, -0.3, za]);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const uv: number[] = [];
  for (let i = 0; i < positions.length; i += 3) uv.push(positions[i] / 16, positions[i + 2] / 16);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  geometry.name = '西部两渠过街接坡（艺术示意）';
  return geometry;
}

export function createWesternChannels(kit: LandmarkKit): void {
  for (const channel of WESTERN_CHANNELS) {
    const profile = CHANNEL_PROFILES[channel.tier];
    const geometries = channelGeometries(westernSamples(channel), profile.section);
    geometries.water.name = `${channel.name}街段水面（示意）`;
    geometries.water.userData = { channel: channel.id, tier: channel.tier,
      width: profile.width, depth: profile.depth, complete: false,
      upstream: '南来潏水水系；取水口及入城口省略',
      downstream: '北向宫苑；宫苑内续接省略',
      accuracy: '供水关系有文献依据，街段线位、尺寸及便桥为艺术示意' };
    kit.batches.add(geometries.water, 'water', 0, 0, 0);
    kit.batches.add(geometries.banks, 'earth', 0, 0, 0, 1, 1, 1, 0, '#d2ccbc');
    kit.batches.add(geometries.skirts, 'yard', 0, 0, 0);
    const half = profile.section.outerOffset;
    // 横街只在两岸搭低梁桥；桥墩留在岸外，水中不放堵死全断面的实心块。
    for (const z of WESTERN_CROSSINGS) {
      kit.block('wood', channel.x, WESTERN_BRIDGE_TOP - 0.15, z, half * 2, 0.3, 14);
      for (const side of [-1, 1]) {
        kit.block('stone', channel.x + side * (half + 0.4), 0.65, z, 0.6, 2.1, 14);
        const edge = z + side * 6.55;
        kit.block('wood', channel.x, WESTERN_BRIDGE_TOP + 0.85, edge, half * 2, 0.18, 0.22);
        for (const dx of [-half + 0.25, 0, half - 0.25]) {
          kit.block('wood', channel.x + dx, WESTERN_BRIDGE_TOP + 0.48, edge, 0.24, 0.96, 0.28);
        }
      }
    }
    // 两端收在短覆涵下，表示省略的上下游；不把断头渠说成已经接到水源。
    for (const z of [WESTERN_LIMITS.north, WESTERN_LIMITS.south]) {
      kit.block('paving', channel.x, 1.7, z, half * 2 + 1, 0.25, 5);
      for (const side of [-1, 1]) {
        kit.block('earth', channel.x + side * (half - 0.2), 0.65, z, 0.5, 1.85, 5);
      }
    }
  }
  kit.batches.add(westernBridgeApproaches(), 'road', 0, 0, 0);
}

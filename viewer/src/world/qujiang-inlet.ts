import type { LandmarkKit } from './landmark-kit';
import { channelGeometries, channelWallSegments, sampleChannel } from './channel-geometry.ts';
import type { ChannelSample } from './channel-geometry.ts';

// 仅示意黄渠由城外东南入曲江的末段，不是考古线位或完整渠长。
// 涵口与宽深均为城市压缩后的设计；上游水源和池水外溢路线尚未落图。
export const HUANG_INLET = {
  channelId: 'huang', confidence: '走向有文献依据，渠口线位与尺寸为艺术示意',
  wallX: 716, wallZ: 710, clearWidth: 10, clearHeight: 2.8,
  lakeLevel: 0.45, sourceLevel: 0.95, width: 6,
  path: [[760, 900], [744, 830], [716, 755], [716, 710], [724, 690], [734, 667]],
} as const;

export type InletSample = ChannelSample;
export function inletSamples(): InletSample[] {
  return sampleChannel(HUANG_INLET.path, HUANG_INLET.sourceLevel, HUANG_INLET.lakeLevel);
}
const samples = inletSamples();

// 岸线生成器使用曲江局部坐标；只让水口附近的土岸与草岸留空，不改整条岸线。
export function inletMouthCut(x: number, z: number): boolean {
  const px = x + 689, pz = z + 593;
  if (pz < 655 || pz > 700) return false;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (a.z > 710 || b.z < 650) continue;
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz)
      / (dx * dx + dz * dz)));
    if (Math.hypot(px - a.x - dx * t, pz - a.z - dz * t) < 7.3) return true;
  }
  return false;
}

export function inletGeometries() {
  return channelGeometries(samples, { halfWidth: 3, crestOffset: 4.8, outerOffset: 7, rise: 0.55 });
}

export function inletWallSegments(start: number, end: number) {
  return channelWallSegments(start, end,
    HUANG_INLET.wallX, HUANG_INLET.clearWidth, HUANG_INLET.clearHeight);
}

export function createQujiangInlet(kit: LandmarkKit) {
  const geometry = inletGeometries();
  geometry.water.name = '黄渠末段水面（示意）';
  geometry.water.userData = { channel: 'huang', tier: 'main', width: 6,
    accuracy: HUANG_INLET.confidence,
    upstream: '义谷水方向；上游省略', downstream: '曲江', complete: false };
  geometry.banks.name = '黄渠末段两岸';
  geometry.skirts.name = '黄渠末段岸脚';
  kit.batches.add(geometry.water, 'water', 0, 0, 0);
  kit.batches.add(geometry.banks, 'earth', 0, 0, 0, 1, 1, 1, 0, '#d2ccbc');
  kit.batches.add(geometry.skirts, 'yard', 0, 0, 0);
  // 涵道是示意性过水构造，不增一座外郭城门，也不堵塞已有三门。
  kit.block('stone', HUANG_INLET.wallX, HUANG_INLET.clearHeight + 0.15,
    HUANG_INLET.wallZ, HUANG_INLET.clearWidth + 2, 0.3, 10);
}

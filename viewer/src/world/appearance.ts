import type { PrototypePart } from './architecture.ts';

export type Proportion = 'dwelling' | 'ceremonial';

// 重点游览坊保留近景构件；其余坊只画屋面、墙体和常驻立面贴图。
export const APPEARANCE_SAMPLES = new Set([
  'E2-8', 'E1-7', 'E1-5', 'E3-1', 'E3-2', 'E4-9', 'E1-3', 'E5-6', 'W1-5',
]);

export function elevationForAppearance(y: number, profile: Proportion): number {
  if (y <= 0.9) return y;
  const wallTop = profile === 'dwelling' ? 6.5 : 7.1;
  const eave = wallTop + 0.32;
  const rise = profile === 'dwelling' ? 4.15 : 4.35;
  if (y <= 5.4) return 0.9 + (y - 0.9) * (wallTop - 0.9) / 4.5;
  if (y <= 5.72) return wallTop + (y - 5.4);
  return eave + (y - 5.72) * rise / 3.5;
}

const geometryCache = new WeakMap<PrototypePart['geometry'],
  Map<string, PrototypePart['geometry']>>();

export function proportionPrototype(
  parts: PrototypePart[], profile: Proportion, roofRatio = 1,
): PrototypePart[] {
  return parts.map((part) => {
    // 台基完全不变；同一源构件的比例变体只建立一次，跨屋顶仍共用墙和窗面。
    if (part.material === 'stone') return { ...part };
    let variants = geometryCache.get(part.geometry);
    if (!variants) {
      variants = new Map();
      geometryCache.set(part.geometry, variants);
    }
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    const ratio = part.geometry.boundingBox!.max.y > 5.72 ? roofRatio : 1;
    const key = `${profile}:${ratio}`;
    let geometry = variants.get(key);
    if (!geometry) {
      geometry = part.geometry.clone();
      const positions = geometry.getAttribute('position');
      const eave = elevationForAppearance(5.72, profile);
      for (let i = 0; i < positions.count; i++) {
        const y = elevationForAppearance(positions.getY(i), profile);
        // 屋盖坡度随进深而非柱高走，禁止把深檐缓坡拉成高耸尖屋顶。
        positions.setY(i, y > eave ? eave + (y - eave) * ratio : y);
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      variants.set(key, geometry);
    }
    return { ...part, geometry };
  });
}

export function districtAppearance(id: string, family: string, x: number, z: number) {
  // 街区底色占主导，少数修缮差异落到单栋；不把全城随机染成彩色棋盘。
  const seed = Array.from(id).reduce((value, char) => value * 31 + char.charCodeAt(0), 7);
  const patch = Math.abs(Math.floor(x / 32) * 13 + Math.floor(z / 24) * 7);
  const index = Math.abs(seed + (patch % 5 === 0 ? 1 : 0)) % 4;
  const roof = ['#9faeb9', '#bbc1bd', '#b8ae9e', '#9eb7b2'][index];
  const wall = ['#e6d8bd', '#efe4cf', '#d7c6a6', '#e6dfce'][index];
  const formal = ['temple', 'manor', 'office'].includes(family);
  return {
    roof: formal ? ['#a4b2b8', '#bcc5c5', '#afbab5', '#a5b9b3'][index] : roof,
    wall: formal ? '#fff0da' : wall,
    wood: formal ? '#edc3a5' : '#d7bea0',
  };
}

export function tintWardPrototype(parts: PrototypePart[], id: string, family: string,
  x: number, z: number): PrototypePart[] {
  const colors = districtAppearance(id, family, x, z);
  return parts.map((part) => ({ ...part, tint: part.material === 'roof'
    ? colors.roof : part.material === 'wall' || part.material === 'facade'
      ? colors.wall : part.material === 'wood' || part.material === 'vermilion'
        ? colors.wood : undefined }));
}

// 只在同一灰瓦色域内区分冷灰、旧瓦暖灰与青灰；不是唐代屋瓦考古定色。
export function sampleRoofTint(x: number, z: number): string {
  const index = Math.abs(Math.round(x * 17 + z * 31)) % 4;
  return ['#d0dae0', '#e2d9c8', '#b2c7c5', '#c5ced8'][index];
}

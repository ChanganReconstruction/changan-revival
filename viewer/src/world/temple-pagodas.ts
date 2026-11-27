import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxGeometry, type PrototypePart } from './architecture.ts';
import type { LandmarkKit } from './landmark-kit';

export type PagodaKind = 'dayan' | 'xiaoyan';
export interface PagodaLevel { y: number; height: number; bottom: number; top: number }
export const PAGODAS = {
  dayan: { x: 474, z: 632, floors: 7, height: 66, width: 22,
    note: '七层识别方案；武周至五代层数有异说，不作盛唐实测断言' },
  xiaoyan: { x: 80, z: -4, floors: 15, height: 48, width: 15,
    note: '原十五层密檐轮廓；总高、间距与刹顶艺术处理' },
} as const;

export function pagodaLevels(kind: PagodaKind): PagodaLevel[] {
  const p = PAGODAS[kind];
  let y = 1;
  const weights = Array.from({ length: p.floors - 1 }, (_, i) => 1 - i * 0.025);
  const total = weights.reduce((a, b) => a + b, 0);
  return Array.from({ length: p.floors }, (_, i) => {
    const height = kind === 'dayan' ? p.height / p.floors
      : i === 0 ? 12 : (p.height - 12) * weights[i - 1] / total;
    const taper = (t: number) => p.width * (1 - 0.7 * Math.pow(t / p.floors, 0.85));
    const result = { y, height, bottom: taper(i), top: taper(i + 1) };
    y += height;
    return result;
  });
}

// 一份方锥台替代等宽方盒；檐口用出涩砖层，不给砖塔逐层套住宅瓦顶。
function taperedBody(level: PagodaLevel): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const points = geometry.getAttribute('position');
  for (let i = 0; i < points.count; i++) {
    const t = points.getY(i) + 0.5;
    const width = THREE.MathUtils.lerp(level.bottom, level.top, t);
    points.setXYZ(i, points.getX(i) * width,
      level.y + t * level.height, points.getZ(i) * width);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function windowPanel(
  level: PagodaLevel, width: number, height: number, sign: number,
  side = false, centerFraction = 0.48,
): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(width, height);
  const points = geometry.getAttribute('position');
  for (let i = 0; i < points.count; i++) {
    const y = level.y + level.height * centerFraction + points.getY(i);
    const t = (y - level.y) / level.height;
    const surface = THREE.MathUtils.lerp(level.bottom, level.top, t) / 2 + 0.06;
    const u = points.getX(i) * sign;
    points.setXYZ(i, side ? sign * surface : u, y, side ? -u : sign * surface);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function pagodaPrototype(kind: PagodaKind): PrototypePart[] {
  const body: THREE.BufferGeometry[] = [];
  const detail: THREE.BufferGeometry[] = [];
  const openings: THREE.BufferGeometry[] = [];
  const levels = pagodaLevels(kind);
  for (const [i, level] of levels.entries()) {
    body.push(taperedBody(level));
    for (let step = 0; step < 3; step++) {
      const width = level.top + 0.6 + step * 0.35;
      detail.push(boxGeometry(0, level.y + level.height - 0.6 + step * 0.2,
        0, width, 0.2, width));
    }
    const surface = THREE.MathUtils.lerp(level.bottom, level.top, 0.48) / 2 + 0.06;
    const openingH = i === 0 ? 4
      : kind === 'dayan' ? level.height * 0.4 : Math.min(1.5, level.height * 0.5);
    // 首层券门落到台面，不把全部开口均匀放在半墙高处。
    const centerFraction = i === 0 ? 2 / level.height : 0.48;
    // 小塔南北券窗、无四面木构隐柱；大塔以四面开口和隐柱强化楼阁式。
    for (const sign of [-1, 1]) {
      openings.push(windowPanel(level, kind === 'dayan' ? 1.7 : 1,
        openingH, sign, false, centerFraction));
      if (kind === 'dayan') {
        openings.push(windowPanel(level, 1.7, openingH, sign, true, centerFraction));
        for (const offset of [-0.32, 0.32]) {
          detail.push(boxGeometry(offset * level.top, level.y + level.height / 2,
            sign * surface, 0.24, level.height - 0.7, 0.22));
          detail.push(boxGeometry(sign * surface, level.y + level.height / 2,
            offset * level.top, 0.22, level.height - 0.7, 0.24));
        }
      }
    }
    // 层次信息写在几何上，供集成检查区分密檐与楼阁，不逐层创建Mesh。
    if (i === 0) body[0].userData.kind = kind;
  }
  const top = levels.at(-1)!;
  const finial = new THREE.CylinderGeometry(0.12, 0.55, 3, 6);
  finial.translate(0, top.y + top.height + 1.5, 0);
  detail.push(finial);
  const merge = (parts: THREE.BufferGeometry[]) => {
    const normalized = parts.map((part) => part.index ? part.toNonIndexed() : part);
    const result = mergeGeometries(normalized, false);
    if (!result) throw new Error('砖塔共享构件合并失败');
    for (const part of new Set([...parts, ...normalized])) part.dispose();
    result.name = kind === 'dayan' ? '大雁塔·楼阁式' : '小雁塔·十五层密檐';
    result.userData = { landmark: kind, floors: levels.length, accuracy: PAGODAS[kind].note };
    return result;
  };
  return [
    { geometry: merge(body), material: 'wall', tint: '#cfc5b3' },
    { geometry: merge(detail), material: 'stone', tint: '#d3c8b5' },
    { geometry: merge(openings), material: 'dark' },
  ];
}

export function createTemplePagodas(kit: LandmarkKit): void {
  for (const kind of ['dayan', 'xiaoyan'] as const) {
    const p = PAGODAS[kind];
    kit.block('paving', p.x, 0.2, p.z, 68, 0.4, 76);
    for (const part of pagodaPrototype(kind)) {
      kit.batches.add(part.geometry, part.material, p.x, 0, p.z,
        1, 1, 1, 0, part.tint);
    }
    // 保持旧树位与随机数消费顺序，不藉地标更新重画田草或移动林木。
    for (const sign of [-1, 1]) kit.tree(p.x + sign * 26, p.z + 26, 1.2);
  }
}

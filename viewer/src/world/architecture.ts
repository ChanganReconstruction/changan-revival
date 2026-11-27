import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MaterialKey } from '../render/materials';

export type RoofKind = 'gable' | 'hip' | 'pyramid' | 'hipgable';
export interface PrototypePart {
  geometry: THREE.BufferGeometry;
  material: MaterialKey;
  detail?: boolean;
  tint?: string;
}

const cube = new THREE.BoxGeometry(1, 1, 1);

export function boxGeometry(
  x: number, y: number, z: number, w: number, h: number, d: number,
): THREE.BufferGeometry {
  return cube.clone().scale(w, h, d).translate(x, y, z);
}

// 立面按 x 方向延伸，屋面分段折坡并保持统一位置、法线和 UV 属性。
export function roofGeometry(kind: RoofKind): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const emit = (a: number[], b: number[], c: number[]) => {
    const ab = b.map((v, i) => v - a[i]);
    const ac = c.map((v, i) => v - a[i]);
    const normalY = ab[2] * ac[0] - ab[0] * ac[2];
    const tri = normalY < 0 ? [a, c, b] : [a, b, c];
    for (const point of tri) {
      positions.push(...point);
      uvs.push(point[0] / 20 + 0.5, point[2] / 13 + 0.5);
    }
  };
  const tri = (a: number[], b: number[], c: number[]) => emit(a, b, c);
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    tri(a, b, c); tri(a, c, d);
  };
  const eaves = [-6.5, -3.25, 0, 3.25, 6.5];
  const heights = [0, 1.9, 3.5, 1.9, 0];
  const hipX = [10, 7.7, 5.4, 7.7, 10];
  const hipgableX = [10, 7.7, 7.7, 7.7, 10];

  if (kind === 'pyramid') {
    const corners = [[-10, 0, -6.5], [10, 0, -6.5],
      [10, 0, 6.5], [-10, 0, 6.5]];
    for (let i = 0; i < 4; i++) tri(corners[i], corners[(i + 1) % 4], [0, 3.5, 0]);
  } else {
    for (let i = 0; i < 4; i++) {
      const z0 = eaves[i];
      const z1 = eaves[i + 1];
      const y0 = heights[i];
      const y1 = heights[i + 1];
      const x0 = kind === 'hip' ? hipX[i]
        : kind === 'hipgable' ? hipgableX[i] : 10;
      const x1 = kind === 'hip' ? hipX[i + 1]
        : kind === 'hipgable' ? hipgableX[i + 1] : 10;
      // 每段横跨屋脊方向铺完整坡面，x轴始终沿屋脊延伸。
      quad([-x0, y0, z0], [x0, y0, z0],
        [x1, y1, z1], [-x1, y1, z1]);
    }
    if (kind === 'hip' || kind === 'hipgable') {
      // 封头与中段折坡边界共用顶点，底部四坡和上部封顶不留缝。
      for (const sign of [-1, 1]) {
        const midX = kind === 'hip' ? 7.7 : 7.7;
        quad([sign * 10, 0, -6.5], [sign * 10, 0, 6.5],
          [sign * midX, 1.9, 3.25], [sign * midX, 1.9, -3.25]);
        if (kind === 'hip') {
          tri([sign * 7.7, 1.9, -3.25], [sign * 7.7, 1.9, 3.25],
            [sign * 5.4, 3.5, 0]);
        } else {
          tri([sign * 7.7, 1.9, -3.25], [sign * 7.7, 1.9, 3.25],
            [sign * 7.7, 3.5, 0]);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized = parts.map((part) => part.index ? part.toNonIndexed() : part);
  const result = mergeGeometries(normalized, false);
  if (!result) throw new Error('建筑原型合并失败');
  for (const part of new Set([...parts, ...normalized])) part.dispose();
  result.computeBoundingSphere();
  return result;
}

function facadeGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    for (const [point, uv] of [[a, [0, 0]], [b, [1, 0]], [c, [1, 1]],
      [a, [0, 0]], [c, [1, 1]], [d, [0, 1]]] as [number[], number[]][]) {
      positions.push(...point);
      uvs.push(...uv);
    }
  };
  quad([-8.02, 0.8, 3.97], [8.02, 0.8, 3.97],
    [8.02, 5.3, 3.97], [-8.02, 5.3, 3.97]);
  quad([8.02, 0.8, -4.37], [-8.02, 0.8, -4.37],
    [-8.02, 5.3, -4.37], [8.02, 5.3, -4.37]);
  quad([8.02, 0.8, 3.97], [8.02, 0.8, -4.37],
    [8.02, 5.3, -4.37], [8.02, 5.3, 3.97]);
  quad([-8.02, 0.8, -4.37], [-8.02, 0.8, 3.97],
    [-8.02, 5.3, 3.97], [-8.02, 5.3, -4.37]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

export function hallPrototype(kind: RoofKind, formal = false): PrototypePart[] {
  const stone = [boxGeometry(0, 0.45, 0, 18.8, 0.9, 11.8)];
  for (let i = 0; i < 3; i++) {
    stone.push(boxGeometry(0, 0.14 + i * 0.12, 6.7 - i * 0.4,
      4, 0.28 + i * 0.24, 0.5));
  }
  const wall = [boxGeometry(0, 3.1, -0.2, 16, 4.6, 8.3)];
  if (kind === 'gable' || kind === 'hipgable') {
    const shape = new THREE.Shape();
    const half = kind === 'hipgable' ? 3.2 : 4.4;
    const rise = kind === 'hipgable' ? 1.55 : 3;
    const end = kind === 'hipgable' ? 7.68 : 8;
    const base = kind === 'hipgable' ? 7.62 : 5.4;
    shape.moveTo(-half, 0); shape.lineTo(0, rise); shape.lineTo(half, 0);
    shape.closePath();
    const gable = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
    // 歇山山花收在上部垂直端面，不能沿用悬山的大三角穿透折坡。
    gable.rotateY(Math.PI / 2).translate(-end, base, 0);
    wall.push(gable, gable.clone().translate(end * 2 - 0.18, 0, 0));
  }
  const frame: THREE.BufferGeometry[] = [];
  const details: THREE.BufferGeometry[] = [];
  for (let bay = 0; bay <= 5; bay++) {
    const x = -8 + bay * 3.2;
    for (const z of [-4.8, 4.8]) {
      const column = new THREE.CylinderGeometry(0.18, 0.23, 4.6, 4);
      column.translate(x, 3.15, z);
      details.push(column);
    }
  }
  frame.push(boxGeometry(0, 5.35, 0, 18.7, 0.4, 11));
  frame.push(boxGeometry(0, 5.62, 0, 19.3, 0.15, 11.9));
  const roof = roofGeometry(kind).translate(0, 5.72, 0);
  const ridgeLength = kind === 'pyramid' ? 0.38 : kind === 'hip' ? 11.2
    : kind === 'hipgable' ? 15.6 : 20;
  const ridge = boxGeometry(0, 9.3, 0, ridgeLength, 0.16, 0.28);
  const roofs = [roof, ridge];
  if (formal) frame.push(boxGeometry(0, 1.1, 4.08, 16, 0.22, 0.22));

  // 门窗图集面常驻；梁柱只作为近景细节生成，远景仍能读到开口节奏。
  return [
    { geometry: merged(stone), material: 'stone' },
    { geometry: merged(wall), material: 'wall' },
    { geometry: facadeGeometry(), material: 'facade' },
    { geometry: merged(roofs), material: 'roof' },
    { geometry: merged(frame), material: formal ? 'vermilion' : 'wood', detail: true },
    { geometry: merged(details), material: formal ? 'vermilion' : 'wood', detail: true },
  ];
}

// 下层只保留环形挑檐，二层从开口中起建，禁止把完整屋顶塞进上层墙身。
export function towerPrototype(kind: RoofKind = 'pyramid'): PrototypePart[] {
  const lower = hallPrototype(kind, true);
  const upper = hallPrototype('hipgable', true);
  const positions: number[] = [];
  const uvs: number[] = [];
  const outer = [[-10, 5.72, -6.5], [10, 5.72, -6.5],
    [10, 5.72, 6.5], [-10, 5.72, 6.5]];
  const inner = [[-6.2, 7, -3.4], [6.2, 7, -3.4],
    [6.2, 7, 3.4], [-6.2, 7, 3.4]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    for (const p of [outer[i], inner[j], outer[j], outer[i], inner[i], inner[j]]) {
      positions.push(...p); uvs.push(p[0] / 20 + 0.5, p[2] / 13 + 0.5);
    }
  }
  const eave = new THREE.BufferGeometry();
  eave.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  eave.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  eave.computeVertexNormals();
  const parts = lower.map((part) => {
    if (part.material === 'roof') { part.geometry.dispose(); part.geometry = eave; }
    return part;
  });
  for (const part of upper) {
    if (part.material === 'stone') { part.geometry.dispose(); continue; }
    part.geometry.scale(0.76, 0.76, 0.76).translate(0, 6.4, 0);
    parts.push(part);
  }
  return parts;
}

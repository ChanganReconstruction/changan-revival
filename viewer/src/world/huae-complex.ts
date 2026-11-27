import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxGeometry, roofGeometry, type PrototypePart } from './architecture.ts';
import type { LandmarkKit } from './landmark-kit.ts';

// 依据书摘图二的“两层长翼＋三层主楼”关系，非遗址实测尺寸或唯一复原。
export const HUAE_LAYOUT = {
  x: 725, z: -102, floor: 0.8,
  levels: [
    { x: 0, base: 0, eave: 9.6, width: 56, depth: 24, bays: 14 },
    { x: 0, base: 11.2, eave: 20, width: 56, depth: 24, bays: 14 },
    { x: 15, base: 22.2, eave: 28.6, width: 22, depth: 17, bays: 6 },
  ],
} as const;

type Box = [number, number, number, number, number, number];

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized = parts.map((part) => part.index ? part.toNonIndexed() : part);
  const result = mergeGeometries(normalized, false);
  for (const part of new Set([...normalized, ...parts])) part.dispose();
  if (!result) throw new Error('花萼楼构件合并失败');
  return result;
}

function boxes(parts: Box[]): THREE.BufferGeometry {
  return merge(parts.map((part) => boxGeometry(...part)));
}

// 檐圈内部真正挖空，让上一层墙身接入，不堆叠完整屋顶后再用墙穿过去。
function eaveRing(
  cx: number, outerW: number, outerD: number, innerW: number, innerD: number,
  outerY: number, innerY: number,
): THREE.BufferGeometry {
  const outer = [[cx - outerW / 2, outerY, -outerD / 2],
    [cx + outerW / 2, outerY, -outerD / 2],
    [cx + outerW / 2, outerY, outerD / 2],
    [cx - outerW / 2, outerY, outerD / 2]];
  const inner = [[cx - innerW / 2, innerY, -innerD / 2],
    [cx + innerW / 2, innerY, -innerD / 2],
    [cx + innerW / 2, innerY, innerD / 2],
    [cx - innerW / 2, innerY, innerD / 2]];
  const positions: number[] = [], uv: number[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    for (const p of [outer[i], inner[j], outer[j], outer[i], inner[i], inner[j]]) {
      positions.push(...p);
      uv.push(p[0] / 66 + 0.5, p[2] / 32 + 0.5);
    }
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  result.computeVertexNormals();
  return result;
}

export function huaePrototype(): PrototypePart[] {
  const beams: Box[] = [], walls: Box[] = [], windows: Box[] = [], rails: Box[] = [];
  const columns: THREE.BufferGeometry[] = [], grilles: THREE.BufferGeometry[] = [];
  const column = new THREE.CylinderGeometry(0.9, 1, 1, 8);
  const strip = new THREE.PlaneGeometry(1, 1);
  // 窗棂用朝向正确的平面条而非大量细盒，近景有结构而不显著增加三角面。
  const grille = (x: number, y: number, z: number, w: number, h: number,
    axis: 'x' | 'z', sign: number) => {
    const angle = axis === 'x' ? sign * Math.PI / 2 : sign < 0 ? Math.PI : 0;
    for (const dx of [-w / 6, w / 6]) {
      grilles.push(strip.clone().scale(0.12, h, 1).rotateY(angle)
        .translate(x + (axis === 'z' ? dx : sign * 0.04), y,
          z + (axis === 'x' ? dx : sign * 0.04)));
    }
    grilles.push(strip.clone().scale(w, 0.12, 1).rotateY(angle)
      .translate(x + (axis === 'x' ? sign * 0.04 : 0), y,
        z + (axis === 'z' ? sign * 0.04 : 0)));
  };
  for (const level of HUAE_LAYOUT.levels) {
    const { x: cx, base, eave, width, depth, bays } = level;
    const height = eave - base;
    for (let i = 0; i <= bays; i++) {
      const x = cx - width / 2 + i * width / bays;
      for (const z of [-depth / 2, depth / 2]) {
        columns.push(column.clone().scale(0.28, height, 0.28)
          .translate(x, base + height / 2, z));
        rails.push([x, base + 0.55, z - Math.sign(z) * 0.35, 0.18, 1.1, 0.18]);
      }
    }
    for (const z of [-depth / 2, depth / 2]) {
      beams.push([cx, eave - 0.12, z, width + 0.5, 0.35, 0.45]);
      rails.push([cx, base + 1.05, z - Math.sign(z) * 0.35, width, 0.16, 0.2]);
    }
    const wx = width / 2 - 0.7, wz = depth / 2 - 2.2;
    for (const z of [-wz, wz]) {
      walls.push([cx, base + height / 2, z, wx * 2, height - 0.3, 0.25]);
      for (let i = 0; i < bays; i++) {
        const x = cx - wx + (i + 0.5) * wx * 2 / bays;
        const frontZ = z + Math.sign(z) * 0.18;
        const windowW = wx * 2 / bays * 0.62, windowH = height * 0.57;
        windows.push([x, base + height * 0.52, frontZ, windowW, windowH, 0.06]);
        grille(x, base + height * 0.52, frontZ, windowW, windowH, 'z', Math.sign(z));
      }
    }
    for (const x of [cx - wx, cx + wx]) {
      walls.push([x, base + height / 2, 0, 0.25, height - 0.3, wz * 2]);
      for (const z of [-wz * 0.65, 0, wz * 0.65]) {
        const sign = Math.sign(x - cx), sideX = x + sign * 0.18;
        windows.push([sideX, base + height * 0.52, z, 0.06, height * 0.57, wz * 0.42]);
        grille(sideX, base + height * 0.52, z, wz * 0.42, height * 0.57, 'x', sign);
      }
      beams.push([x, eave - 0.12, 0, 0.4, 0.35, depth]);
    }
    // 楼板留在檐圈孔内，不以整块高木盒封住柱窗。
    beams.push([cx, base + 0.08, 0, width, 0.16, depth]);
  }
  column.dispose();
  strip.dispose();
  const roofs = [
    eaveRing(0, 64, 32, 56, 24, 9.6, 11.2),
    eaveRing(15, 34, 32, 22, 17, 20, 22.2),
    roofGeometry('hip').scale(1.5, 0.7, 32 / 13).translate(-17, 20, 0),
    roofGeometry('hip').scale(1.5, 1.25, 25 / 13).translate(15, 28.8, 0),
  ];
  // 长翼屋盖在 x=-2 接主楼檐圈；上层墙脚与檐圈内缘同高，接缝不悬空。
  const ridges: Box[] = [[15, 33.22, 0, 16.5, 0.2, 0.3],
    [-17, 22.5, 0, 16.6, 0.18, 0.3]];
  for (const x of [6.7, 23.3]) ridges.push([x, 33.6, 0, 0.4, 0.9, 0.4]);
  return [
    { geometry: merge([...columns, boxes(beams)]), material: 'vermilion' },
    { geometry: boxes(walls), material: 'wall' },
    { geometry: boxes(windows), material: 'dark' },
    { geometry: merge([boxes(rails), ...grilles]), material: 'wood' },
    { geometry: merge(roofs), material: 'roof' },
    { geometry: boxes(ridges), material: 'roof', tint: '#85a595' },
  ];
}

export function createHuaeComplex(kit: LandmarkKit): void {
  const { x, z, floor } = HUAE_LAYOUT;
  kit.block('stone', x, 0.35, z, 68, 0.7, 38);
  kit.block('paving', x, 0.75, z, 64, 0.1, 34);
  for (const part of huaePrototype()) {
    kit.batches.add(part.geometry, part.material, x, floor, z,
      1, 1, 1, 0, part.tint);
  }
}

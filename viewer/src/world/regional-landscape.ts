import * as THREE from 'three';
import { WEI_DISPLAY_PATH } from './geography.ts';

// 南侧是终南山连续山体；北侧只留低缓远塬，不再用随机高山围成一圈。
export function mountainGeometry(side: 'south' | 'north'): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const columns = 72, cross = [0, 0.38, 1, 0.55, 0];
  const layers = side === 'south' ? 3 : 1;
  for (let layer = 0; layer < layers; layer++) {
    const base = positions.length / 3;
    const color = new THREE.Color(side === 'south'
      ? ['#718b84', '#8fa5a0', '#a7b8b4'][layer] : '#b3beb1');
    for (let row = 0; row < cross.length; row++) {
      for (let col = 0; col <= columns; col++) {
        const x = -9000 + col * 18000 / columns;
        const taper = Math.max(0, 1 - (Math.abs(x) / 9500) ** 3);
        const profile = 0.64 + Math.sin(x / 770 + layer) * 0.2
          + Math.cos(x / 1390 - layer) * 0.14;
        const height = side === 'south' ? 530 + layer * 210 : 100;
        const z = side === 'south' ? 3000 + layer * 1250 + row * 540
          : -6800 - row * 380;
        positions.push(x, -2 + profile * height * cross[row] * taper, z);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let row = 0; row < cross.length - 1; row++) {
      for (let col = 0; col < columns; col++) {
        const a = base + row * (columns + 1) + col;
        const b = a + 1, c = a + columns + 1, d = c + 1;
        if (side === 'south') indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function weiRiverGeometry(bank = false): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(WEI_DISPLAY_PATH
    .map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const segments = 320;
  const offsets = bank ? [1.38, 1, -1, -1.38] : [1, -1];
  const width = offsets.length;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
    const half = 54 + Math.sin(t * 19) * 9 + Math.cos(t * 7) * 7;
    for (let j = 0; j < width; j++) {
      const offset = half * offsets[j];
      // 岸坡只在水面两侧成环，不能用完整大水坪或土坪互相遮盖。
      const y = bank ? (j === 0 || j === 3 ? -0.9 : -0.4) : -0.55;
      positions.push(point.x - tangent.z * offset, y, point.z + tangent.x * offset);
      uv.push(t * 30, j / (width - 1));
    }
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < width - 1; j++) {
    if (bank && j === 1) continue;
    const a = i * width + j, b = a + 1, c = a + width, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

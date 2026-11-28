import * as THREE from 'three';
import { cityGroundColorAt } from './land-colors.ts';
import { CITY, DAMING_SHIFT_Z } from './layout.ts';

// 地势只控制连续原坡，不用随机尖峰；坊内平台另按中心标高整地。
export function terrainHeight(x: number, z: number): number {
  const mound = (cx: number, cz: number, sx: number, sz: number, h: number) =>
    h * Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2));
  const south = mound(620, 315, 160, 118, 8.2);
  const sacred = mound(0, 208, 180, 56, 2.7);
  // 前庭在龙首原南沿以下，低处保留从宫门向北的开敞地。
  const north = mound(510, -1100 + DAMING_SHIFT_Z, 430, 260, 7)
    * Math.min(1, Math.max(0, (-808 + DAMING_SHIFT_Z - z) / 105));
  const height = south + sacred + north;
  return height < 0.05 ? 0 : height;
}

export function terrainGeometry(heightAt: (x: number, z: number) => number) {
  const geometry = new THREE.PlaneGeometry(2000, 2240, 100, 112);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -200);
  const positions = geometry.getAttribute('position');
  const colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const y = heightAt(x, z);
    positions.setY(i, y - 0.25);
    const shade = new THREE.Color(cityGroundColorAt(x, z));
    shade.multiplyScalar(1 + Math.min(y, 10) * 0.008);
    colors.push(shade.r, shade.g, shade.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// 道路以低密度连续带顺坡，不用数百个水平薄片假装道路贴地。
export function ribbonGeometry(
  points: readonly [number, number][], width: number,
  heightAt: (x: number, z: number) => number,
  opening?: (x: number, z: number) => boolean,
): THREE.BufferGeometry {
  const positions: number[] = [], uv: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    // 调用方必须提供开口边界点，避免粗采样把邻接路段一并删除。
    if (opening?.((ax + bx) / 2, (az + bz) / 2)) continue;
    const length = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / length * width / 2;
    const nz = (bx - ax) / length * width / 2;
    const a = [ax + nx, heightAt(ax + nx, az + nz), az + nz];
    const b = [ax - nx, heightAt(ax - nx, az - nz), az - nz];
    const c = [bx - nx, heightAt(bx - nx, bz - nz), bz - nz];
    const d = [bx + nx, heightAt(bx + nx, bz + nz), bz + nz];
    // 俯视顺时针坐标对应向上法线，岸线/道路统一此约定。
    for (const p of [a, d, b, b, d, c]) {
      positions.push(...p); uv.push(p[0] / 16, p[2] / 16);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

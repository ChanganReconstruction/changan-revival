import * as THREE from 'three';
import type { LandmarkKit } from './landmark-kit';

// 街景只向统一批次提交共享原型，避免逐件 Mesh 与专属材质。
export function createStreetScenes(kit: LandmarkKit): void {
  const { batches } = kit;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const body = new THREE.IcosahedronGeometry(1, 1);
  const legGeo = new THREE.CylinderGeometry(0.11, 0.16, 1, 8);
  const neckGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 8);
  neckGeo.rotateZ(-0.48);
  const ropeGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5);
  const drumGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.55, 8);
  drumGeo.rotateZ(Math.PI / 2);
  // 横街广场留在朱雀大街轴线两侧，中央通行带保持完整。
  batches.add(box, 'paving', 0, 0.06, -268,
    340, 0.12, 28, 0, '#d7c6a4');
  for (const x of [-145, -105, -65, 65, 105, 145]) kit.tree(x, -268, 0.62);
  for (const x of [-154, 154]) {
    batches.add(box, 'stone', x, 0.3, -268,
      8, 0.6, 8);
    batches.hall(kit.prototypes.pavilion, x, -268, 9, 8, 0.55);
    batches.add(box, 'vermilion', x, 4, -268, 0.14, 8, 0.14);
    batches.add(ico, 'gold', x, 8.3, -268, 0.28, 0.45, 0.28);
  }

  // 西郭驼队以低面数轮廓表现双峰、弯颈、四肢与驮包。
  const camels = [
    [-876, -82, 0.94, 0], [-894, -94, 0.88, 0.15], [-912, -76, 1.02, -0.12],
    [-930, -91, 0.9, 0.08], [-887, -53, 0.86, -0.1],
  ] as const;
  for (const [x, z, s, yaw] of camels) {
    const put = (
      geometry: THREE.BufferGeometry,
      material: 'wood' | 'cloth' | 'dark' | 'earth',
      dx: number, y: number, dz: number, sx: number, sy: number, sz: number,
      tint = '#ffffff',
    ) => batches.add(geometry, material, x + dx * s, y * s, z + dz * s,
      sx * s, sy * s, sz * s, yaw, tint);
    put(body, 'earth', 0, 1.65, 0, 1.45, 0.75, 0.72, '#bf9669');
    put(ico, 'earth', -0.38, 2.28, 0, 0.42, 0.72, 0.42, '#d2ad7d');
    put(ico, 'earth', 0.34, 2.22, 0, 0.42, 0.68, 0.42, '#d2ad7d');
    put(neckGeo, 'earth', 0.65, 2.48, 0, 1, 1.05, 1, '#bf9669');
    put(ico, 'earth', 0.99, 3.04, 0, 0.35, 0.325, 0.325, '#d2ad7d');
    put(ico, 'dark', 1.14, 3.06, -0.12, 0.045, 0.045, 0.045);
    for (const [lx, lz] of [[-0.78, -0.25], [-0.78, 0.25], [0.72, -0.25], [0.72, 0.25]]) {
      put(legGeo, 'earth', lx, 0.72, lz, 1.2, 1.25, 1.2, '#a67b53');
    }
    put(neckGeo, 'earth', -1.05, 1.65, 0, 0.32, 0.48, 0.32, '#a67b53');
    put(ico, 'cloth', -0.03, 1.8, -0.72, 0.52, 0.4, 0.28,
      x % 2 ? '#a54f35' : '#56675b');
  }
  // 驼道贴地，镜头可同时收进西墙金光门与队伍。
  const paving = box;
  batches.add(paving, 'earth', -905, -0.02, -73, 130, 0.08, 78, 0, '#b8a27c');

  // E1-7已有坊门堂，侧置钟鼓楼，不叠完整门楼。
  batches.add(box, 'stone', 80, 0.24, 467,
    20, 0.45, 10, 0, '#b9a889');
  for (const x of [75, 85]) {
    batches.add(box, 'wood', x, 2.1, 464,
      0.35, 4.2, 0.35, x < 80 ? -0.38 : 0.38, '#7a4930');
    batches.add(box, 'wood', x, 2.1, 464,
      4.2, 0.35, 0.35, x < 80 ? -0.38 : 0.38, '#7a4930');
  }
  batches.add(drumGeo, 'wood', 104, 5, 465, 1, 1, 1, 0, '#984b34');
  batches.hall(kit.prototypes.tower, 112, 458, 11, 10, 0.82);
  for (const x of [68, 92]) {
    batches.add(box, 'wood', x, 3, 464, 0.14, 6, 0.14);
    batches.add(ico, 'lamp', x, 6.1, 464, 0.42, 0.48, 0.42);
  }

  kit.tree(228, 540, 0.65);

  // E2-8沿用已有水井，仅加槐下石凳与简洁提水架，不侵入坊墙。
  for (const x of [216, 230]) {
    batches.add(box, 'stone', x, 0.35, 539,
      5, 0.7, 1.2, 0, '#a99d84');
  }
  for (const x of [220, 226]) {
    batches.add(box, 'wood', x, 2.2, 538, 0.18, 4.4, 0.18);
  }
  batches.add(box, 'wood', 223, 4.35, 538, 6.4, 0.18, 0.18);
  batches.add(ropeGeo, 'wood', 223, 2.05, 538, 1, 2.8, 1);
  batches.add(ico, 'wood', 223, 3.25, 538, 0.18, 0.22, 0.18);
}

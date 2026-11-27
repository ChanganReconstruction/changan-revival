import * as THREE from 'three';
import type { LandmarkKit } from './landmark-kit';
import { createLakeGeometry, createShoreGeometry, createIslandGeometry } from './waterscape';

import { QUJIANG_OUTLINE } from './water-layout';
import { createQujiangInlet, inletMouthCut } from './qujiang-inlet';
export { nearQujiang } from './water-layout';

export function createQujiang(kit: LandmarkKit, material: THREE.Material): THREE.Mesh {
  const { batches, prototypes, block, tree } = kit;
  const outer = QUJIANG_OUTLINE.map(([x, z]) => [x * 1.065, z * 1.09] as [number, number]);
  // 岸坡内缘落水位，外缘向陆地抬升；与单薄水面分开建造。
  const shore = createShoreGeometry(QUJIANG_OUTLINE, outer, -1.3, inletMouthCut);
  batches.add(shore, 'earth', 689, 0.36, 593);
  const bank = QUJIANG_OUTLINE.map(([x, z]) => [x * 1.14, z * 1.19] as [number, number]);
  const plantedBank = createShoreGeometry(outer, bank, 1.5, inletMouthCut);
  batches.add(plantedBank, 'grass', 689, 1.66, 593, 1, 1, 1, 0, '#c7c7a0');
  const geometry = createLakeGeometry(QUJIANG_OUTLINE).rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geometry, material);
  water.name = '曲江双湾曲岸';
  water.position.set(689, 0.45, 593);
  water.receiveShadow = true;
  // 东北湾设异形小岛，亭、堆山和西南大湾留白共同打破规整对称。
  batches.add(createIslandGeometry(), 'earth', 728, 0.3, 550, 0.62, 0.65, 0.72, 0.4);
  block('stone', 729, 4.04, 550, 7, 0.45, 6);
  batches.hall(prototypes.pavilion, 729, 550, 8, 6, 0.62, 0.18, 4.3);
  tree(720, 554, 0.65, 1.4);
  tree(736, 543, 0.62, 1.1);
  // 紫云楼与临水厅不等距排队，沿北岸布置疏密与进退。
  block('stone', 645, 1.15, 492, 33, 2.2, 24);
  batches.hall(prototypes.tower, 645, 492, 29, 20, 1.25, 0, 2.3);
  batches.hall(prototypes.hipgable, 578, 514, 24, 13, 1.1, -0.3);
  batches.hall(prototypes.gable, 789, 506, 36, 10, 0.7, 0.2);
  for (const [x, z, size] of [[569, 569, 1.1], [620, 681, 1.4],
    [779, 681, 1.2], [678, 666, 0.95], [753, 489, 1.5], [602, 489, 1.25]]) {
    tree(x, z, size);
  }
  // 短栈道止于北岸凹湾，入水部分有桩脚，禁止两片悬空石板飘在水上。
  for (const z of [514, 529]) {
    block('wood', 679, 1.8, z, 4, 0.4, 15);
    for (const x of [677.5, 680.5]) for (const dz of [-5.5, 5.5]) {
      block('wood', x, 0.8, z + dz, 0.3, 1.6, 0.3);
    }
  }
  createQujiangInlet(kit);
  water.userData.inlet = '黄渠末段：供水方向有文献依据，渠口与涵道为艺术示意；上游省略';
  return water;
}

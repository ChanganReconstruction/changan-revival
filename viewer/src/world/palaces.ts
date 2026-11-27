import type { LandmarkKit } from './landmark-kit';
import { hanyuanPrototype } from './royal-architecture.ts';
import { createHanyuanApproach } from './palace-approach.ts';
import { createLindeComplex } from './linde-complex.ts';
import { createDanfengGate } from './danfeng-gate.ts';
import { createHuaeComplex } from './huae-complex.ts';
import { createLongshouInlet, longshouMouthCut } from './longshou-inlet.ts';
import {
  createIslandGeometry, createLakeGeometry, createShoreGeometry,
  LONGCHI_OUTLINE, TAIYE_OUTLINE,
} from './waterscape.ts';

// 仅使用城市共享批次与建筑原型，避免地标制造独立网格和材质。
export function createPalaces(kit: LandmarkKit): void {
  const { batches, prototypes, block, tree, perimeter } = kit;

  // 含元殿三重独立台基，前庭、殿阁和廊庑共同形成朝仪轴线。
  block('earth', 520, 5, -985, 380, 10, 390);
  block('yard', 520, 10.1, -985, 376, 0.3, 386);
  // 轴线分段铺石，东西两侧留成不对称绿地和偏院，不把宫苑做成通铺广场。
  for (const [x, z, w, d] of [[520, -843, 54, 72], [520, -924, 104, 32],
    [520, -1042, 78, 38], [440, -878, 72, 42]]) {
    block('paving', x, 10.3, z, w, 0.08, d, 0, '#dce3e1');
  }
  for (const [x, z, w, d] of [[398, -1085, 110, 130], [502, -1152, 62, 42],
    [680, -980, 40, 100], [435, -931, 54, 62], [606, -1023, 58, 46],
    [560, -1145, 52, 36]]) {
    block('grass', x, 10.32, z, w, 0.08, d, 0, '#bdd0aa');
  }
  // 南墙为五门道整体让位，北墙仍只保留原30宽通口，不能一起扩大。
  perimeter(520, -962, 380, 436, 6, 'vermilion', 10, 108);
  for (const x of [485.5, 554.5]) {
    block('vermilion', x, 13, -1180, 39, 6, 1);
    block('roof', x, 16, -1180, 39, 0.22, 1.35);
  }
  for (let tier = 0; tier < 3; tier++) {
    block('stone', 520, 11 + tier * 2, -860,
      166 - tier * 16, 2, 104 - tier * 12);
  }
  block('paving', 520, 16.1, -860, 126, 0.2, 72);
  // 专属原型按统一尺度使用，不再只放大平面、把殿身压扁。
  batches.hall(hanyuanPrototype(), 520, -860, 90, 55, 5, 0, 16);

  // 区分早期正南龙尾道与后期两侧盘道，目标年代采用两侧盘上的推定关系。
  createHanyuanApproach(kit);
  block('stone', 520, 5, -789, 94, 10, 6);
  createDanfengGate(kit);
  for (let step = 0; step < 10; step++) {
    const rise = step + 1;
    block('stone', 520, rise / 2, -768 - step * 2,
      94, rise, 2);
  }

  // 宣政、紫宸各自围院；麟德三殿与四座亭楼另用独立组合。
  for (const [x, z, w, d, roof] of [
    [520, -920, 132, 74, 'hip'], [520, -1004, 116, 62, 'gable'],
  ] as const) {
    block('paving', x, 10.25, z, w, 0.25, d);
    perimeter(x, z, w, d, 4, 'wall', 10.3, 12);
    batches.hall(roof === 'hip' ? prototypes.hip : prototypes.gable,
      x, z, w * 0.55, d * 0.42, 1.15, 0, 10.5);
  }
  createLindeComplex(kit, 402, -970, 10.4);
  for (const x of [366, 396, 426, 456]) {
    tree(x, -1038, 1.05, 10.4);
    tree(x, -1082, 0.9, 10.4);
  }

  // 太液池单蓬莱山，曲岸含北湾、东侧半岛和收窄水口，水面低于岸顶。
  const taiye = TAIYE_OUTLINE;
  const taiyeOuter: readonly [number, number][] = taiye.map(([x, z]) => [
    x * 1.17, z * 1.19,
  ]);
  const taiyeX = 626;
  const taiyeZ = -1090;
  const shore = createShoreGeometry(taiye, taiyeOuter);
  // 北湾外缘以土体承托岸坡，池水仍由独立下凹水面覆盖。
  block('earth', 600, 9.8, -1147, 16, 1.2, 8);
  if (typeof batches.add === 'function') {
    batches.add(shore, 'earth', taiyeX, 11.05, taiyeZ);
  }
  const lake = createLakeGeometry(taiye).rotateX(-Math.PI / 2);
  if (typeof batches.add === 'function') {
    batches.add(lake, 'water', taiyeX, 10.45, taiyeZ);
  }
  // 蓬莱山以四圈不同收分的异形岩坡抬升，顶部偏心台地承亭。
  const island = createIslandGeometry();
  if (typeof batches.add === 'function') {
    batches.add(island, 'earth', 628, 10.45, -1092);
  }
  block('stone', 630, 16.2, -1092, 10, 0.7, 8);
  batches.hall(prototypes.pavilion, 630, -1092, 11, 8, 0.72, 0, 16.55);
  // 树木沿岛坡分层落位，远离亭台并避免悬空或穿越屋身。
  for (const [x, z, size, y] of [[616, -1083, 0.8, 12.05],
    [638, -1090, 0.9, 12.05], [616, -1100, 0.7, 12.05],
    [639, -1101, 0.65, 12.05], [639, -1095, 0.8, 13.95]]) {
    tree(x, z, size, y);
  }
  // 东岸依曲岸分段布置回廊，避开岛渡口与北湾开口。
  for (const [x, z, rotation] of [[680, -1114, 0.1], [684, -1098, 0.15],
    [681, -1081, -0.1], [672, -1066, -0.45]]) {
    batches.hall(prototypes.pavilion, x, z, 20, 8, 0.48, rotation, 10.5);
  }
  for (const [x, z] of [[564, -1070], [570, -1112], [658, -1140],
    [668, -1049], [605, -1043]]) tree(x, z, 0.9, 10.5);

  // 兴庆宫以南龙池、临池花萼楼、北部宫殿院及偏置沉香亭构成非对称格局。
  block('grass', 750, 0.08, -190, 104, 0.12, 190);
  const longchi = LONGCHI_OUTLINE;
  const longchiOuter: readonly [number, number][] = longchi.map(([x, z]) => [
    x * 1.12, z * 1.16,
  ]);
  const shore2 = createShoreGeometry(longchi, longchiOuter, 1.1, longshouMouthCut);
  if (typeof batches.add === 'function') {
    batches.add(shore2, 'earth', 750, 1.05, -155);
  }
  const lake2 = createLakeGeometry(longchi).rotateX(-Math.PI / 2);
  if (typeof batches.add === 'function') {
    batches.add(lake2, 'water', 750, 0.45, -155);
  }
  createLongshouInlet(kit);
  // 花萼组合放在龙池西南岸；北正南反的旧位置及重复亭列不再保留。
  createHuaeComplex(kit);
  // 沉香亭放在东岸，增实体岸台，不让普通亭体直接坐在水面上。
  block('stone', 800, 0.45, -146, 20, 0.9, 16);
  batches.hall(prototypes.pavilion, 800, -146, 15, 12, 0.65, 0, 0.9);
  // 北部多院落有围墙、主殿与偏院，不用放大普通 hall 充作宫殿。
  for (const [x, z, w, d] of [[740, -260, 86, 58], [782, -226, 42, 46]]) {
    block('paving', x, 0.25, z, w, 0.3, d);
    perimeter(x, z, w, d, 3, 'wall', 0.35, 10);
    batches.hall(prototypes.hip, x, z, w * 0.43, d * 0.36, 1.2, 0, 0.6);
  }
  batches.hall(prototypes.gable, 710, -244, 36, 19, 0.85, 0, 0.6);
  for (const [x, z, size] of [[704, -176, 0.9], [789, -169, 1.1],
    [730, -128, 0.8], [785, -276, 0.9], [692, -229, 0.75]]) {
    tree(x, z, size, 0.4);
  }
}

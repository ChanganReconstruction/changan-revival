import type { LandmarkKit } from './landmark-kit';
import { hanyuanPrototype } from './royal-architecture.ts';
import { createHanyuanApproach } from './palace-approach.ts';
import { createLindeComplex } from './linde-complex.ts';
import { createDanfengGate } from './danfeng-gate.ts';
import { createHuaeComplex } from './huae-complex.ts';
import { createLongshouInlet, longshouMouthCut } from './longshou-inlet.ts';
import { DAMING_SHIFT_Z } from './layout.ts';
import { CITY_SURFACES } from './land-colors.ts';
import { functionalPrototype } from './functional-architecture.ts';
import { gardenGroup, gardenWalk } from './palace-gardens.ts';
import {
  createIslandGeometry, createLakeGeometry, createShoreGeometry,
  LONGCHI_OUTLINE, TAIYE_OUTLINE,
} from './waterscape.ts';

// 仅使用城市共享批次与建筑原型，避免地标制造独立网格和材质。
function createDamingPalace(kit: LandmarkKit): void {
  // 保持已建殿阁及水岸之间的关系，把宫城整体移到丹凤门与外郭北墙共线的位置。
  const { prototypes } = kit;
  const block: LandmarkKit['block'] = (m, x, y, z, ...rest) =>
    kit.block(m, x, y, z + DAMING_SHIFT_Z, ...rest);
  const tree: LandmarkKit['tree'] = (x, z, ...rest) => kit.tree(x, z + DAMING_SHIFT_Z, ...rest);
  const perimeter: LandmarkKit['perimeter'] = (x, z, ...rest) =>
    kit.perimeter(x, z + DAMING_SHIFT_Z, ...rest);
  const batches = {
    hall: (...args: Parameters<LandmarkKit['batches']['hall']>) => {
      args[2] += DAMING_SHIFT_Z;
      kit.batches.hall(...args);
    },
    add: (...args: Parameters<LandmarkKit['batches']['add']>) => {
      args[4] += DAMING_SHIFT_Z;
      kit.batches.add(...args);
    },
  };

  // 含元殿三重独立台基，前庭、殿阁和廊庑共同形成朝仪轴线。
  block('earth', 520, 5, -994, 380, 10, 372, 0, '#e2dace');
  block('yard', 520, 10.1, -994, 376, 0.3, 372, 0, CITY_SURFACES.wardYard);
  // 丹凤门内先经低平前导空间，台地到含元殿前才抬升。
  block('yard', 520, 0.04, -776, 376, 0.07, 64, 0, CITY_SURFACES.wardYard);
  block('road', 520, 0.10, -776, 54, 0.08, 64, 0, CITY_SURFACES.avenue);
  for (const x of [374, 666]) {
    block('grass', x, 0.08, -779, 30, 0.06, 49, 0, CITY_SURFACES.planting);
    for (const z of [-765, -781, -797]) tree(x, z, 0.88, 0.12);
  }
  // 轴线分段铺石，东西两侧留成不对称绿地和偏院，不把宫苑做成通铺广场。
  for (const [x, z, w, d] of [[520, -843, 54, 72], [520, -924, 104, 32],
    [520, -1042, 78, 38], [440, -878, 72, 42]]) {
    block('paving', x, 10.3, z, w, 0.08, d, 0, '#dce3e1');
  }
  for (const [x, z, w, d] of [[680, -980, 40, 100], [435, -931, 54, 62], [606, -1023, 58, 46]]) {
    block('grass', x, 10.32, z, w, 0.08, d, 0, '#bdd0aa');
  }
  // 南墙为五门道整体让位，北墙仍只保留原30宽通口，不能一起扩大。
  perimeter(520, -962, 380, 436, 16, 'earth', 0, 108);
  for (const x of [485.5, 554.5]) {
    block('earth', x, 8, -1180, 39, 16, 1);
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
  const damingKit = { ...kit, block, tree, perimeter, batches };
  createHanyuanApproach(damingKit);

  // 宣政、紫宸各自围院；麟德三殿与四座亭楼另用独立组合。
  for (const [x, z, w, d, front] of [
    [520, -920, 132, 74, true], [520, -1004, 116, 62, false],
  ] as const) {
    block('paving', x, 10.25, z, w, 0.25, d);
    perimeter(x, z, w, d, 4, 'wall', 10.3, 12);
    const hallZ = z - 8;
    block('stone', x, 10.8, hallZ, front ? 77 : 61, 1, front ? 33 : 24);
    batches.hall(front ? prototypes.hip : prototypes.hipgable,
      x, hallZ, front ? 72 : 54, front ? 27 : 20, front ? 2.05 : 1.65, 0, 11.3);
    const passage = functionalPrototype('passage');
    for (const side of [-1, 1]) {
      if (front) batches.hall(passage, x + side * 51, z + 4, 35, 7, 0.68, Math.PI / 2, 10.4);
      else gardenGroup(damingKit, x + side * 40, z + 11, 10.42, 0.9, side);
    }
  }
  createLindeComplex(damingKit, 402, -970, 10.4);
  // 后苑的西侧经营成开敞林地，曲径接太液池西岸，不另设对称池或封闭方院。
  const woodland = createLakeGeometry([[354, -1051], [370, -1031], [403, -1039],
    [439, -1034], [464, -1046], [470, -1072], [510, -1072], [530, -1090],
    [531, -1124], [548, -1149], [547, -1168], [493, -1167], [453, -1152],
    [420, -1157], [379, -1140], [352, -1113], [358, -1089]])
    .rotateX(-Math.PI / 2);
  batches.add(woodland, 'grass', 0, 10.4, 0, 1, 1, 1, 0, '#bcc7a4');
  gardenWalk(damingKit, [[480, -1036], [477, -1057], [490, -1079], [515, -1092],
    [535, -1094], [547, -1104], [540, -1126], [514, -1146], [492, -1151]], 7, 10.48);
  gardenWalk(damingKit, [[515, -1092], [505, -1117], [488, -1129], [470, -1135]], 5, 10.47);
  for (const [x, z, s, angle] of [[374, -1043, 1.22, 1], [405, -1085, 1.36, 2],
    [376, -1101, 1.26, 3], [426, -1061, 1.15, 0], [456, -1082, 1.36, 2],
    [443, -1127, 1.42, 3], [484, -1103, 1.21, 2], [503, -1064, 0.92, 1],
    [521, -1119, 0.88, 0], [487, -1161, 1.3, 1], [530, -1154, 1.1, 0]]) {
    gardenGroup(damingKit, x, z, 10.42, s, angle);
  }
  block('stone', 464, 10.76, -1137, 23, 0.65, 15, -0.22);
  batches.hall(functionalPrototype('pavilion'), 464, -1137, 20, 12, 1.1, -0.22, 11.09);
  block('stone', 544, 10.58, -1103, 15, 0.3, 12, -0.24);

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
  if (typeof kit.batches.add === 'function') {
    batches.add(shore, 'earth', taiyeX, 11.05, taiyeZ);
  }
  const lake = createLakeGeometry(taiye).rotateX(-Math.PI / 2);
  if (typeof kit.batches.add === 'function') {
    batches.add(lake, 'water', taiyeX, 10.45, taiyeZ);
  }
  // 蓬莱山以四圈不同收分的异形岩坡抬升，顶部偏心台地承亭。
  const island = createIslandGeometry();
  if (typeof kit.batches.add === 'function') {
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
  for (const [x, z, rotation] of [[693, -1116, 1.12], [701, -1101, 1.3],
    [700, -1083, 1.75], [689, -1068, 2.2]]) {
    batches.hall(prototypes.pavilion, x, z, 15, 6, 0.48, rotation, 10.6);
  }
  for (const [x, z] of [[558, -1066], [549, -1121], [658, -1140],
    [668, -1049], [585, -1041]]) tree(x, z, 0.9, 10.5);
}

export function createPalaces(kit: LandmarkKit): void {
  createDamingPalace(kit);
  createDanfengGate(kit);
  const { batches, prototypes, block, tree, perimeter } = kit;
  // 兴庆宫以南龙池、临池花萼楼、北部宫殿院及偏置沉香亭构成非对称格局。
  block('yard', 745, 0.06, -238, 115, 0.1, 76, 0, CITY_SURFACES.wardYard);
  const planting = createLakeGeometry([
    [-59, -8], [-53, -28], [-33, -43], [-8, -47], [14, -45], [33, -38], [45, -14],
    [56, 10], [43, 32], [18, 40], [-14, 39], [-44, 28], [-55, 12],
  ]).rotateX(-Math.PI / 2);
  batches.add(planting, 'grass', 750, 0.105, -155, 1, 1, 1, 0, CITY_SURFACES.planting);
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
  // 北岸折行绕水，不让行政殿院的硬地和中轴吞没南半的龙池。
  const pavilion = functionalPrototype('pavilion');
  for (const [x, z, angle] of [[702, -188, -0.7], [740, -194, 0.14], [763, -193, -0.24]]) {
    block('stone', x, 0.37, z, 16, 0.65, 10, angle);
    batches.hall(pavilion, x, z, 13, 8, 0.76, angle, 0.695);
  }
  gardenWalk(kit, [[695, -163], [691, -181], [702, -190], [722, -197], [744, -193],
    [763, -194], [780, -186], [790, -174]], 5, 0.2);
  gardenWalk(kit, [[761, -119], [774, -119], [787, -124], [797, -134], [800, -139]], 4, 0.2);
  for (const [x, z, w, d] of [[727, -247, 60, 48], [785, -242, 44, 42]]) {
    block('paving', x, 0.16, z, w, 0.09, d, 0, '#d9d9d0');
    perimeter(x, z, w, d, 2.6, 'wall', 0.15, 10);
    block('stone', x, 0.48, z - 9, w * 0.68, 0.8, 16);
    const main = x === 727;
    batches.hall(main ? prototypes.hipgable : prototypes.gable, x, z - 9,
      w * 0.61, 13, main ? 1.5 : 1.16, 0, 0.88);
    batches.hall(functionalPrototype('passage'), x, z + d / 2, 13, 7, 0.78, 0, 0.16);
  }
  for (const [x, z, size, angle] of [[687, -160, 1.15, 2], [693, -190, 0.91, 2],
    [715, -201, 0.82, 4], [733, -184, 0.8, 3], [770, -200, 1.12, 4],
    [781, -194, 0.88, 0], [798, -170, 1.1, 1], [802, -125, 0.96, 1],
    [773, -112, 0.91, 0], [753, -118, 0.78, 2], [785, -276, 0.9, 0],
    [692, -229, 0.75, 2]]) {
    gardenGroup(kit, x, z, 0.18, size, angle);
  }
}

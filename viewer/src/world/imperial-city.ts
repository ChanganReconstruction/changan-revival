import { IcosahedronGeometry } from 'three';
import type { LandmarkKit } from './landmark-kit';
import { functionalPrototype } from './functional-architecture.ts';
import { officePrototype } from './office-architecture.ts';
import { templeHallPrototype } from './architecture.ts';
import { paintedPalacePrototype, palacePrototype } from './royal-architecture.ts';
import { proportionPrototype, tintWardPrototype } from './appearance.ts';
import { CITY_SURFACES } from './land-colors.ts';
import { gardenGroup, gardenWalk } from './palace-gardens.ts';
import { random, SEED } from './layout.ts';
import {
  DANFENG_AVENUE, IMPERIAL, KAIYUAN_STREET_Z, NORTHERN_CONNECTORS, NORTHERN_SITES,
  NORTHERN_WARDS, PALACE_CROSS_STREET, TAIJI, northernLot,
} from './northern-layout.ts';

const gardenShrub = new IcosahedronGeometry(1);

export function createImperialCity(kit: LandmarkKit): void {
  const { block, batches, prototypes, perimeter, tree } = kit;
  const wall = (x: number, z: number, w: number, d: number, h: number) => {
    block('earth', x, h / 2, z, w, h, d, 0, '#e4ddd0');
    block('roof', x, h, z, w + 0.3, 0.22, d + 0.3);
  };
  const edge = (z: number, gap: number, h: number) => {
    const width = 250 - gap / 2;
    for (const side of [-1, 1]) wall(side * (250 - width / 2), z, width, 1.4, h);
  };
  for (const { north, south } of [IMPERIAL, TAIJI]) {
    const mid = (north + south) / 2;
    block('yard', 0, 0.07, mid, 498, 0.12, south - north, 0, '#e0e0d5');
    for (const x of [-250, 250]) wall(x, mid, 1.4, south - north, north === TAIJI.north ? 7 : 5);
  }
  // 太极宫以外郭北墙为北垣；皇城有自己的北墙，两区之间不再有相叠的墙。
  edge(IMPERIAL.north, 0, 5);
  edge(IMPERIAL.south, 38, 5);
  edge(TAIJI.south, 54, 7);
  block('road', 0, 0.18, (IMPERIAL.north + IMPERIAL.south) / 2,
    34, 0.1, IMPERIAL.south - IMPERIAL.north, 0, CITY_SURFACES.avenue);
  for (const z of [-414, -318]) block('road', 0, 0.17, z, 494, 0.08, 13, 0,
    CITY_SURFACES.crossStreet);

  // 署厅高于一般民居，配房退让；同一街上混合开敞前庭、廊院与侧园。
  const officeHall = officePrototype('hall');
  const officeWing = officePrototype('wing');
  const officeGate = officePrototype('gate');
  const paving = (x: number, z: number, w: number, d: number, color = '#dbdcd1') =>
    block('paving', x, 0.165, z, w, 0.07, d, 0, color);
  const bed = (x: number, z: number, w: number, d: number) => {
    block('stone', x, 0.21, z, w + 0.7, 0.16, d + 0.7, 0, '#d3cbbb');
    block('grass', x, 0.28, z, w, 0.08, d, 0, CITY_SURFACES.planting);
  };
  for (const side of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      const z = -366 - row * 96;
      for (const [column, x] of [68, 144, 217].entries()) {
        const cx = side * x;
        const kind = (column + row + (side === 1 ? 1 : 0)) % 3;
        const halfWidth = column === 2 ? 26.5 : 32.5;
        const wingX = halfWidth - 5.5;
        perimeter(cx, z, halfWidth * 2, 70, 2.9, 'wall', 0, 9);
        block('wall', cx, 1.45, z - 35, 9.2, 2.9, 1);
        block('roof', cx, 2.9, z - 35, 9.2, 0.22, 1.35);
        batches.hall(officeHall, cx, z - 21, column === 1 ? 40 : 34, 14,
          kind === 0 ? 1.52 : 1.4, 0, 0.13, '#c4c8bf');
        batches.hall(officeGate, cx, z + 35, 13, 7.6, 1.11, 0, 0.13, '#c0c5bb');
        paving(cx, z + 14, 7.8, 48);
        paving(cx, z + 38, 7.8, 8);
        for (const direction of kind === 1 ? [-1, 1] : [side]) {
          batches.hall(officeWing, cx + direction * wingX, z + 5,
            kind === 1 ? 32 : 26, 8.3, 0.94, -direction * Math.PI / 2, 0.13, '#c8c8bb');
          const end = direction * (wingX - 3);
          const start = direction * 3.9;
          paving(cx + (end + start) / 2, z + 5, Math.abs(end - start), 4.3);
        }
        if (kind === 0) {
          // 办事前庭有集散余量，两侧树坛不挡中路。
          for (const direction of [-1, 1]) {
            const apron = wingX * 0.71 - 3.9;
            block('paving', cx + direction * (3.9 + apron / 2), 0.17, z + 2.6,
              apron, 0.07, 24, 0, '#d6d9d0');
            const bx = cx + direction * (wingX - 3.5);
            bed(bx, z + 22, 5.3, 5.3);
            tree(bx, z + 22, 0.9, 0.31);
          }
        } else if (kind === 1) {
          // 两厢夹庭；横向接入廊前，一对窄圃衬出中轴。
          for (const direction of [-1, 1]) {
            const bx = cx + direction * Math.min(10.5, wingX - 9);
            bed(bx, z + 20, 4.3, 10);
            tree(bx, z + 19, 0.63, 0.31);
          }
        } else {
          // 在非办事动线一侧留小园，分段花圃夹出折径，末端设休憩亭。
          const bx = cx - side * (wingX * 0.61);
          bed(bx - side * 5.4, z + 3.4, 4.5, 9.5);
          bed(bx - side * 1.6, z + 22, 11, 9.5);
          tree(bx - side * 5.4, z + 3.4, 0.96, 0.31);
          tree(bx - side * 2.5, z + 22, 0.75, 0.31);
          for (const [dx, dz, w, h, d, tint] of [
            [-5.8, 0.4, 1.1, 0.42, 1.1, '#8b9b74'], [-5.2, 6.6, 1.2, 0.52, 1.0, '#a7b78e'],
            [-4.8, 19.5, 1.4, 0.52, 1.4, '#98ad78'], [1.3, 20.2, 1.5, 0.7, 1.2, '#a5b78b'],
            [-4.1, 24, 1.3, 0.47, 1.3, '#a9b589'], [1.6, 24.7, 1.2, 0.56, 1.5, '#82996c'],
          ] as const) {
            batches.add(gardenShrub, 'grass', bx + side * dx, 0.29 + h * 0.68, z + dz,
              w, h, d, dz * 0.5, tint);
          }
          const start = cx - side * 3.9;
          paving((bx + start) / 2, z + 9.4, Math.abs(bx - start), 4.2);
          paving(bx, z + 2.5, 4.4, 9.6);
          batches.hall(functionalPrototype('pavilion'), bx, z - 4.9, 8, 7.2, 0.7, 0, 0.2);
        }
      }
    }
  }
  // 宫皇横街用完整留白截断纵轴，北侧是承天门与分离的太极宫前庭。
  block('road', 0, 0.19, PALACE_CROSS_STREET, 554, 0.12, 34, 0, CITY_SURFACES.crossStreet);
  block('paving', 0, 0.18, -609, 143, 0.1, 68, 0, '#d8d9d2');
  block('road', 0, 0.26, -607, 22, 0.06, 63, 0, '#e0d9cc');
  batches.hall(palacePrototype('gate'), 0, TAIJI.south, 78, 20, 2.55, 0, 0.16);
  // 太极殿前两庑连续而后寝院密集；大殿、门观、庭院不等宽不等高。
  batches.hall(palacePrototype('state-hall'), 0, -650, 104, 47, 4.15, 0, 0.24);
  const gallery = functionalPrototype('passage');
  const audience = paintedPalacePrototype('audience');
  const residence = paintedPalacePrototype('residence');
  const sideHall = paintedPalacePrototype('side');
  for (const side of [-1, 1]) {
    // 承天门内两侧是收窄视线的门侧楼，与沿前庭伸展的低廊错开。
    batches.hall(sideHall, side * 75, -584, 23, 16, 2.1, 0, 0.18);
    block('stone', side * 79, 0.48, -626, 13, 0.68, 66);
    for (const z of [-605, -626, -647]) {
      batches.hall(gallery, side * 79, z, 23, 12, 1.35, Math.PI / 2, 0.82);
    }
    batches.hall(residence, side * 79, -670, 27, 16, 1.8, 0, 0.22);
  }
  // 主殿后不是两栋独立住宅：内门、较宽的后殿、小型寝院各自成段。
  paving(0, -701, 143, 49);
  for (const side of [-1, 1]) {
    wall(side * 61, -692, 82, 1.15, 3.7);
  }
  batches.hall(palacePrototype('gate'), 0, -692, 38, 15, 1.62, 0, 0.18);
  paving(0, -730, 74, 58);
  batches.hall(audience, 0, -731, 73, 30, 2.85, 0, 0.18);
  perimeter(0, -781, 74, 55, 3.0, 'wall', 0, 10);
  paving(0, -781, 69, 50);
  batches.hall(residence, 0, -790, 54, 23, 2.25, 0, 0.18);
  for (const side of [-1, 1]) {
    batches.hall(gallery, side * 26, -775, 21, 7, 0.86, Math.PI / 2, 0.18);
  }
  // 园景退到正殿之后，不占礼仪中轴。西侧有围廊与对置植床，东侧留作殿院。
  perimeter(-72, -747, 64, 78, 2.9, 'wall', 0, 9);
  paving(-72, -747, 60, 74);
  for (const x of [-86, -58]) {
    bed(x, -745, 18, 25);
    gardenGroup(kit, x, -748, 0.32, 1.12, x);
    gardenGroup(kit, x, -738, 0.32, 0.74, x + 2);
  }
  const gardenPavilion = functionalPrototype('pavilion');
  batches.hall(gardenPavilion, -72, -771, 24, 12, 1.02, 0, 0.19);
  batches.hall(gardenPavilion, -98, -744, 36, 6, 0.62, Math.PI / 2, 0.19);
  batches.hall(gardenPavilion, -46, -744, 36, 6, 0.62, Math.PI / 2, 0.19);
  gardenWalk(kit, [[-72, -708], [-72, -764]], 5, 0.222);
  perimeter(72, -743, 61, 71, 2.9, 'wall', 0, 9);
  paving(72, -743, 56, 66);
  batches.hall(audience, 72, -757, 46, 20, 2.05, 0, 0.18);
  for (const x of [50, 94]) gardenGroup(kit, x, -732, 0.2, 0.82, x);
  // 东宫与掖庭各自围合，内院形制及间距是示意，不以林亭代替掖庭。
  for (const x of [TAIJI.westPartition, TAIJI.eastPartition]) {
    wall(x, (TAIJI.north + TAIJI.south) / 2, 1.2, TAIJI.south - TAIJI.north, 4.5);
  }
  // 东宫单独组织南门、前庭和主殿，略低于太极殿，后院转为居处及侧园。
  perimeter(181, -644, 124, 98, 3.8, 'wall', 0, 34);
  block('wall', 181, 1.9, -693, 34, 3.8, 1);
  block('roof', 181, 3.8, -693, 34, 0.22, 1.35);
  paving(181, -635, 112, 78);
  block('road', 181, 0.24, -622, 14, 0.05, 53, 0, '#e0d9cc');
  batches.hall(palacePrototype('gate'), 181, -595, 42, 16, 1.85, 0, 0.18);
  batches.hall(palacePrototype('east-hall'), 181, -662, 68, 31, 2.95, 0, 0.2);
  for (const x of [133, 229]) {
    for (const z of [-620, -638]) {
      batches.hall(gallery, x, z, 20, 10, 1.12, Math.PI / 2, 0.18);
    }
  }
  perimeter(181, -746, 124, 89, 2.9, 'wall', 0, 12);
  paving(181, -746, 116, 81);
  batches.hall(residence, 156, -757, 43, 19, 1.72, 0, 0.2);
  batches.hall(gallery, 132, -730, 26, 9, 0.86, Math.PI / 2, 0.18);
  bed(215, -748, 27, 30);
  gardenGroup(kit, 209, -756, 0.32, 1.03);
  gardenGroup(kit, 221, -742, 0.32, 0.79, 3);
  batches.hall(gardenPavilion, 215, -772, 20, 11, 1.0, 0, 0.2);
  for (const [x, z, w, d] of [[-183, -772, 102, 52], [-183, -705, 104, 62],
    [-184, -627, 100, 62]]) {
    perimeter(x, z, w, d, 2.9, 'wall', 0, 8);
    block('yard', x, 0.16, z, w - 4, 0.06, d - 4, 0, '#dad4c2');
    batches.hall(prototypes.gable, x, z - d / 2 + 9, w * 0.68, 10, 0.82);
    batches.hall(prototypes.gable, x - w * 0.36, z, d * 0.44, 8, 0.7, Math.PI / 2);
    tree(x + w * 0.29, z + 9, 1.05);
  }
  // 皇城南门保留门墩空隙，门楼不落成阻塞御道的实心住宅。
  batches.hall(prototypes.hip, 0, IMPERIAL.south, 52, 20, 1.7, 0, 7);
  for (const x of [-20, 20]) block('vermilion', x, 4, IMPERIAL.south, 12, 8, 10);
}

export function createNorthernQuarters(kit: LandmarkKit,
  connectRoad: (points: [number, number][], width: number) => void): void {
  const { block, batches, prototypes, perimeter, tree } = kit;
  const street = (x: number, z: number, w: number, d: number) =>
    block('road', x, 0.105, z, w, 0.08, d, 0, CITY_SURFACES.wardRoad);
  const westCrossings = [-813, -682, KAIYUAN_STREET_Z, -414, -277];
  const eastCrossings = [-812, -640, DANFENG_AVENUE.south, -277];
  for (const x of [-827, -624, -446, -277, 275, 819]) {
    street(x, -552.5, 12, 535);
  }
  for (const z of westCrossings) street(-547, z, z === KAIYUAN_STREET_Z ? 586 : 558, 14);
  street(681, -552.5, 12, 535);
  street(535, -380, 12, 190);
  for (const z of eastCrossings) street(550, z, 550, 12);
  for (const [northX, regularX] of NORTHERN_CONNECTORS) {
    const points: [number, number][] = [[northX, -285], [northX, -277]];
    if (northX !== regularX) points.push([regularX, -277]);
    points.push([regularX, -269]);
    connectRoad(points, 8);
  }
  const avenue = DANFENG_AVENUE;
  block('road', avenue.x, 0.13, (avenue.north + avenue.south) / 2,
    avenue.width, 0.08, avenue.south - avenue.north, 0, CITY_SURFACES.avenue);

  const passage = functionalPrototype('passage');
  const temple = templeHallPrototype();
  const homes = {
    gable: proportionPrototype(prototypes.gable, 'dwelling', 0.5).filter((part) => !part.detail),
    hip: proportionPrototype(prototypes.hip, 'dwelling', 0.5).filter((part) => !part.detail),
  };
  for (const [i, ward] of NORTHERN_WARDS.entries()) {
    const { x, z, width: w, depth: d, id } = ward;
    const rng = random(SEED + i * 313);
    const house = (roof: 'gable' | 'hip', x: number, z: number,
      w: number, d: number, h: number, rotation = 0) => batches.hall(
      tintWardPrototype(homes[roof], id, 'dense', x, z), x, z, w, d, h, rotation, 0.14);
    perimeter(x, z, w, d, 3.1, 'earth', 0, 8);
    block('yard', x, 0.08, z, w - 2, 0.12, d - 2, 0, CITY_SURFACES.wardYard);
    block('road', x, 0.145, z, 7, 0.06, d + 2, 0, CITY_SURFACES.wardRoad);
    block('road', x, 0.15, z + 4, w - 8, 0.06, 6, 0, CITY_SURFACES.crossStreet);
    for (const side of [-1, 1]) {
      const gate = z + side * d / 2;
      const crossings = x < 0 ? westCrossings : eastCrossings;
      const crossing = side < 0 ? crossings.filter((cz) => cz < gate).at(-1)
        : crossings.find((cz) => cz > gate);
      if (crossing !== undefined) {
        // 连接门道与横街，不额外给门外短接路指定历史走向。
        block('road', x, 0.111, (gate + crossing) / 2, 7, 0.08,
          Math.abs(gate - crossing) + 1, 0, CITY_SURFACES.wardRoad);
      }
      batches.hall(passage, x, gate, 10, 6, 0.87);
      const columns = w < 106 ? 1 : w > 205 ? 3 : 2;
      for (let column = 0; column < columns; column++) {
        for (const half of [0, 1]) {
          const { x: cx, z: cz, width: lotWidth } = northernLot(ward, side, column, half);
          const site = NORTHERN_SITES.find((s) => s.ward === id && s.side === side
            && s.column === column && s.half === half);
          if (site) {
            const width = lotWidth - 2;
            perimeter(cx, cz, width, 41, 2.3, 'wall', 0.15, 6);
            block('paving', cx, 0.165, cz, width - 4, 0.08, 37, 0, '#ddd8c8');
            batches.hall(temple, cx, cz - 10, width * 0.82, 13, 1.43, 0, 0.21);
            if (site.id === 'guangzhai-temple') {
              block('stone', cx, 0.8, cz + 7, 10, 1.6, 9);
              block('stone', cx, 1.85, cz + 7, 7, 0.5, 6);
            }
            continue;
          }
          const roofWidth = lotWidth * (0.62 + 0.23 * rng());
          if (rng() < 0.12) {
            block('grass', cx, 0.16, cz, lotWidth - 5, 0.04, 23, 0, CITY_SURFACES.planting);
            tree(cx, cz - 4, 0.86 + 0.37 * rng());
            continue;
          }
          const style = rng();
          house(style > 0.86 ? 'hip' : 'gable',
            cx, cz - 12, roofWidth, 9 + 3 * rng(), 0.65 + 0.35 * rng());
          if (style < 0.44) {
            house('gable', cx, cz + 9, roofWidth * 0.86, 8, 0.72);
          } else {
            const wing = roofWidth * 0.35;
            house('gable', cx + side * wing, cz + 3, 14, 6, 0.65, Math.PI / 2);
            if (style > 0.67) house('gable', cx - side * wing, cz + 3,
              14, 6, 0.65, Math.PI / 2);
            else tree(cx - side * wing, cz + 6, 0.9);
          }
        }
      }
    }
  }
}

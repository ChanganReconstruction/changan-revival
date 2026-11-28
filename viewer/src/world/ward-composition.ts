import { districtFor } from './districts.ts';
import { random, type Ward } from './layout.ts';
import type { LandmarkKit } from './landmark-kit.ts';
import { templeHallPrototype, type PrototypePart } from './architecture.ts';
import { APPEARANCE_SAMPLES, proportionPrototype, tintWardPrototype } from './appearance.ts';
import { PAGODAS } from './temple-pagodas.ts';
import { functionalPrototype, type BuildingForm } from './functional-architecture.ts';

const appearanceCache = new WeakMap<PrototypePart[], Map<string, PrototypePart[]>>();
let templeHallParts: PrototypePart[] | undefined;

type Rect = { x: number; z: number; width: number; depth: number };
type House = Rect & {
  height: number;
  rotation: number;
  roof: 'gable' | 'hipgable' | 'hip' | 'pavilion' | 'tower';
  form?: 'temple-hall' | 'screen' | BuildingForm;
};
export interface WardPlan {
  family: string;
  topology: string;
  roads: Rect[];
  courtyards: Rect[];
  greenplots: Rect[];
  publicSquares: Rect[];
  keepouts: Rect[];
  houses: House[];
  trees: Array<{ x: number; z: number; size: number }>;
}

const hash = (text: string): number => {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  }
  return value >>> 0;
};

const rect = (ward: Ward, x: number, z: number, width: number, depth: number): Rect => ({
  x: ward.x + x, z: ward.z + z, width, depth,
});

const intersects = (a: Rect, b: Rect): boolean =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2
  && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;

// 先切坊内道路和留白院落，再在明确的住宅地块中落屋，避免庭院被填满。
export function planWard(ward: Ward): WardPlan {
  const { family, southwest, templeLayout } = districtFor(ward);
  const rng = random(hash(ward.id));
  const w = ward.width - 12;
  const d = ward.depth - 12;
  const x0 = -w / 2;
  const z0 = -d / 2;
  const houses: House[] = [];
  const roads: Rect[] = [];
  const courtyards: Rect[] = [];
  const greenplots: Rect[] = [];
  const publicSquares: Rect[] = [];
  const keepouts: Rect[] = [];
  const trees: WardPlan['trees'] = [];
  const empty = (): WardPlan => ({
    family, topology: 'reserved', roads, courtyards, greenplots, publicSquares,
    keepouts, houses, trees,
  });
  if (family === 'garden' || family === 'market') return empty();

  const lane = (x: number, z: number, width: number, depth: number) => {
    roads.push(rect(ward, x, z, width, depth));
  };
  const court = (x: number, z: number, width: number, depth: number) => {
    courtyards.push(rect(ward, x, z, width, depth));
  };
  const grove = (x: number, z: number, width: number, depth: number) => {
    greenplots.push(rect(ward, x, z, width, depth));
    // 林圃用少量错位树点表现疏密，不生成整齐等距树阵。
    if (width >= 8 && depth >= 10) {
      const count = Math.min(4, Math.floor(width / 7));
      for (let i = 0; i < count; i++) {
        const tree = {
          x: ward.x + x + (rng() - 0.5) * (width - 4),
          z: ward.z + z + (rng() - 0.5) * (depth - 4),
          size: 0.85 + rng() * 0.35,
        };
        const footprint = { ...tree, width: 4, depth: 4 };
        if (roads.every((road) => !intersects(footprint, road))
          && courtyards.every((area) => !intersects(footprint, area))
          && trees.every((other) => !intersects(footprint,
            { ...other, width: 4, depth: 4 }))) trees.push(tree);
      }
    }
  };
  // 每坊南门x=0有一条实路接入内部主巷；道路允许通到坊墙门洞。
  const academy = ward.id === 'E2-1';
  const manor = ward.id === 'E3-1';
  const gateZ = ward.depth / 2 + (southwest || family === 'temple' || academy || manor ? 3 : 0);
  const approachZ = manor ? 29 : academy ? 24 : family === 'temple' && !southwest ? 25 : 0;
  lane(0, (approachZ + gateZ) / 2, 4, gateZ - approachZ);
  if (ward.id === 'E2-8') {
    // 曲井台既有巷景保留原坐标，并用短横巷接入坊门主路。
    publicSquares.push({ x: 223, z: 538, width: 14, depth: 12 });
    lane(10, 12, 20, 3.5);
  }
  if (ward.id === 'E1-7') {
    // 南门侧鼓楼由街景系统创建，此处只保留其屋顶净空。
    keepouts.push({ x: 112, z: 458, width: 20, depth: 18 });
  }
  const putHouse = (x: number, z: number, width: number, depth: number,
    roof: House['roof'] = 'gable', height?: number, rotation = 0, form?: House['form']) => {
    const house = { ...rect(ward, x, z, width, depth),
      height: height ?? 0.78 + rng() * 0.3, rotation, roof, ...(form && { form }) };
    const inside = house.x - width / 2 >= ward.x - ward.width / 2 + 6
      && house.x + width / 2 <= ward.x + ward.width / 2 - 6
      && house.z - depth / 2 >= ward.z - ward.depth / 2 + 6
      && house.z + depth / 2 <= ward.z + ward.depth / 2 - 6;
    if (inside && roads.every((road) => !intersects(house, road))
      && courtyards.every((plot) => !intersects(house, plot))
      && greenplots.every((plot) => !intersects(house, plot))
      && publicSquares.every((square) => !intersects(house, square))
      && keepouts.every((keepout) => !intersects(house, keepout))
      && houses.every((other) => !intersects(house, other))) houses.push(house);
  };
  const addRandomHouse = (x: number, z: number, frontage: number, depth: number) => {
    // 朝向随宅地变化；旋转时Rect仍描述世界轴对齐包围盒。
    const rotation = rng() < 0.24 ? Math.PI / 2 : 0;
    const width = Math.max(9, Math.min(22, frontage - 1));
    const houseDepth = Math.min(12, Math.max(5, depth));
    if (rotation) putHouse(x, z, houseDepth, width, 'gable', undefined, rotation);
    else putHouse(x, z, width, houseDepth, rng() < 0.12 ? 'hipgable' : 'gable');
  };
  const parcelBand = (x: number, z: number, width: number, depth: number,
    density: 'tight' | 'mixed' = 'mixed') => {
    // 不等列宽与错开的二进深小院，避免统一网格化的住宅纹理。
    let cursor = x;
    const end = x + width;
    while (cursor + 10 <= end) {
      const frontage = Math.min(end - cursor,
        (density === 'tight' ? 10 : 14) + Math.floor(rng() * 13));
      const columns = Math.max(1, Math.floor(depth / 13));
      for (let row = 0; row < columns; row++) {
        const rowDepth = depth / columns;
        const houseDepth = 7 + Math.floor(rng() * Math.min(5, rowDepth - 4));
        const offset = rowDepth * (row + 0.5) + (rng() - 0.5) * 3;
        addRandomHouse(cursor + frontage / 2, z + offset, frontage, houseDepth);
      }
      // 深宅只在独立后进地块加一间偏置小屋，不把院心当建筑空地填满。
      if (depth > 28 && rng() < 0.95) {
        const backW = Math.min(12, frontage - 1);
        addRandomHouse(cursor + frontage / 2 + (rng() - 0.5) * 2,
          z + depth - 3, backW, 5);
      }
      cursor += frontage;
    }
  };
  const plantByLane = () => {
    for (const road of roads) {
      const lx = road.x - ward.x;
      const lz = road.z - ward.z;
      const candidates = road.width < road.depth
        ? [{ x: lx + road.width / 2 + 3, z: lz - road.depth * 0.22 },
          { x: lx - road.width / 2 - 3, z: lz + road.depth * 0.18 }]
        : [{ x: lx + road.width * 0.24, z: lz + road.depth / 2 + 3 }];
      for (const point of candidates) {
        const tree = { x: ward.x + point.x, z: ward.z + point.z, size: 0.7 };
        const box = { ...tree, width: 5, depth: 5 };
        if (Math.abs(point.x) < w / 2 - 4 && Math.abs(point.z) < d / 2 - 4
          && (!(southwest || family === 'temple') || roads.every((lane) => !intersects(box, lane)))
          && houses.every((house) => !intersects(box, house))
          && courtyards.every((area) => !intersects(box, area))
          && greenplots.every((area) => !intersects(box, area))
          && publicSquares.every((area) => !intersects(box, area))
          && keepouts.every((area) => !intersects(box, area))) trees.push(tree);
      }
    }
  };

  const variant = hash(ward.id) % 3;
  if (southwest) {
    lane(0, 0, w - 10, 4);
    if (southwest === 'yongyang') {
      // 两寺分据东西；只搭建东侧大庄严寺意象，西侧大总持寺留地。
      // 殿阁组合和塔的位置、尺度均为展示示意。
      const axis = w * 0.27;
      court(axis, 8, 24, 10);
      court(axis, -15, 24, 9);
      grove(-w * 0.29, -22, 26, 18);
      court(-w * 0.27, 18, 30, 22);
      putHouse(axis, -28, 34, 13, 'hip', 2.5);
      putHouse(axis, -7, 17, 6, 'hipgable', 1.25);
      putHouse(axis, 21, 21, 8, 'hipgable', 1.35);
      putHouse(axis + 17, 13, 6, 17, 'gable', 0.92, Math.PI / 2);
      putHouse(axis - 18, -18, 6, 14, 'gable', 0.92, Math.PI / 2);
      putHouse(axis + 15, 30, 7, 7, 'tower', 1.7);
    } else if (southwest === 'heping') {
      // 相邻寺院扩入和平坊的关系只画作两侧留院，不在这里另造两座寺。
      for (const side of [-1, 1]) {
        const axis = side * w * 0.26;
        court(axis, 21, 26, 17);
        putHouse(axis, 33, 24, 7, 'hipgable', 1.2);
      }
      grove(-w * 0.27, -19, 24, 19);
      court(w * 0.25, -14, 19, 11);
      putHouse(w * 0.25, -26, 21, 8);
    } else {
      // 几块疏居坊采用不同的屋地、园圃配比，不把留白填成通铺草地。
      const side = variant === 1 ? -1 : 1;
      const axis = side * w * 0.25;
      court(axis, -16, 21, 10);
      grove(-axis, -20, 27, 18);
      grove(axis + side * (variant - 1) * 6, 22, 20 + variant * 4, 18);
      putHouse(axis, -27, 21, 8);
      putHouse(axis + side * 15, -13, 6, 12, 'gable', 0.85, Math.PI / 2);
      putHouse(-axis, 10, 18, 8);
      court(-axis, 21, 20, 13);
      putHouse(-axis, 32, 23, 8);
      if (variant !== 0) putHouse(-axis - side * 16, 21, 7, 13, 'gable', 0.9, Math.PI / 2);
    }
    plantByLane();
    return { family, topology: `southwest-${southwest}`, roads, courtyards, greenplots,
      publicSquares, keepouts, houses, trees };
  }

  if (family === 'temple') {
    // 具名配置与无名坊共用原型；分配的是展示平面，不是寺观形制考证。
    const layout = templeLayout ?? (['grove', 'street', 'enclosed'] as const)[variant];
    const wing = (x: number, z: number, length: number, height = 0.88) =>
      putHouse(x, z, 6, length, 'gable', height, Math.PI / 2);
    const offset = -ward.side * w * 0.24;
    if (layout === 'axial') {
      court(0, 13, 56, 24);
      court(0, -24, 34, 10);
      putHouse(0, -10, 53, 16, 'hip', 2.1, 0, 'temple-hall');
      putHouse(0, -34, 32, 8, 'hipgable', 1.38);
      for (const sign of [-1, 1]) {
        wing(sign * 34, 8, 32);
        putHouse(sign * 22, 32, 9, 9, 'tower', 1.3);
        grove(sign * 34, -23, 12, 18);
      }
    } else if (layout === 'paired') {
      lane(0, 23, 70, 4);
      court(-22, 10, 34, 22);
      court(23, 6, 27, 30);
      putHouse(-22, -12, 32, 14, 'hipgable', 2.05);
      putHouse(23, -17, 25, 12, 'gable', 1.5);
      putHouse(23, -32, 14, 7, 'hipgable', 1.05);
      putHouse(-22, 32, 15, 7, 'gable', 1);
      grove(-22, -29, 26, 15);
    } else if (layout === 'highland') {
      court(0, 19, 65, 12);
      court(0, -6, 40, 14);
      putHouse(0, -25, 44, 16, 'hipgable', 2.65);
      for (const sign of [-1, 1]) {
        putHouse(sign * 27, 5, 10, 10, 'pavilion', 1.3);
        wing(sign * 37, -15, 23);
        grove(sign * 43, 22, 12, 20);
      }
    } else if (layout === 'dayan' || layout === 'xiaoyan') {
      const pagoda = PAGODAS[layout];
      const broad = layout === 'dayan';
      // 两塔继续由独立地标模块生成；院落以现有塔心为锚，不挪塔或入口。
      keepouts.push({ x: pagoda.x, z: pagoda.z, width: pagoda.plinth + 2, depth: pagoda.plinth + 2 });
      court(0, broad ? 2 : 3, broad ? 62 : 32, broad ? 46 : 44);
      putHouse(0, -30, broad ? 56 : 29, broad ? 14 : 10, broad ? 'hip' : 'hipgable', broad ? 2.2 : 1.55);
      for (const sign of [-1, 1]) {
        wing(sign * (broad ? 39 : 22), broad ? -4 : -9, broad ? 48 : 28);
        if (broad) putHouse(sign * 26, 33, 17, 8, 'hipgable', 1.15);
        else grove(sign * 35, 5, 13, 24);
      }
      if (!broad) putHouse(15, 32, 15, 8, 'gable', 0.9);
    } else {
      const sign = Math.sign(offset);
      lane(offset / 2, 24, Math.abs(offset) + 4, 4);
      if (layout === 'grove') {
        court(offset, 11, 30, 24);
        putHouse(offset, -16, 33, 11, 'hipgable', 1.7);
        wing(offset + sign * 19, 5, 22);
        grove(-offset, -2, w * 0.38, 46);
        putHouse(-offset, 28, 9, 9, 'pavilion', 1.15);
      } else if (layout === 'street') {
        court(offset, 13, 27, 20);
        putHouse(offset, -7, 29, 10, 'gable', 1.45);
        wing(offset + sign * 18, 13, 18);
        grove(offset, -25, 24, 13);
        parcelBand(-offset - w * 0.2, z0 + 3, w * 0.4, d - 6, 'tight');
      } else {
        court(offset, 12, 24, 22);
        court(offset, -20, 21, 13);
        putHouse(offset, -3, 30, 8, 'hipgable', 1.5);
        putHouse(offset, -32, 22, 8, 'gable', 1.05);
        for (const side of [-1, 1]) wing(offset + side * 17, 11, 18);
        grove(-offset, -10, w * 0.37, 32);
        putHouse(-offset, 19, 19, 8, 'gable', 0.9);
      }
    }
    plantByLane();
    return { ...empty(), topology: `temple-${layout}` };
  }

  if (family === 'office') {
    if (academy) {
      court(0, 8, 49, 32);
      court(0, -31, 24, 8);
      putHouse(0, -18, 36, 14, 'hip', 1.6, 0, 'academy');
      for (const side of [-1, 1]) {
        putHouse(side * 32, 1, 8, 40, 'gable', 0.8, Math.PI / 2);
        grove(side * 38, -28, 12, 13);
      }
      plantByLane();
      return { ...empty(), topology: 'office-academy-court' };
    }
    const axis = -w * 0.12;
    const yardZ = 3;
    if (variant === 0) {
      // 横列衙署：正堂横排，文案与附署分列，南侧留宽阔仪门庭。
      lane(0, 0, w, 3.5);
      court(axis, yardZ, 34, 24);
      putHouse(axis, -24, 34, 11, 'hipgable', 1.8);
      putHouse(axis - 23, 2, 12, 20, 'gable', 0.85, Math.PI / 2);
      putHouse(axis + 23, 2, 12, 20, 'gable', 0.85, Math.PI / 2);
      parcelBand(w * 0.17, z0 + 5, w * 0.25, d - 10, 'tight');
    } else if (variant === 1) {
      // 学舍两庭：讲堂、东西斋舍围出两个而非一个复制院落。
      court(axis - 15, -11, 19, 16);
      court(axis + 15, 11, 19, 16);
      grove(axis + 34, -20, 10, 15);
      putHouse(axis, -29, 30, 10, 'hipgable', 1.55);
      putHouse(axis, 29, 30, 10, 'hipgable', 1.35);
      for (const sign of [-1, 1]) {
        putHouse(axis + sign * 26, -10, 19, 8, 'gable', 0.78);
        putHouse(axis - sign * 26, 12, 19, 8, 'gable', 0.78);
      }
      parcelBand(-w * 0.44, z0 + 4, w * 0.22, d - 8, 'tight');
    } else {
      // 单轴附院：一进正厅与偏置小院连缀，外侧留出杂居街坊。
      court(axis + 22, 9, 20, 21);
      grove(axis + 35, -22, 12, 17);
      putHouse(axis, -22, 31, 12, 'hipgable', 1.8);
      putHouse(axis, 27, 27, 11, 'hipgable', 1.45);
      putHouse(axis + 23, -20, 10, 23, 'gable', 0.82, Math.PI / 2);
      parcelBand(-w * 0.45, z0 + 3, w * 0.24, d - 6, 'tight');
      parcelBand(w * 0.21, z0 + 4, w * 0.22, d - 8, 'mixed');
    }
    plantByLane();
    return {
      family,
      topology: ['office-transverse-yamen', 'office-twin-academy',
        'office-single-axis'][variant],
      roads, courtyards, greenplots, publicSquares, keepouts, houses, trees,
    };
  }

  if (family === 'manor') {
    if (manor) {
      // 入门先转过屏院，再串前庭与后寝；侧园不占南门通路。
      lane(0, 27, 35, 4);
      lane(-15, 21, 4, 8);
      court(0, 11, 32, 12);
      court(0, -14, 25, 11);
      putHouse(0, 22, 14, 1.5, 'gable', 0.6, 0, 'screen');
      putHouse(0, -1, 33, 9, 'hipgable', 1.37, 0, 'manor');
      putHouse(0, -26, 30, 11, 'hipgable', 1.18, 0, 'manor');
      putHouse(-28, 2, 8, 31, 'gable', 0.9, Math.PI / 2);
      grove(32, 1, 23, 28);
      putHouse(32, -21, 9, 8, 'pavilion', 0.9, 0, 'pavilion');
      plantByLane();
      return { ...empty(), topology: 'manor-screen-garden' };
    }
    const side = variant === 1 ? 1 : variant === 2 ? -1 : (ward.side < 0 ? -1 : 1);
    const cx = side * w * 0.2;
    if (variant === 0) {
      // 两进侧园：主宅与后寝分进，东侧园林留白。
      court(cx, 3, 27, 22);
      grove(cx + side * 28, 8, 17, 32);
      putHouse(cx, -22, 34, 12, 'hipgable', 1.8);
      putHouse(cx, 28, 26, 10, 'hip', 1.25);
      putHouse(cx - side * 22, 3, 9, 23, 'gable', 0.82, Math.PI / 2);
      parcelBand(-cx - side * 8, z0 + 5, w * 0.25, d - 10, 'tight');
    } else if (variant === 1) {
      // 双宅并置：两组主屋中间留巷，后园各自独立。
      court(cx - 20, 8, 19, 17);
      court(cx + 20, -8, 19, 17);
      grove(cx + side * 36, 18, 12, 21);
      putHouse(cx - 20, -21, 25, 11, 'hipgable', 1.55);
      putHouse(cx - 20, 29, 21, 9, 'gable', 0.95);
      putHouse(cx + 20, 20, 25, 11, 'hipgable', 1.65);
      putHouse(cx + 20, -30, 20, 9, 'gable', 0.9);
      parcelBand(-cx - side * 7, z0 + 4, w * 0.21, d - 8, 'tight');
    } else {
      // 角宅混居：角部大宅围小院，余下两侧仍为不等窄宅与小铺。
      court(cx, -18, 22, 17);
      grove(cx - side * 28, 18, 15, 19);
      putHouse(cx, -34, 29, 9, 'hipgable', 1.6);
      putHouse(cx + side * 20, -16, 9, 21, 'gable', 0.78, Math.PI / 2);
      putHouse(cx, 24, 23, 10, 'hip', 1.25);
      parcelBand(-w * 0.45, z0 + 4, w * 0.24, d - 8, 'tight');
      parcelBand(w * 0.2, z0 + 3, w * 0.23, d - 6, 'mixed');
    }
    plantByLane();
    return {
      family,
      topology: ['manor-two-court-garden', 'manor-twin-houses',
        'manor-corner-mixed'][variant],
      roads, courtyards, greenplots, publicSquares, keepouts, houses, trees,
    };
  }

  // dense/artisan：三种偏轴巷骨架，沿实际宅地条带切出不等宽铺面与后进。
  const mode = Math.floor(rng() * 3);
  const crossX = (rng() - 0.5) * 12;
  const crossZ = (rng() - 0.5) * 10;
  if (mode === 0) {
    lane(crossX, 0, 4, d);
    lane(0, crossZ, w, 3.5);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx < 0 ? x0 : crossX + 2;
      const width = sx < 0 ? crossX - x0 - 2 : w / 2 - crossX - 2;
      const z = sz < 0 ? z0 : crossZ + 2;
      const depth = sz < 0 ? crossZ - z0 - 2 : d / 2 - crossZ - 2;
      parcelBand(x, z, width, depth, family === 'dense' ? 'tight' : 'mixed');
    }
  } else if (mode === 1) {
    lane(0, crossZ, w, 4);
    const sideLane = crossX + (family === 'artisan' ? -9 : 7);
    lane(sideLane, 0, 3.5, d);
    parcelBand(x0, z0, w, d * 0.45, family === 'dense' ? 'tight' : 'mixed');
    parcelBand(x0, crossZ + 3, w, d * 0.46,
      family === 'dense' ? 'tight' : 'mixed');
  } else {
    lane(crossX, 0, 4, d);
    const branchX = family === 'artisan' ? x0 + w * 0.62 : x0 + w * 0.43;
    lane((x0 + branchX) / 2, crossZ, branchX - x0, 3.5);
    parcelBand(x0, z0, branchX - x0 - 2, d * 0.45,
      family === 'dense' ? 'tight' : 'mixed');
    parcelBand(x0, crossZ + 3, branchX - x0 - 2, d * 0.43,
      family === 'dense' ? 'tight' : 'mixed');
    parcelBand(branchX + 2, z0, w - (branchX - x0) - 2, d,
      family === 'dense' ? 'tight' : 'mixed');
  }
  if (ward.id === 'E1-7') {
    // 避开坊门侧鼓楼屋顶后，门洞西侧仍可容纳一间窄面住宅。
    putHouse(15, 33, 9, 5, 'gable', 0.62);
  }
  // 少数沿坊巷的社树落在真实空隙中，非全城等距植树。
  plantByLane();
  return {
    family, topology: `lane-${mode}`, roads, courtyards, greenplots,
    publicSquares, keepouts, houses, trees,
  };
}

export function buildWardInterior(kit: LandmarkKit, ward: Ward): void {
  const plan = planWard(ward);
  const elevation = districtFor(ward).elevation;
  const sample = APPEARANCE_SAMPLES.has(ward.id);
  // 共用一组基础墙檐几何，礼制体量由已有柱高与占地形成，避免整城批次翻倍。
  const proportion = 'dwelling' as const;
  const roofParts = {
    gable: kit.prototypes.gable,
    hipgable: kit.prototypes.hipgable,
    hip: kit.prototypes.hip,
    pavilion: kit.prototypes.pavilion,
    tower: kit.prototypes.tower,
  };
  // 共享批次绘制巷道、院坪与林圃，保持南门到主巷的通路连续。
  for (const road of plan.roads) {
    kit.block('road', road.x, elevation + 0.17, road.z,
      road.width, 0.05, road.depth, 0, sample ? '#c9c4b9' : '#babeb4');
  }
  for (const yard of plan.courtyards) {
    kit.block('paving', yard.x, elevation + 0.175, yard.z,
      yard.width, 0.052, yard.depth, 0, sample ? '#e5e8e3' : '#d4d8d0');
  }
  for (const plot of plan.greenplots) {
    kit.block('grass', plot.x, elevation + 0.17, plot.z,
      plot.width, 0.048, plot.depth, 0, sample ? '#b2c99b' : '#c0cda9');
  }
  for (const square of plan.publicSquares) {
    kit.block('paving', square.x, elevation + 0.175, square.z,
      square.width, 0.052, square.depth, 0, '#a99d87');
  }
  for (const house of plan.houses) {
    const rotated = Math.abs(house.rotation) > 0.1;
    const width = rotated ? house.depth : house.width;
    const depth = rotated ? house.width : house.depth;
    if (house.form === 'screen') {
      kit.block('wall', house.x, elevation + 1.35, house.z, width, 2.7, depth);
      kit.block('roof', house.x, elevation + 2.78, house.z, width + 0.4, 0.2, depth + 0.25);
      continue;
    }
    if (house.form === 'temple-hall') {
      templeHallParts ??= templeHallPrototype();
      kit.batches.hall(templeHallParts, house.x, house.z,
        width, depth, house.height, house.rotation, elevation);
      continue;
    }
    if (house.form) {
      kit.batches.hall(functionalPrototype(house.form), house.x, house.z,
        width, depth, house.height, house.rotation, elevation);
      continue;
    }
    const source = roofParts[house.roof];
    let variants = appearanceCache.get(source);
    if (!variants) {
      variants = new Map();
      appearanceCache.set(source, variants);
    }
    const height = house.roof !== 'tower' && house.height > 1.4
      ? 1.3 + (house.height - 1.4) * 0.5 : house.height;
    // 屋面仅用两档共享坡度；避免比例改善却使全城主体提交次数翻倍。
    const roofRatio = house.roof === 'tower' || depth / (11 * height) >= 0.9 ? 1 : 0.5;
    const variant = `${proportion}:${roofRatio}:${sample ? 'focus' : 'background'}`;
    let tuned = variants.get(variant);
    if (!tuned) {
      tuned = proportionPrototype(source, proportion, roofRatio)
        .filter((part) => sample || !part.detail);
      variants.set(variant, tuned);
    }
    // 全城应用验证过的墙檐比例，背景不再生成柱梁；颜色只写实例属性。
    const parts = tintWardPrototype(tuned, ward.id, plan.family, house.x, house.z);
    kit.batches.hall(parts, house.x, house.z,
      width, depth, height, house.rotation, elevation, '#ffffff');
  }
  for (const tree of plan.trees) kit.tree(tree.x, tree.z, tree.size, elevation);
}

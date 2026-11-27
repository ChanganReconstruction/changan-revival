import { districtFor } from './districts.ts';
import { random, type Ward } from './layout.ts';
import type { LandmarkKit } from './landmark-kit.ts';
import type { PrototypePart } from './architecture.ts';
import { APPEARANCE_SAMPLES, proportionPrototype, districtAppearance } from './appearance.ts';

const appearanceCache = new WeakMap<PrototypePart[], Map<string, PrototypePart[]>>();

type Rect = { x: number; z: number; width: number; depth: number };
type House = Rect & {
  height: number;
  rotation: number;
  roof: 'gable' | 'hipgable' | 'hip' | 'tower';
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
  const family = districtFor(ward).family;
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
  lane(0, ward.depth / 4, 4, ward.depth / 2);
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
    roof: House['roof'] = 'gable', height?: number, rotation = 0) => {
    const house = { ...rect(ward, x, z, width, depth),
      height: height ?? 0.78 + rng() * 0.3, rotation, roof };
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
          && houses.every((house) => !intersects(box, house))
          && courtyards.every((area) => !intersects(box, area))
          && greenplots.every((area) => !intersects(box, area))
          && publicSquares.every((area) => !intersects(box, area))
          && keepouts.every((area) => !intersects(box, area))) trees.push(tree);
      }
    }
  };

  const variant = hash(ward.id) % 3;
  if (family === 'temple') {
    const west = ward.side < 0;
    const cx = west ? -w * 0.22 : w * 0.22;
    const bigTemple = ward.id === 'E1-5' || ward.id === 'W1-5';
    const templeWidth = bigTemple ? w * 0.76 : w * 0.48;
    const templeDepth = bigTemple ? d * 0.76 : d * 0.58;
    const zCourt = bigTemple ? 5 : (variant === 1 ? 7 : -1);
    const courtWidth = templeWidth * (variant === 2 ? 0.42 : 0.52);
    const courtDepth = bigTemple ? 22 : 18;
    const centerX = -ward.side * 20;
    court(centerX, zCourt, courtWidth, courtDepth);
    if (variant === 2 && !bigTemple) {
      court(cx - templeWidth * 0.38, zCourt + 20, templeWidth * 0.25, 11);
      grove(cx + templeWidth * 0.34, zCourt + 19, 11, 17);
    } else if (bigTemple) {
      grove(centerX - 22, z0 + 8, 4, 18);
      grove(centerX + 22, z0 + 8, 4, 18);
    } else {
      grove(cx + (west ? 1 : -1) * templeWidth * 0.42, z0 + 11, 11, 16);
    }
    // 三种寺观关系：整坊中轴大寺、半坊寺院带邻里、偏轴双院与林圃。
    const hallW = bigTemple ? 32 : 25;
    const baseZ = bigTemple ? -24 : -21;
    putHouse(centerX, baseZ, hallW, 11, 'hipgable', 1.8);
    putHouse(centerX, zCourt + courtDepth / 2 + 9, hallW * 0.72, 12, 'hip', 2.0);
    putHouse(centerX, zCourt - courtDepth / 2 - 6, hallW * 0.58, 8,
      'hipgable', 1.45);
    const sideOffset = bigTemple ? 21 : courtWidth / 2 + 8;
    const sideWidth = bigTemple ? 5 : 8;
    const sideDepth = bigTemple ? 18 : 22;
    for (const side of [-1, 1]) {
      putHouse(centerX + side * sideOffset, zCourt, sideWidth, sideDepth,
        'gable', 0.82, Math.PI / 2);
    }
    putHouse(centerX, bigTemple ? -33 : z0 + templeDepth - 9,
      10, bigTemple ? 7 : 9, 'tower', 1.15);
    if (!bigTemple && variant !== 0) {
      const neighborX = ward.side * w * 0.2;
      parcelBand(neighborX - w * 0.19, z0 + 3, w * 0.38, d * 0.42, 'tight');
      parcelBand(neighborX - w * 0.19, 4, w * 0.38, d * 0.39, 'tight');
    }
    plantByLane();
    return { family, topology: bigTemple ? 'temple-full-axis'
      : ['temple-full-court', 'temple-half-neighbor', 'temple-offset-courts'][variant],
    roads, courtyards, greenplots, publicSquares, keepouts, houses, trees };
  }

  if (family === 'office') {
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
    const colors = districtAppearance(ward.id, plan.family, house.x, house.z);
    // 全城应用验证过的墙檐比例，背景不再生成柱梁；颜色只写实例属性。
    const parts = tuned.map((part) => ({ ...part, tint: part.material === 'roof'
      ? colors.roof : part.material === 'wall' || part.material === 'facade'
        ? colors.wall : part.material === 'wood' || part.material === 'vermilion'
          ? colors.wood : undefined }));
    kit.batches.hall(parts, house.x, house.z,
      width, depth, height, house.rotation, elevation, '#ffffff');
  }
  for (const tree of plan.trees) kit.tree(tree.x, tree.z, tree.size, elevation);
}

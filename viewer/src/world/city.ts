import * as THREE from 'three';
import { Batches } from '../render/batches';
import { Vegetation } from '../render/vegetation';
import type { Materials, MaterialKey } from '../render/materials';
import { hallPrototype, towerPrototype, type PrototypePart } from './architecture';
import { districtFor } from './districts';
import { createPalaces } from './palaces';
import { createStreetScenes } from './street-scenes';
import { CITY, makeWards, random, SEED, type Ward } from './layout';
import { buildWardInterior } from './ward-composition';
import { createMarkets } from './markets';
import { createImperialCity, createNorthernQuarters } from './imperial-city';
import { DAMING_WALL, FANGLIN_X, KAIYUAN_STREET_Z } from './northern-layout';
import { CITY_SURFACES } from './land-colors.ts';
import { createQujiang, nearQujiang } from './city-landscape';
import { terrainHeight, terrainGeometry, ribbonGeometry } from './terrain';
import { createLakeGeometry } from './waterscape';
import { planWardGround } from './ground-cover.ts';
import { HUANG_INLET } from './qujiang-inlet';
import { channelWallSegments } from './channel-geometry';
import { LONGSHOU_INLET, LONGSHOU_BRIDGE, longshouRoadCut } from './longshou-inlet';
import { createWesternChannels, westernRoadLayout, westernRoadCut, westernRoadBoundaries,
  westernRoadHeight, WESTERN_CHANNELS, WESTERN_CROSSINGS } from './western-channels';
import { createAvenueDrains } from './avenue-drains';
import { createMingdeGate } from './mingde-gate';
import { createTemplePagodas } from './temple-pagodas';
import { functionalPrototype } from './functional-architecture.ts';

export function createCity(scene: THREE.Scene, materials: Materials) {
  const batches = new Batches(scene, materials);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const vegetation = new Vegetation(scene, materials);
  // 不同屋顶共用相同的石基、墙身与立面，避免原型数量增加后批次成倍增长。
  const geometries = new Map<string, THREE.BufferGeometry>();
  const share = (parts: PrototypePart[]) => parts.map((part) => {
    const key = Object.entries(part.geometry.attributes)
      .map(([name, attribute]) => `${name}:${Array.from(attribute.array).join(',')}`).join('|');
    const existing = geometries.get(key);
    if (existing) { part.geometry.dispose(); part.geometry = existing; }
    else geometries.set(key, part.geometry);
    return part;
  });
  const gable = share(hallPrototype('gable'));
  const hip = share(hallPrototype('hip', true));
  const hipgable = share(hallPrototype('hipgable', true));
  const pavilion = share(hallPrototype('pyramid', true));
  const tower = share(towerPrototype('hipgable'));
  const rng = random(SEED);
  const wards = makeWards();
  const plots = wards.map((ward) => ({ ...ward, elevation: districtFor(ward).elevation }));
  const groundAt = (x: number, z: number) => {
    if (nearQujiang(x, z)) return 0;
    if (Math.abs(Math.abs(x) - 474) < 63 && z > 160 && z < 362) return 0;
    const plot = plots.find((ward) => Math.abs(x - ward.x) <= ward.width / 2
      && Math.abs(z - ward.z) <= ward.depth / 2);
    return plot ? plot.elevation : terrainHeight(x, z);
  };

  const block = (
    material: MaterialKey, x: number, y: number, z: number,
    w: number, h: number, d: number, rotation = 0, tint = '#ffffff',
  ) => batches.add(box, material, x, y, z, w, h, d, rotation, tint);

  const tree = (x: number, z: number, size = 1, y = groundAt(x, z), treeRng = rng) => {
    const tint = new THREE.Color().setHSL(0.23 + treeRng() * 0.07, 0.22,
      0.72 + treeRng() * 0.18);
    vegetation.add({ x, y, z, size, rotation: treeRng() * Math.PI, tint: `#${tint.getHexString()}` });
  };

  const perimeter = (
    x: number, z: number, w: number, d: number, h = 3, material: MaterialKey = 'earth',
    y = 0, gate = 6,
  ) => {
    for (const sign of [-1, 1]) {
      block(material, x + sign * w / 2, y + h / 2, z, 1, h, d);
      block('roof', x + sign * w / 2, y + h, z, 1.35, 0.22, d + 0.6);
      for (const edge of [-1, 1]) {
        const segment = (w - gate) / 2;
        const cx = x + edge * (gate / 2 + segment / 2);
        block(material, cx, y + h / 2, z + sign * d / 2, segment, h, 1);
        block('roof', cx, y + h, z + sign * d / 2, segment, 0.22, 1.35);
      }
    }
  };

  const wardShell = (ward: Ward, y = 0) => {
    perimeter(ward.x, ward.z, ward.width, ward.depth, 3.4, 'earth', y);
    batches.hall(functionalPrototype('passage'),
      ward.x, ward.z + ward.depth / 2, 8, 4.5, 0.84, 0, y);
    if (y > 0) {
      const steps = Math.min(14, Math.ceil(y / 0.4));
      for (let i = 0; i < steps; i++) {
        const height = y * (steps - i) / steps;
        block('stone', ward.x, height / 2, ward.z + ward.depth / 2 + 1 + i * 1.1,
          9, height, 1.2);
      }
    }
  };

  // 地形与主街采用少量连续几何，里坊和建筑继续使用共享实例批次。
  const terrainMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const ground = new THREE.Mesh(terrainGeometry(groundAt), terrainMaterial);
  ground.receiveShadow = true;
  scene.add(ground);
  const road = (points: [number, number][], width: number, tint: string) => {
    const geometry = ribbonGeometry(points, width,
      (x, z) => westernRoadHeight(x, z, groundAt(x, z) + 0.12),
      (x, z) => longshouRoadCut(x, z) || westernRoadCut(x, z));
    batches.add(geometry, 'road', 0, 0, 0, 1, 1, 1, 0, tint);
  };
  const line = (a: number, b: number, fixed: number, horizontal: boolean) => {
    const points = Array.from({ length: 81 }, (_, i) => horizontal
      ? [a + (b - a) * i / 80, fixed] as [number, number]
      : [fixed, a + (b - a) * i / 80] as [number, number]);
    // 便桥处加入精确边界点，只裁桥下短路面，不因原采样粒度误删两侧道路。
    if (!horizontal && fixed === LONGSHOU_BRIDGE.x) {
      for (const z of [LONGSHOU_BRIDGE.north, LONGSHOU_BRIDGE.south]) {
        if (z > a && z < b) points.push([fixed, z]);
      }
      points.sort((p, q) => p[1] - q[1]);
    }
    if (horizontal) {
      for (const x of westernRoadBoundaries()) if (x > a && x < b) points.push([x, fixed]);
    } else if (WESTERN_CHANNELS.some((channel) => channel.roadX === fixed)) {
      for (const cross of WESTERN_CROSSINGS) for (const dz of [-17, -7, 0, 7, 17]) {
        const z = cross + dz;
        if (z > a && z < b) points.push([fixed, z]);
      }
    }
    // 精确接坡点可能与原采样重合，去重后再连带，防止零长度法线产生NaN。
    return [...new Map(points.map((point) => [point.join(','), point])).values()]
      .sort((p, q) => horizontal ? p[0] - q[0] : p[1] - q[1]);
  };
  // 隐藏底座沉到远景平面之下，低角度不再露出一圈深绿色模型托盘边。
  block('grass', 0, -2.6, -160, 2000, 1.8, 2160, 0, '#b9c9a5');
  // 御道侧沟真正留槽；三条连续路带合计仍占原54米，不在完整路面上涂蓝线。
  for (const [x, width] of [[-22.65, 8.7], [0, 33.4], [22.65, 8.7]]) {
    road(line(-280, 705, x, false), width, CITY_SURFACES.avenue);
  }
  for (let row = 0; row < 10; row++) {
    const z = -269 + row * 106;
    road(line(-825, row >= 7 ? 545 : 825, z, true), row === 0 ? 17 : 14,
      row === 0 ? CITY_SURFACES.crossStreet : CITY_SURFACES.wardRoad);
  }
  for (const sign of [-1, 1]) for (const x of [139, 267, 405, 543, 681, 819]) {
    const street = westernRoadLayout(sign * x);
    road(line(-264, sign > 0 && x >= 543 ? 474 : 701, street.x, false),
      street.width, '#b6bdb7');
  }
  const genericPond = createLakeGeometry([[-1, -0.4], [-0.6, -1], [0.1, -0.7],
    [0.8, -0.8], [1, 0.1], [0.4, 0.5], [0.2, 1], [-0.7, 0.6]])
    .rotateX(-Math.PI / 2);
  const kit = {
    batches, prototypes: { gable, hip, hipgable, pavilion, tower }, block, tree, perimeter,
    pond: (x: number, z: number, rx: number, rz: number, y = 0.45) => {
      batches.add(genericPond, 'water', x, y, z, rx, 1, rz);
    },
  };
  for (const ward of wards) {
    const profile = districtFor(ward);
    // 兴庆宫跨两坊位统一造景，不能先放坊墙、普通宅第和矩形池。
    if (ward.side === 1 && ward.column === 5 && ward.row <= 1) continue;
    const elevation = profile.elevation;
    const lakeside = ward.side === 1 && profile.family === 'garden' && ward.row >= 7;
    if (profile.family === 'market') continue;
    if (!lakeside) block('yard', ward.x, elevation / 2 + 0.025, ward.z,
      ward.width, elevation + 0.06, ward.depth, 0,
       profile.family === 'artisan' ? '#c7c9c5' : CITY_SURFACES.wardYard);
    // 绿地只落在规划净空内，不穿建筑、通巷、井台和既有水岸。
    for (const patch of planWardGround(ward)) {
      block('grass', patch.x, elevation + 0.12, patch.z,
       patch.width, 0.06, patch.depth, 0, CITY_SURFACES.planting);
    }
    // 曲江园苑跨坊连通，不让坊墙、门楼和巷道切割水面。
    if (!lakeside) wardShell(ward, elevation);
    if (profile.southwest) {
      const localRng = random(SEED + ward.column * 100 + ward.row);
      buildWardInterior({
        ...kit, tree: (x, z, size, y) => tree(x, z, size, y, localRng),
      }, ward);
      // 旧草坪生成 18 棵树，每棵消费位置、尺寸、颜色、朝向共 5 次取样；
      // 保留共享随机序列的步数，不改相邻里坊、曲江与城郊的既有树位。
      for (let i = 0; i < 18 * 5; i++) rng();
      continue;
    }
    if (profile.family === 'garden') {
      if (!lakeside) block('grass', ward.x, elevation + 0.12, ward.z,
        ward.width - 4, 0.12, ward.depth - 4);
      for (let i = 0; i < 18; i++) {
        const x = ward.x + (rng() - 0.5) * 100;
        const z = ward.z + (rng() - 0.5) * 74;
        const size = 0.8 + rng() * 0.6;
        if (!nearQujiang(x, z)) tree(x, z, size, groundAt(x, z));
      }
      if (ward.row < 2) {
        batches.hall(hip, ward.x, ward.z, 30, 19, 1.4);
        block('water', ward.x - 22, 0.22, ward.z + 14, 28, 0.12, 24);
      }
      continue;
    }
    buildWardInterior(kit, ward);
    if (profile.family === 'temple') continue;
    for (let i = 0; i < 3; i++) {
      tree(ward.x - ward.width / 2 + 6 + rng() * 5,
        ward.z - 28 + i * 26, 0.7, elevation);
    }
  }

  createMarkets(kit);
  createWesternChannels(kit);
  createAvenueDrains(kit, groundAt);
  createNorthernQuarters(kit, (points, width) => road(points, width, CITY_SURFACES.wardRoad));
  createImperialCity(kit);

  // 外郭城门拆为门墩与上部横梁，保留真实贯通的门洞。
  const gate = (x: number, z: number, rotation: number, main = false) => {
    if (main) { createMingdeGate(kit); return; }
    const put = (lx: number, ly: number, lz: number, w: number, h: number, d: number) => {
      const p = new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
      block('earth', x + p.x, ly, z + p.z, w, h, d, rotation);
    };
    const span = main ? 60 : 40;
    for (const dx of [-1, 1]) put(dx * (span / 2 - 6), 6, 0, 12, 12, 12);
    put(0, 11, 0, span, 4, 12);
    for (const dx of main ? [-12, 0, 12] : [0]) put(dx, 5.6, 0, 3, 11, 12);
    batches.hall(hip, x, z, span + 4, 19, main ? 1.6 : 1.25, rotation, 13);
  };
  const wallSpan = (
    x: number, z: number, length: number, rotation: number, gates: number[], gateHalf = 34,
  ) => {
    const half = length / 2;
    const sorted = [-half, ...gates, half];
    const opening = rotation === 0 && z === HUANG_INLET.wallZ
      ? { center: HUANG_INLET.wallX - x, width: HUANG_INLET.clearWidth,
        height: HUANG_INLET.clearHeight }
      : rotation === Math.PI / 2 && x === LONGSHOU_INLET.wallX
        ? { center: z - LONGSHOU_INLET.wallZ, width: LONGSHOU_INLET.clearWidth,
          height: LONGSHOU_INLET.clearHeight } : undefined;
    for (let i = 0; i < sorted.length - 1; i++) {
      const start = sorted[i] + (i === 0 ? 0 : gateHalf);
      const end = sorted[i + 1] - (i === sorted.length - 2 ? 0 : gateHalf);
      const mid = (start + end) / 2;
      const cx = x + mid * Math.cos(rotation);
      const cz = z - mid * Math.sin(rotation);
      if (opening) {
        // 局部墙轴拆涵口，南、东墙共用断面；不删除整墙或挪动既有城门。
        for (const part of channelWallSegments(start, end,
          opening.center, opening.width, opening.height)) {
          block('earth', x + part.x * Math.cos(rotation), part.y,
            z - part.x * Math.sin(rotation), part.width, part.height, 9, rotation);
        }
      } else block('earth', cx, 5.5, cz, end - start, 11, 9, rotation);
      block('paving', cx, 11.1, cz, end - start, 0.3, 9.3, rotation);
      for (let p = start; p < end; p += 8) {
        const px = x + p * Math.cos(rotation);
        const pz = z - p * Math.sin(rotation);
        block('earth', px, 12, pz, 4.4, 1.8, 9, rotation);
      }
      for (let p = start + 40; p < end - 25; p += 110) {
        const px = x + p * Math.cos(rotation);
        const pz = z - p * Math.sin(rotation);
        if (opening && Math.abs(p - opening.center) < (17 + opening.width) / 2) continue;
        block('earth', px, 6, pz, 17, 12, 19, rotation);
      }
    }
    for (const pos of gates) {
      gate(x + pos * Math.cos(rotation), z - pos * Math.sin(rotation), rotation,
        x === 0 && z === CITY.south && pos === 0);
    }
  };
  wallSpan(0, CITY.south, 1680, 0, [-560, 0, 560]);
  // 大明宫南墙与外郭北墙共线；两端接合而不在丹凤门处叠墙。
  const westNorthMid = (CITY.west + DAMING_WALL.west) / 2;
  wallSpan(westNorthMid, CITY.north, DAMING_WALL.west - CITY.west, 0,
    [FANGLIN_X - westNorthMid, -westNorthMid], 20);
  wallSpan((DAMING_WALL.east + CITY.east) / 2, CITY.north,
    CITY.east - DAMING_WALL.east, 0, []);
  wallSpan(CITY.west, -55, 1530, Math.PI / 2, [-470, 30, -55 - KAIYUAN_STREET_Z]);
  wallSpan(CITY.east, -55, 1530, Math.PI / 2, [-470, 30, 530]);

  createPalaces(kit);
  createStreetScenes(kit);

  // 两塔分别采用楼阁式和十五层密檐轮廓，保留原占地与树位。
  createTemplePagodas(kit);

  const water = createQujiang(kit, materials.water);
  scene.add(water);
  // 巷曲井台随重构保留公共空间，井沿不依赖某个住宅模板附带生成。
  block('stone', 223, 0.6, 538, 2.8, 1.1, 2.8);
  block('dark', 223, 1.18, 538, 1.5, 0.08, 1.5);
  for (let z = -260; z < 700; z += 25) {
    for (const sign of [-1, 1]) {
      tree(sign * 21, z, 1.05 + rng() * 0.25);
    }
  }
  // 城市灯光用自发光实例，不为每盏灯创建动态点光源。
  for (let z = -240; z < 690; z += 32) {
    for (const sign of [-1, 1]) {
      block('wood', sign * 27, groundAt(sign * 27, z) + 2, z, 0.15, 4, 0.15);
      block('lamp', sign * 27, groundAt(sign * 27, z) + 3.9, z, 0.7, 1, 0.7);
    }
  }
  batches.finish();
  vegetation.finish();
  // 两片可动门共用一个实例网格。切时辰才改矩阵，不为开合维持动画循环。
  const doors = new THREE.InstancedMesh(box, materials.wood, 2);
  doors.name = '坊门昼夜门扇';
  doors.castShadow = true;
  doors.receiveShadow = true;
  const doorTransform = new THREE.Object3D();
  const setNight = (closed: boolean) => {
    doors.userData.closed = closed;
    for (let i = 0; i < 2; i++) {
      const direction = i === 0 ? 1 : -1;
      const angle = closed ? 0 : direction * Math.PI / 2;
      const hinge = i === 0 ? 77 : 83;
      doorTransform.position.set(hinge + direction * 1.5 * Math.cos(angle),
        1.9, 464 - direction * 1.5 * Math.sin(angle));
      doorTransform.rotation.set(0, angle, 0);
      doorTransform.scale.set(3, 3.6, 0.22);
      doorTransform.updateMatrix();
      doors.setMatrixAt(i, doorTransform.matrix);
    }
    doors.instanceMatrix.needsUpdate = true;
    doors.computeBoundingSphere();
  };
  setNight(false);
  scene.add(doors);
  return { batches, wards, water, doors, setNight, vegetation };
}

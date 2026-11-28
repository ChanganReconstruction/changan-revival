import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CylinderGeometry, type BufferGeometry } from 'three';
import { boxGeometry, roofGeometry, type PrototypePart } from './architecture.ts';

export type BuildingForm = 'shop' | 'office' | 'academy' | 'manor' | 'pavilion' | 'drum' | 'passage';
const cache = new Map<BuildingForm, PrototypePart[]>();

// 同一类共享各材质的合并几何；店面、柱廊与门洞都实际留空，不贴窗户来代替。
export function functionalPrototype(form: BuildingForm): PrototypePart[] {
  const existing = cache.get(form);
  if (existing) return existing;
  const groups = new Map<PrototypePart['material'], BufferGeometry[]>();
  const part = (kind: PrototypePart['material'], geometry: BufferGeometry) => {
    const group = groups.get(kind) ?? [];
    group.push(geometry);
    groups.set(kind, group);
  };
  const box = (kind: PrototypePart['material'], x: number, y: number, z: number,
    w: number, h: number, d: number) => part(kind, boxGeometry(x, y, z, w, h, d));
  const shop = form === 'shop', pavilion = form === 'pavilion', drum = form === 'drum';
  const passage = form === 'passage';
  const enclosed = form === 'office' || form === 'manor';
  const post = form === 'office' || drum ? 'vermilion' : 'wood';
  const deck = passage ? 0 : shop ? 0.18 : pavilion ? 0.4 : 0.62;
  const eave = drum ? 7.1 : shop ? 3.7 : 4.7;
  if (deck) box('stone', 0, deck / 2, 0, 17.4, deck, 9.7);
  const bays = shop ? [-7.7, 0, 7.7]
    : passage ? [-8, 8] : pavilion || drum ? [-7.2, 7.2] : [-7.7, -2.4, 2.4, 7.7];
  for (const x of bays) for (const z of [-3.7, 3.7]) {
    const height = (drum ? 4.4 : eave) - deck;
    box(post, x, deck + height / 2, z, shop ? 0.48 : 0.55, height, 0.55);
  }
  if (shop) {
    box('wall', 0, 1.92, -3.5, 15.5, 3.5, 0.4);
    for (const x of [-7.55, 7.55]) box('wood', x, 1.94, -1.35, 0.35, 3.5, 4.4);
    for (const x of [-4.05, 4.05]) {
      box('wood', x, 0.86, 3.4, 5.5, 0.75, 1.28);
      box('cloth', x, 3.25, 4.72, 7.3, 0.12, 1.52);
    }
  } else if (drum) {
    box('wood', 0, 4.44, 0, 16.6, 0.38, 8.8);
    for (const x of [-5.9, 5.9]) for (const z of [-3.05, 3.05]) {
      box(post, x, 5.85, z, 0.55, 2.7, 0.55);
    }
    box('wood', 0, 5.03, 3.62, 15.5, 0.2, 0.24);
    box('wood', 0, 5.95, -3.6, 15.4, 2.4, 0.35);
    // 鼓置于阁层内，鼓面向南，不悬在旁边的巷道上。
    box('wood', 0, 5.12, 0.9, 4.1, 0.6, 2.15);
    part('vermilion', new CylinderGeometry(1.02, 1.02, 1.45, 10)
      .rotateX(Math.PI / 2).translate(0, 6.18, 0.9));
    part('cloth', new CylinderGeometry(0.9, 0.9, 0.1, 10)
      .rotateX(Math.PI / 2).translate(0, 6.18, 1.64));
    part('roof', roofGeometry('hip').scale(0.9, 0.12, 0.77).translate(0, 4.08, 0));
  } else if (pavilion) {
    for (const x of bays) box('wood', x, 1.27, 0, 0.24, 0.18, 7.4);
    box('wood', 0, 1.27, -3.7, 14.4, 0.18, 0.24);
  } else if (!passage) {
    box('wall', 0, (eave + deck) / 2, -3.25, 15.5, eave - deck, 0.45);
    if (enclosed) {
      const front = form === 'manor' ? 2.2 : 0.75;
      for (const side of [-1, 1]) {
        box('wall', side * 7.6, 2.55, (front - 3.25) / 2, 0.4, 3.85, front + 3.25);
        box('wall', side * 4.75, 2.55, front, 5.7, 3.85, 0.38);
        box(post, side * 1.96, 2.28, front + 0.24, 0.26, 3.32, 0.25);
      }
      box(post, 0, 3.96, front + 0.24, 4.14, 0.28, 0.25);
      if (form === 'manor') box('wood', 0, 2.28, front - 0.24, 3.6, 3.32, 0.28);
    } else {
      // 讲堂敞开前方，两列低席不封堵中央通道。
      for (const x of [-4.3, 4.3]) box('wood', x, 0.85, -0.1, 4.8, 0.46, 1.6);
    }
    box('stone', 0, deck / 4, 5.06, enclosed ? 5.8 : 8.2, deck / 2, 0.47);
  }
  for (const z of [-3.7, 3.7]) box(post, 0, eave - 0.1, z, 16.3, 0.34, 0.45);
  const roof = roofGeometry(pavilion ? 'pyramid' : shop ? 'gable'
    : form === 'manor' ? 'hipgable' : 'hip');
  part('roof', roof.scale(drum ? 0.79 : 0.89, shop ? 0.56 : 0.68, drum ? 0.73 : 0.83)
    .translate(0, eave, 0));
  const result = Array.from(groups, ([material, group]) => {
    const pieces = group.map((geometry) => geometry.index ? geometry.toNonIndexed() : geometry);
    const geometry = mergeGeometries(pieces);
    if (!geometry) throw new Error(`建筑原型合并失败：${form}`);
    for (const piece of new Set([...group, ...pieces])) piece.dispose();
    geometry.name = `${form}:${material}`;
    return { geometry, material };
  });
  cache.set(form, result);
  return result;
}

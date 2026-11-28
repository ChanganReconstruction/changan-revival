import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxGeometry, roofGeometry, type PrototypePart } from './architecture.ts';

type OfficeForm = 'hall' | 'wing' | 'gate';
const cache = new Map<OfficeForm, PrototypePart[]>();

// 皇城限定形制。所有院复用这三套合并几何；不是已知官署的遗址复原。
export function officePrototype(form: OfficeForm): PrototypePart[] {
  const existing = cache.get(form);
  if (existing) return existing;
  type Geometry = PrototypePart['geometry'];
  const groups = new Map<PrototypePart['material'], Geometry[]>();
  const push = (material: PrototypePart['material'], geometry: Geometry) => {
    const group = groups.get(material) ?? [];
    group.push(geometry);
    groups.set(material, group);
  };
  const box = (material: PrototypePart['material'], x: number, y: number, z: number,
    w: number, h: number, d: number) => push(material, boxGeometry(x, y, z, w, h, d));

  const gate = form === 'gate', main = form === 'hall';
  const deck = gate ? 0 : main ? 1.05 : 0.64;
  const eave = main ? 5.8 : gate ? 4.95 : 4.5;
  const column = main || gate ? 'vermilion' : 'wood';
  const frontage = main ? 4.02 : 3.8;
  if (!gate) {
    box('stone', 0, deck / 2, 0, 18.4, deck, 10.7);
    box('paving', 0, deck - 0.045, 0, 18.7, 0.16, 11);
    for (let i = 0; i < 3; i++) {
      const rise = deck * (3 - i) / 3;
      box('stone', 0, rise / 2, 5.64 + i * 0.48, main ? 4.4 : 3.6, rise, 0.49);
    }
  }
  // 署厅只在敞开前檐设四柱，背面和厢房以实墙收边；门柱集中于通口两侧。
  const rows = gate ? [[-frontage, [-3.1, 3.1]], [frontage, [-3.1, 3.1]]] as const
    : main ? [[frontage, [-8, -2.75, 2.75, 8]]] as const : [];
  for (const [z, columns] of rows) {
    for (const x of columns) {
      box('stone', x, deck + 0.15, z, 0.8, 0.3, 0.8);
      box(column, x, (deck + eave) / 2, z, 0.46, eave - deck, 0.46);
      box('wood', x, eave - 0.55, z, 0.9, 0.24, 0.65);
      box('wood', x, eave - 0.31, z, 1.32, 0.24, 0.82);
    }
  }
  for (const z of [-frontage, frontage]) {
    box(column, 0, eave - 0.48, z, 16.6, 0.33, 0.36);
    box('wood', 0, eave - 0.19, z * 1.20, 17.8, 0.25, 0.31);
  }
  if (gate) {
    for (const side of [-1, 1]) {
      box('wall', side * 5.7, 2.04, 0, 4.65, 4.08, 0.55);
      box('stone', side * 3.1, 0.19, 0.28, 1.02, 0.38, 1.15);
    }
    box(column, 0, 3.97, 0, 6.5, 0.33, 0.49);
  } else {
    const face = main ? 1.55 : 2.58;
    for (const side of [-1, 1]) {
      const height = eave - deck - 0.38;
      box('wall', side * 7.75, deck + height / 2, (face - 3.84) / 2,
        0.32, height, face + 3.84);
      box('wall', side * 4.6, deck + height / 2, face, 6.64, height, 0.3);
      for (const offset of [3.23, 6.06]) {
        const x = side * offset, y = deck + (main ? 2.45 : 1.92);
        box('dark', x, y, face + 0.18, 1.78, 1.52, 0.075);
        for (const dx of [-0.9, -0.44, 0, 0.44, 0.9]) {
          box('wood', x + dx, y, face + 0.26, 0.11, 1.68, 0.12);
        }
        for (const dy of [-0.8, 0, 0.8]) {
          box('wood', x, y + dy, face + 0.26, 1.92, 0.105, 0.12);
        }
      }
      box(column, side * 1.25, deck + 1.38, face + 0.24, 0.21, 2.76, 0.2);
      box('wood', side * 0.64, deck + 1.24, face - 0.12, 1.18, 2.48, 0.22);
      box('dark', side * 0.17, deck + 1.11, face + 0.025, 0.09, 0.22, 0.075);
    }
    box('wall', 0, (eave + deck) / 2, -3.84, 15.7, eave - deck, 0.32);
    box('wall', 0, (eave + deck + 2.76) / 2, face, 2.6, eave - deck - 2.76, 0.32);
    box(column, 0, deck + 2.73, face + 0.25, 2.68, 0.2, 0.23);
  }
  const rise = main ? 0.73 : 0.58;
  const roof = main ? 'hipgable' : gate ? 'hip' : 'gable';
  push('roof', roofGeometry(roof).scale(0.93, rise, 0.89).translate(0, eave, 0));
  const ridge = roof === 'hipgable' ? 14.9 : roof === 'hip' ? 10.5 : 18.8;
  box('roof', 0, eave + rise * 3.5 + 0.1, 0, ridge, 0.27, 0.33);
  const result = Array.from(groups, ([material, geometry]) => {
    const pieces = geometry.map((piece) => piece.index ? piece.toNonIndexed() : piece);
    const merged = mergeGeometries(pieces);
    if (!merged) throw new Error(`官署构件合并失败：${form}`);
    for (const piece of new Set([...geometry, ...pieces])) piece.dispose();
    merged.name = `imperial-${form}:${material}`;
    return { material, geometry: merged };
  });
  cache.set(form, result);
  return result;
}

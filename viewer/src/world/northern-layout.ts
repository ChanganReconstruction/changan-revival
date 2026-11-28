import { CITY, DAMING_SHIFT_Z } from './layout.ts';

export const TAIJI = {
  west: -250, east: 250, north: CITY.north, south: -574,
  westPartition: -112, eastPartition: 112,
} as const;
export const IMPERIAL = { west: -250, east: 250, north: -534, south: -285 } as const;
export const PALACE_CROSS_STREET = (TAIJI.south + IMPERIAL.north) / 2;
// 《坊考》记大街止于来庭坊。外郭其余街道以横街转接，不把丹凤门轴线贯穿至城南。
export const DANFENG_AVENUE = { x: 520, north: CITY.north, south: -475, width: 108 } as const;
export const DAMING_WALL = { west: 330, east: 710, south: CITY.north,
  north: -1180 + DAMING_SHIFT_Z } as const;
export const FANGLIN_X = -277;
// 辅兴坊南街向西出开远门；精确线位从旧展示网格折算，并非门址坐标。
export const KAIYUAN_STREET_Z = -548;

interface NorthernWard {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
}

// 仅用文献确定坊序和邻接关系；边线和进深是当前城市网格的展示尺度。
const row = (column: string, x: number, width: number,
  names: string[], centers: number[], depths: number[]): NorthernWard[] =>
  names.map((name, i) => ({ id: `${column}-${i}`, name, x, z: centers[i]!,
    width, depth: depths[i]! }));

const westZ = [-750, -613, -480, -347];
const westDepths = [106, 112, 108, 110];
export const NORTHERN_WARDS = [
  ...row('nw-inner', -363, 140, ['修德坊', '辅兴坊', '颁政坊', '布政坊'], westZ, westDepths),
  ...row('nw-middle', -531, 156, ['安定坊', '休祥坊', '金城坊', '醴泉坊'], westZ, westDepths),
  ...row('nw-outer', -727, 174, ['修真坊', '普宁坊', '义宁坊', '居德坊'], westZ, westDepths),
  ...row('ne-inner', 380, 158, ['光宅坊', '永昌坊'], [-728, -548], [146, 116]),
  ...row('ne-middle', 626, 88, ['翊善坊', '来庭坊'], [-728, -548], [146, 116]),
  ...row('ne-outer', 751, 122, ['延政坊', '太宁坊'], [-728, -548], [146, 116]),
  ...row('ne-south', 407, 226, [''], [-386], [142]),
  ...row('ne-southeast', 668, 254, [''], [-386], [142]),
];

// 方位据《坊考》，在相应坊内只锚定一处展示院落，不据记载推定建筑平面。
export const NORTHERN_SITES = [
  { id: 'xingfu-temple', ward: 'nw-inner-0', name: '兴福寺（意象）',
    side: -1, column: 1, half: 0 },
  { id: 'guangzhai-temple', ward: 'ne-inner-0', name: '光宅寺 · 七宝台（意象）',
    side: 1, column: 0, half: 0 },
  { id: 'anguo-temple', ward: 'ne-outer-0', name: '大安国寺（意象）',
    side: 1, column: 1, half: 0 },
] as const;

export function northernLot(ward: NorthernWard, side: number, column: number, half: number) {
  const columns = ward.width < 106 ? 1 : ward.width > 205 ? 3 : 2;
  const width = (ward.width / 2 - 10) / columns;
  return { x: ward.x + side * (5 + (column + 0.5) * width),
    z: ward.z + ward.depth * (half === 0 ? -0.24 : 0.28), width };
}

// 接顺程序化坊网而非另开历史街道；转折仅出现在两套展示网格的接缝。
export const NORTHERN_CONNECTORS: Array<[number, number]> = [
  [-827, -819], [-624, -543], [-446, -400.25], [-277, -264],
  [275, 267], [535, 543], [681, 681], [819, 819],
];

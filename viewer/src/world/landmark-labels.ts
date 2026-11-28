import { CITY, DAMING_SHIFT_Z, PLACES, type Ward } from './layout.ts';
import { districtFor } from './districts.ts';
import { planWard } from './ward-composition.ts';
import { CAO_STORAGE } from './cao-storage.ts';
import { HUAE_LAYOUT } from './huae-complex.ts';
import { WESTERN_CHANNELS, WESTERN_CROSSINGS, WESTERN_BRIDGE_TOP } from './western-channels.ts';
import { LONGSHOU_BRIDGE } from './longshou-inlet.ts';
import { DANFENG_AVENUE, FANGLIN_X, KAIYUAN_STREET_Z, NORTHERN_SITES, NORTHERN_WARDS,
  PALACE_CROSS_STREET, TAIJI, northernLot } from './northern-layout.ts';

export interface SceneLabel {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rank: number;
  near?: number;
}

const local = (id: string, name: string, x: number, y: number, z: number,
  near = 520, rank = 3): SceneLabel => ({ id, name, x, y, z, near, rank });

const LANDMARKS = [
  local('danfeng', '丹凤门', DANFENG_AVENUE.x, 32, DANFENG_AVENUE.north, 950),
  local('danfeng-avenue', '丹凤门大街', DANFENG_AVENUE.x, 2,
    (DANFENG_AVENUE.north + DANFENG_AVENUE.south) / 2, 690),
  local('hanyuan', '含元殿', 520, 52, -860 + DAMING_SHIFT_Z, 950, 2),
  local('xuanzheng', '宣政殿', 520, 25, -928 + DAMING_SHIFT_Z, 760),
  local('zichen', '紫宸殿', 520, 23, -1012 + DAMING_SHIFT_Z, 760),
  local('linde', '麟德殿', 402, 35, -970 + DAMING_SHIFT_Z, 760),
  local('taiye', '太液池', 603, 12, -1108 + DAMING_SHIFT_Z, 760),
  local('penglai', '蓬莱山岛亭（示意）', 630, 22, -1092 + DAMING_SHIFT_Z, 360),
  local('taiye-gallery', '太液池岸廊（示意）', 701, 15, -1101 + DAMING_SHIFT_Z, 300, 4),
  local('daming-garden', '大明宫后苑（示意）', 464, 18, -1137 + DAMING_SHIFT_Z, 440),
  local('taiji-hall', '太极殿', 0, 46, -650, 840, 2),
  local('taiji-inner-hall', '太极宫后殿（示意）', 0, 28, -731, 490),
  local('taiji-residence', '太极宫寝院（示意）', 0, 18, -790, 385),
  local('taiji-side-hall', '太极宫偏殿（示意）', 72, 22, -757, 380),
  local('chengtian', '承天门', 0, 24, TAIJI.south, 740),
  local('palace-cross-street', '承天门前横街', 153, 2, PALACE_CROSS_STREET, 480),
  local('zhuque-gate', '朱雀门', 0, 23, -285, 780),
  local('east-palace', '东宫主殿（示意）', 181, 28, -662, 710, 2),
  local('east-palace-gate', '东宫门殿（示意）', 181, 18, -595, 440),
  local('taiji-garden', '太极宫侧园（示意）', -72, 8, -751, 430),
  local('east-palace-garden', '东宫小园（示意）', 215, 9, -748, 315),
  local('yeting', '掖庭宫', -183, 9, -705, 660),
  local('longchi', '龙池', 750, 3, -155, 600),
  local('huae', '花萼相辉楼', HUAE_LAYOUT.x + 15, 35, HUAE_LAYOUT.z, 680),
  local('chenxiang', '沉香亭', 800, 8, -146, 500),
  local('xingqing-halls', '兴庆宫殿院（示意）', 727, 11, -256, 440),
  local('longchi-walk', '龙池岸亭（示意）', 740, 8, -194, 300),
  local('longchi-shore', '龙池东岸园路（示意）', 791, 3, -127, 260, 4),
  local('jinguang', '金光门', CITY.west, 26, -85, 750),
  local('kaiyuan', '开远门（位置示意）', CITY.west, 26, KAIYUAN_STREET_Z, 650),
  local('west-south-gate', '外郭南门 · 西侧（示意）', -560, 26, CITY.south, 500),
  local('east-south-gate', '外郭南门 · 东侧（示意）', 560, 26, CITY.south, 500),
  local('fanglin', '芳林门（位置示意）', FANGLIN_X, 26, CITY.north, 500),
  local('taiji-north-gate', '太极宫北门（位置示意）', 0, 26, CITY.north, 500),
  local('ward-drum', '坊鼓楼（示意）', 112, 12, 458, 310),
  local('well', '昌乐坊井台（示意）', 223, 5, 538, 250),
  local('east-shops', '东市铺面（示意）', 478, 6, 282, 310),
  local('east-market-tower', '东市楼阁（示意）', 474, 13, 261, 360),
  local('west-shops', '西市沿街铺面（示意）', -513.5, 7, 282, 320),
  local('west-cargo', '西市货院（示意）', -474, 3, 261, 340),
  local('cao-storage', '西市贮木潭（位置示意）', CAO_STORAGE.x, 3, CAO_STORAGE.z, 300),
  local('longshou-bridge', '龙首渠便桥（示意）', LONGSHOU_BRIDGE.x, LONGSHOU_BRIDGE.top + 2,
    (LONGSHOU_BRIDGE.north + LONGSHOU_BRIDGE.south) / 2, 280),
  local('qujiang-island', '曲江岛亭（示意）', 729, 11, 550, 440),
  local('ziyun', '紫云楼（意象）', 645, 16, 492, 620),
  local('qujiang-west-hall', '曲江西岸水榭（示意）', 578, 9, 514, 440),
  local('qujiang-east-hall', '曲江东岸水榭（示意）', 789, 7, 506, 440),
  local('qujiang-walkway', '曲江栈道（示意）', 679, 3, 522, 300),
  ...([-1, 1] as const).flatMap((side) => [
    ...[415, -85, -585].flatMap((z, i) => side < 0 && i !== 0 ? [] : [
      local(`wall-gate-${side}-${i}`, `外郭${side < 0 ? '西' : '东'}门 · ${['南侧', '中部', '北侧'][i]}（示意）`,
        side < 0 ? CITY.west : CITY.east, 26, z, 500),
    ]),
    ...[-387, -483].map((z, i) => local(`imperial-office-${side}-${i}`,
      `皇城${side < 0 ? '西' : '东'}署院（示意）`, side * 144, 15, z, 490)),
    local(`square-pavilion-${side}`, '横街街亭（示意）', side * 154, 9, -268, 360),
  ]),
  ...NORTHERN_WARDS.flatMap(({ id, name, x, z, depth }) => [
    ...(name ? [local(id, name, x, 8, z, 710)] : []),
    local(`gate-${id}`, `${name || '坊'}门（示意）`, x, 7, z + depth / 2, 200, 5),
  ]),
  ...NORTHERN_SITES.map((site) => {
    const ward = NORTHERN_WARDS.find(({ id }) => id === site.ward)!;
    const { x, z } = northernLot(ward, site.side, site.column, site.half);
    return local(site.id, site.name, x, 11, z - 10, 610);
  }),
  ...WESTERN_CHANNELS.flatMap((channel) => WESTERN_CROSSINGS.map((z, i) =>
    local(`${channel.id}-bridge-${i}`, `${channel.name}街桥（示意）`,
      channel.x, WESTERN_BRIDGE_TOP + 1, z, 235, 4))),
];

const WARD_LANDMARKS: Record<string, string> = {
  'E1-2': '荐福寺（意象）', 'E1-3': '荐福寺浮图院', 'E1-5': '大兴善寺',
  'E2-1': '国子监讲堂（意象）', 'E3-1': '永兴坊府第（示意）',
  'E3-2': '崇仁坊乐器作坊（示意）', 'E3-3': '平康坊北里（意象）', 'E3-5': '亲仁坊宅第（示意）',
  'E4-9': '大慈恩寺', 'E5-6': '青龙寺（意象）', 'E5-7': '乐游原（意象）',
  'E6-8': '芙蓉园（意象）',
  'W1-3': '西明寺（意象）', 'W1-5': '玄都观（意象）',
  'W3-1': '贵戚宅第（示意）', 'W3-2': '金银铺（示意）', 'W3-4': '胡祆祠（意象）',
  'W3-5': '波斯胡寺（意象）', 'W3-7': '胡客货院（示意）', 'W3-9': '胡饼铺（示意）',
  'W6-9': '大庄严寺（意象）',
};
const WARD_TYPES: Record<string, string> = {
  temple: '寺观院落（示意）', office: '官署学舍（示意）', manor: '园居宅第（示意）',
};

export function makeSceneLabels(wards: Ward[]): SceneLabel[] {
  const labels = [...PLACES, ...LANDMARKS];
  for (const ward of wards) {
    const profile = districtFor(ward);
    const name = WARD_LANDMARKS[ward.id] ?? WARD_TYPES[profile.family];
    if (name) {
      // 将组群名锚在主殿／主厅，而不是坊心或隔壁道路。
      const main = planWard(ward).houses.reduce<ReturnType<typeof planWard>['houses'][number] | undefined>(
        (largest, house) => !largest || house.width * house.depth > largest.width * largest.depth
          ? house : largest, undefined);
      labels.push(local(`site-${ward.id}`, name, main?.x ?? ward.x,
        profile.elevation + (main ? main.height * 8 : 4), main?.z ?? ward.z,
        WARD_LANDMARKS[ward.id] ? 520 : 250, WARD_LANDMARKS[ward.id] ? 3 : 4));
    }
    const parksWithoutWalls = ward.side === 1 && profile.family === 'garden'
      && (ward.row >= 7 || ward.column === 5 && ward.row <= 1);
    if (!parksWithoutWalls && profile.family !== 'market') {
      labels.push(local(`gate-${ward.id}`, `${profile.name === '坊名待考' ? '坊' : profile.name}门（示意）`,
        ward.x, profile.elevation + 9, ward.z + ward.depth / 2, 220, 5));
    }
  }
  return labels;
}

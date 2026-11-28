import type { Ward } from './layout';
import { terrainHeight } from './terrain.ts';

export type DistrictFamily = 'dense' | 'artisan' | 'manor' | 'office'
  | 'temple' | 'market' | 'garden' | 'sparse';

export type TempleLayout = 'axial' | 'paired' | 'grove' | 'street' | 'enclosed'
  | 'highland' | 'dayan' | 'xiaoyan';

export interface DistrictProfile {
  family: DistrictFamily;
  name: string;
  feature: string;
  elevation: number;
  roadTint: string;
  southwest?: 'sparse' | 'heping' | 'yongyang';
  templeLayout?: TempleLayout;
}

// 沿用原项目坊表的列序；部分坊名本有推定成分，压缩位置不能作为考古证据。
const NAMES_E = [
  '兴道 开化 安仁 光福 靖善 兰陵 开明 保宁 安义',
  '务本 崇义 长兴 永乐 靖安 安善 大业 昌乐 安德',
  '永兴 崇仁 平康 宣阳 亲仁 永宁 永崇 昭国 修行',
  '— 胜业 宣平 道政 东市 东市 常乐 靖恭 晋昌',
  '兴宁 永嘉 隆庆 安兴 升平 新昌 升道 立政 敦化',
  '— 永福 崇让 广化 丰安 临晋 永和 芙蓉 曲江',
].flatMap((column) => column.split(' '));
const NAMES_W = [
  '光德 善和 延康 — 崇业 — 丰乐 — 居安',
  '崇贤 太平 通义 长寿 嘉会 永平 — — 怀德',
  '兴化 延寿 崇化 — — — — — —',
  '— — — 灵化 西市 西市 怀远 大通 大安',
  '崇德 群贤 道德 光行 — 安业 永达 归义 昭行',
  '— 广恩 灵应 永光 敦行 景行 咸宁 和平 永阳',
].flatMap((column) => column.split(' '));

const NAMED: Record<string, Partial<DistrictProfile>> = {
  'E1-2': { feature: '荐福寺意象 · 清静廊院', family: 'temple', templeLayout: 'enclosed' },
  'E1-3': { feature: '荐福寺浮图院 · 小雁塔', family: 'temple', templeLayout: 'xiaoyan' },
  'E1-5': { feature: '大兴善寺 · 整坊殿阁', family: 'temple', templeLayout: 'axial', elevation: 4 },
  'W1-3': { feature: '西明寺意象 · 殿堂与林荫', family: 'temple', templeLayout: 'grove' },
  'W1-5': { feature: '玄都观意象 · 并列双院', family: 'temple', templeLayout: 'paired', elevation: 3 },
  'E2-1': { feature: '国子监意象 · 讲堂与庭院', family: 'office' },
  'E3-1': { feature: '府第意象 · 多进深院', family: 'manor' },
  'E3-2': { feature: '乐器作坊 · 邸店巷曲', family: 'artisan' },
  'E3-3': { feature: '北里意象 · 举子与街肆', family: 'artisan' },
  'E3-5': { feature: '宅第意象 · 大院与附院', family: 'manor' },
  'W3-1': { feature: '贵戚宅第意象 · 府院与园圃', family: 'manor' },
  'W3-2': { feature: '金银铺意象 · 小铺连巷', family: 'artisan' },
  'W3-4': { feature: '胡祆祠意象 · 院落与杂居', family: 'temple', templeLayout: 'street' },
  'W3-5': { feature: '波斯胡寺意象 · 邻市廊院', family: 'temple', templeLayout: 'enclosed' },
  'W3-7': { feature: '胡客聚居意象 · 邸店与货院', family: 'artisan' },
  'W3-9': { feature: '胡饼铺意象 · 沿巷作坊', family: 'artisan' },
  // 只校核西南角的相对坊序；其他已移出的旧标签留待全城坊表校核。
  'W4-8': { family: 'sparse', southwest: 'sparse' },
  'W4-9': { family: 'sparse', southwest: 'sparse' },
  'W5-8': { family: 'sparse', southwest: 'sparse' },
  'W5-9': { family: 'sparse', southwest: 'sparse' },
  'W6-8': { family: 'sparse', southwest: 'heping', feature: '寺院关联用地 · 院落为示意' },
  'W6-9': { family: 'temple', southwest: 'yongyang', feature: '大庄严寺意象 · 坊东殿院' },
  'E4-9': { feature: '大慈恩寺 · 大雁塔', family: 'temple', templeLayout: 'dayan' },
  'E5-6': { feature: '新昌高地 · 青龙寺意象', family: 'temple', templeLayout: 'highland', elevation: 9 },
  'E5-7': { feature: '乐游原游赏意象 · 疏林望城', family: 'garden', elevation: 5 },
  'E6-8': { feature: '芙蓉园意象 · 池岸亭榭', family: 'garden' },
  'E6-9': { feature: '曲江池 · 水曲流饮', family: 'garden' },
};

const FEATURES: Record<DistrictFamily, string> = {
  dense: '密居里巷 · 长短宅列与井台', artisan: '街肆作坊 · 店棚与货院',
  manor: '府第园居 · 深院与附院', office: '官署学舍 · 规整庭院与讲堂',
  temple: '寺观廊院 · 殿阁与林荫', market: '市肆货院 · 布棚与仓场',
  garden: '疏林园圃 · 亭台与游路', sparse: '疏居坊巷 · 小院与园圃示意',
};

export function districtFor(ward: Ward): DistrictProfile {
  let family: DistrictFamily = 'dense';
  if (ward.kind === 'garden') family = 'garden';
  else if (ward.kind === 'market') family = 'market';
  else if (ward.kind === 'temple') family = 'temple';
  else if (ward.kind === 'manor') family = ward.column === 0 ? 'office' : 'manor';
  else if (Math.abs(ward.column - 3) <= 1 && ward.row >= 2 && ward.row <= 5) {
    family = 'artisan';
  } else if (ward.side === 1 && ward.row >= 7 && ward.column >= 3) family = 'garden';
  const named = NAMED[ward.id] || {};
  family = named.family || family;
  const tone = family === 'market' ? '#bdad95' : family === 'temple' || family === 'office'
    ? '#e4ded0' : family === 'garden' ? '#b8b18e' : '#bdac91';
  const names = ward.side === 1 ? NAMES_E : NAMES_W;
  const name = names[ward.column * 9 + ward.row];
  return {
    family, name: name === '—' ? '坊名待考' : name.endsWith('市') ? name : `${name}坊`,
    feature: FEATURES[family], roadTint: tone, ...named,
    elevation: Math.max(terrainHeight(ward.x, ward.z),
      named.elevation ?? (family === 'manor' ? 0.8 : 0)),
  };
}

export function sampleHeights(seed: number): { wall: number; width: number; depth: number } {
  // 有限比例变化，不生成每栋独有几何。高度不与平面同步等比缩放。
  const n = ((seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  return { wall: 0.72 + n * 0.46, width: 0.84 + n * 0.22, depth: 0.8 + (1 - n) * 0.28 };
}

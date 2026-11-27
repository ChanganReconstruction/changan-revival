export type Confidence = '高' | '中' | '待核';

export const GEOGRAPHY_SOURCES = {
  shi: 'https://www.unesco-hist.org/index.php?id=2252&r=article%2Finfo',
  xu: 'https://www.shidianguji.com/book/CADAL02086802/chapter/1lb2cfgiyp1yf',
  local: 'https://xadfz.xa.gov.cn/xadq/stxa/5da994d8f99d6527b6be7721.html',
} as const;

// x向东、z向南；只给相对山川方位，不把压缩模型坐标冒充历史测绘坐标。
export const BASIN_WATERS = [
  { id: 'wei', name: '渭水', sector: '北', confidence: '高', displayed: true },
  { id: 'jing', name: '泾水', sector: '北', confidence: '高', displayed: false },
  { id: 'ba', name: '灞水', sector: '东', confidence: '高', displayed: false },
  { id: 'chan', name: '浐水', sector: '东', confidence: '高', displayed: false },
  { id: 'feng', name: '沣水', sector: '西', confidence: '高', displayed: false },
  { id: 'lao', name: '涝水', sector: '西', confidence: '高', displayed: false },
  { id: 'hao', name: '滈水', sector: '南', confidence: '高', displayed: false },
  { id: 'yu', name: '潏水', sector: '南', confidence: '高', displayed: false },
] as const;

export interface ChannelPhase {
  id: string;
  name: string;
  since: number | null;
  until?: number;
  from: string;
  to: string;
  confidence: Confidence;
  note: string;
}

// 五渠的第五条含分期，不能将永泰二年扩建后的城内漕渠放进开元—天宝常态。
export const CHANNEL_PHASES: ChannelPhase[] = [
  { id: 'yongan', name: '永安渠', since: 583, from: '交水／潏水水系',
    to: '西部坊街—西市东—禁苑以北', confidence: '中',
    note: '来源水名与末段汇流表述有差异；先核路线，不照搬现代河道。' },
  { id: 'qingming', name: '清明渠', since: null, from: '潏水—丈八沟',
    to: '西部坊街—皇城—宫城诸海', confidence: '中',
    note: '隋开皇初年已开；精确开凿年不在当前全文证据中写死。' },
  { id: 'longshou', name: '龙首渠', since: 583, from: '浐水',
    to: '分支供兴庆宫、宫城及东内苑', confidence: '中',
    note: '东、西支与池苑末段历代有变化，不能画成一条横穿龙首原的直河。' },
  { id: 'huang', name: '黄渠', since: null, from: '义谷水',
    to: '城外东南—曲江', confidence: '中',
    note: '主要线位在城外；不为凑五渠而加一条穿城大河。' },
  { id: 'cao-wood', name: '漕渠·西市贮木段', since: 742,
    from: '金光门外南来水系', to: '西市贮木潭', confidence: '中',
    note: '天宝元年入城贮材木；不能倒推为开元初年全程已有。' },
  { id: 'cao-extension', name: '漕渠·永泰扩建段', since: 766,
    from: '西市', to: '绕坊街至苑渠', confidence: '中',
    note: '晚于开元—天宝，本阶段不渲染。' },
];

export function activeChannels(year: number): ChannelPhase[] {
  return CHANNEL_PHASES.filter((phase) => (phase.since === null || phase.since <= year)
    && (phase.until === undefined || year <= phase.until));
}

export const WEI_DISPLAY_PATH: readonly [number, number][] = [
  [-13000, -2500], [-7200, -2200], [-3900, -2350], [-2100, -2050],
  [-300, -2140], [1400, -1940], [3100, -2110], [6500, -1880], [13000, -1750],
];

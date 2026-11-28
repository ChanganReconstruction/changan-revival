import { nearQujiang } from './water-layout.ts';

export type WardKind = 'homes' | 'manor' | 'temple' | 'market' | 'garden';
export interface Ward {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  row: number;
  column: number;
  side: number;
  kind: WardKind;
}

export const CITY = { west: -840, east: 840, north: -820, south: 710 };
// 把既有大明宫组合的丹凤门移至外郭北墙，兴庆宫及普通坊网不随之移动。
export const DAMING_SHIFT_Z = CITY.north + 744;
export const SEED = 20261116;
export const QUJIANG = { x: 689, z: 593, radiusX: 112, radiusZ: 72 };

export function isDryShore(x: number, z: number): boolean {
  return !nearQujiang(x, z);
}

export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 坊位是艺术化布局单元；两市与园苑占用坊位，不在一百零八坊之外重复计数。
export function makeWards(): Ward[] {
  const widths = [100, 110, 120, 120, 120, 120];
  const wards: Ward[] = [];
  for (const side of [-1, 1]) {
    let left = 30;
    for (let c = 0; c < 6; c++) {
      const width = widths[c];
      for (let r = 0; r < 9; r++) {
        let kind: WardKind = r < 2 && c < 3 ? 'manor' : 'homes';
        if (c === 3 && (r === 4 || r === 5)) kind = 'market';
        if ((c + r * 3 + (side === 1 ? 2 : 0)) % 13 === 0) kind = 'temple';
        if (side === 1 && c >= 4 && r >= 7) kind = 'garden';
        if (side === 1 && c === 5 && r <= 1) kind = 'garden';
        wards.push({
          id: `${side === 1 ? 'E' : 'W'}${c + 1}-${r + 1}`,
          x: side * (left + width / 2), z: -260 + r * 106 + 44,
          width, depth: 88, row: r, column: c, side, kind,
        });
      }
      left += width + 18;
    }
  }
  return wards;
}

export const PLACES = [
  { id: 'wei', name: '渭水（河道示意）', x: -300, y: 12, z: -2140, rank: 1 },
  { id: 'zhongnan', name: '终南山', x: 0, y: 380, z: 4080, rank: 1 },
  { id: 'mingde', name: '明德门', x: 0, y: 28, z: 710, rank: 1 },
  { id: 'zhuque', name: '朱雀大街', x: 0, y: 2, z: 170, rank: 1 },
  { id: 'taiji', name: '太极宫', x: 0, y: 32, z: -670, rank: 1 },
  { id: 'imperial', name: '皇城', x: -80, y: 15, z: -370, rank: 2 },
  { id: 'daming', name: '大明宫', x: 520, y: 48, z: -920 + DAMING_SHIFT_Z, rank: 1 },
  { id: 'east', name: '东市', x: 474, y: 10, z: 261, rank: 2 },
  { id: 'west', name: '西市', x: -474, y: 10, z: 261, rank: 1 },
  { id: 'yongan', name: '永安渠（街段示意）', x: -408, y: 3, z: 100, rank: 2 },
  { id: 'qingming', name: '清明渠（街段示意）', x: -270, y: 3, z: 440, rank: 2 },
  { id: 'dayan', name: '大雁塔', x: 474, y: 74, z: 632, rank: 1 },
  { id: 'xiaoyan', name: '小雁塔', x: 80, y: 52, z: -4, rank: 2 },
  { id: 'qujiang', name: '曲江池', x: 680, y: 3, z: 600, rank: 1 },
  { id: 'huang', name: '黄渠末段（示意）', x: 727, y: 3, z: 774, rank: 2 },
  { id: 'xingqing', name: '兴庆宫', x: 750, y: 18, z: -195, rank: 2 },
  { id: 'longshou', name: '龙首西支（末段示意）', x: 830, y: 3, z: -280, rank: 2 },
];

export interface ViewPreset {
  name: string;
  subtitle: string;
  description: string;
  position: [number, number, number];
  target: [number, number, number];
}

export const VIEWS: Record<string, ViewPreset> = {
  basin: {
    name: '山川形胜', subtitle: '南山北渭 · 方位示意',
    description: '南望终南山，北见渭水。当前仅落地南山北渭骨架；河岸为压缩示意，'
      + '其余七水与城内五渠仍在分期核查，未假称完整历史水网。',
    position: [1200, 1100, -4200], target: [0, 140, 850],
  },
  mingde: {
    name: '国门明德', subtitle: '五门开阖 · 盛唐南望',
    description: '外郭南门的门墩、门道与重楼展开都城正面。由此沿朱雀大街，望向皇城。',
    position: [110, 65, 865], target: [0, 13, 710],
  },
  hengjie: {
    name: '横街广场', subtitle: '朱雀门外 · 轴线相逢',
    description: '横街在皇城南缘铺展，槐荫与街亭退让中央通行带；宫城与皇城之间另有承天门前的横街。',
    position: [190, 80, -120], target: [0, 5, -268],
  },
  hanyuanTop: {
    name: '含元俯瞰', subtitle: '龙首原上 · 殿阁临城',
    description: '从含元殿上空回望南向长安，重台、双阁、龙尾阶与坊市屋海串成朝仪序列。',
    position: [650, 180, -1010 + DAMING_SHIFT_Z], target: [450, 8, -550],
  },
  taiye: {
    name: '太液蓬莱', subtitle: '蓬莱叠翠 · 仙山倒影',
    description: '殿后曲岸围合池面，蓬莱山岛与岸廊保留水庭层次。当前为艺术化意象，未作考古尺度复原。',
    position: [790, 120, -925 + DAMING_SHIFT_Z], target: [600, 12, -1080 + DAMING_SHIFT_Z],
  },
  xingqing: {
    name: '花萼龙池', subtitle: '相辉楼阁 · 龙池清波',
    description: '龙首渠西支由通化门南入城供龙池，当前只绘末段示意，渠口与便桥非遗址实测。'
      + '花萼两层长翼接三层主楼，形制参研究复原，尺度与细节仍为艺术推定。',
    position: [858, 105, 20], target: [741, 10, -159],
  },
  xiaoyanta: {
    name: '小雁晨钟', subtitle: '安仁浮图 · 砖檐清影',
    description: '安仁坊浮图院的小雁塔采用密檐收分，区别于大雁塔宽厚舒展的七层轮廓。',
    position: [170, 78, 105], target: [80, 21, -4],
  },
  wardGate: {
    name: '坊门昼启', subtitle: '日开夜合 · 坊门有序',
    description: '开明坊门道保持真实贯通，钟鼓楼退居一侧。切换夜色，可见两扇坊门闭合。',
    position: [110, 15, 505], target: [84, 4, 462],
  },
  lane: {
    name: '巷曲井台', subtitle: '槐下提水 · 街坊日常',
    description: '昌乐坊的井架、槐荫和石凳，置于长短宅列之间。普通坊区近处也能看见必要细节。',
    position: [219, 9, 516], target: [223, 2, 538],
  },
  jinguang: {
    name: '金光驼影', subtitle: '西郭商旅 · 丝路归来',
    description: '双峰驼队从西郭走向金光门，驮包与夯土道路表现商旅意象；不模拟行人或交通。',
    position: [-922, 17, -25], target: [-872, 5, -81],
  },
  curfew: {
    name: '暮鼓夜禁', subtitle: '灯明坊闭 · 暮鼓一城',
    description: '选择本景自动入夜，门扇闭合，灯与窗从深色屋海中浮现。仍可手动切回其他时辰。',
    position: [123, 21, 509], target: [85, 4, 462],
  },
  city: {
    name: '万国长安', subtitle: '一城烟火 · 万里来朝',
    description: '千百家似围棋局，十二街如种菜畦。以里坊为经纬，望见盛唐都城的恢宏秩序。',
    position: [1500, 1250, 1900], target: [0, 0, -120],
  },
  avenue: {
    name: '天街纵目', subtitle: '天街九陌 · 晨光初上',
    description: '自明德门向北，朱雀天街直抵皇城。槐荫与坊墙之间，是长安最壮阔的轴线。',
    position: [145, 150, 640], target: [0, 8, -80],
  },
  palace: {
    name: '龙尾含元', subtitle: '九天阊阖 · 万国衣冠',
    description: '龙首原上，大明宫俯临长安。含元殿居高而立，两翼楼阁与龙尾道展开朝仪的序列。',
    position: [820, 280, -405 + DAMING_SHIFT_Z], target: [520, 30, -830 + DAMING_SHIFT_Z],
  },
  market: {
    name: '西市胡尘', subtitle: '东西万货 · 丝路回响',
    description: '商旅自远方而来，市肆依街成列。灰瓦、布幔与院落，织成市井日常的细密纹理。',
    position: [-330, 115, 416], target: [-474, 4, 261],
  },
  pagoda: {
    name: '雁塔登高', subtitle: '浮图入云 · 古寺清音',
    description: '慈恩寺塔立于坊间。层层砖檐收分，与低伏的屋海形成庄重而宁静的对照。',
    position: [600, 115, 760], target: [474, 27, 632],
  },
  lake: {
    name: '曲江流饮', subtitle: '水映亭台 · 城南有春',
    description: '城外黄渠由东南来水，末段经示意涵口入曲江。渠口位置、宽深与岸线为艺术处理，'
      + '上游和池水外溢支线尚未绘制，不作为历史测绘图。',
    position: [990, 200, 825], target: [680, 0, 575],
  },
  manor: {
    name: '永兴深院', subtitle: '府第样板 · 多进疏朗',
    description: '以永兴坊宅第意象，比较大院、附院与两层阁楼。布局为艺术化样板，非宅邸测绘复原。',
    position: [426, 78, -117], target: [336, 6, -214],
  },
  artisan: {
    name: '崇仁巷曲', subtitle: '作坊样板 · 街肆交错',
    description: '崇仁坊的乐器作坊与邸店意象：偏置巷道、长短宅列、布棚和货院，与整齐官署形成对照。',
    position: [410, 45, -41], target: [336, 4, -111],
  },
  temple: {
    name: '靖善梵阁', subtitle: '寺院样板 · 殿阁有序',
    description: '靖善坊大兴善寺意象：中轴殿堂、左右廊庑、钟鼓楼与抬升台地。保留寺院的疏朗与层次。',
    position: [163, 90, 310], target: [80, 10, 206],
  },
  eastMarket: {
    name: '东市珍奇', subtitle: '市肆样板 · 大铺货院',
    description: '东市采用更宽街巷与大铺货院；西市则强调棚幔、密铺与仓场。差异为游览设计，不是逐铺考证。',
    position: [590, 105, 416], target: [474, 4, 261],
  },
  qinglong: {
    name: '乐游青龙', subtitle: '高地样板 · 寺阁望城',
    description: '以新昌坊、乐游原的高地寺院意象，测试台地与坊市屋海之间的高低关系。',
    position: [715, 99, 404], target: [612, 16, 314],
  },
  craft: {
    name: '坊巷人家', subtitle: '深檐素壁 · 一院清风',
    description: '不以繁复装饰取胜：看舒展的屋面、深远的出檐、内退的墙身与院落之间的虚实。',
    position: [198, 20, 542], target: [170, 3.2, 497],
  },
};

// 十八处经典游览点完整保留；全城与三处建筑样板为额外机位。
export const CLASSIC_VIEWS = [
  'mingde', 'avenue', 'hengjie', 'palace', 'hanyuanTop', 'taiye', 'xingqing',
  'market', 'eastMarket', 'pagoda', 'xiaoyanta', 'qinglong', 'temple',
  'wardGate', 'lane', 'lake', 'jinguang', 'curfew',
] as const;

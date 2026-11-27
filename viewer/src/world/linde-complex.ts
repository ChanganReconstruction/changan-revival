import { roofGeometry } from './architecture.ts';
import type { LandmarkKit } from './landmark-kit';

// 屋盖、层高及平面比例为艺术示意，非考古实测复原。
export function createLindeComplex(
  kit: LandmarkKit, x: number, z: number, ground: number,
): void {
  const { block, batches } = kit;
  // 连续台基承托殿、楼和廊；总占地为场景压缩比例。
  block('stone', x, ground + 0.45, z, 104, 0.9, 124);
  block('yard', x, ground + 0.92, z, 102, 0.08, 122);

  const floor = ground + 0.96;
  const roof = roofGeometry('hip');
  // 北侧后殿较宽，中殿居中；南前殿前保留中庭。
  const halls = [
    { dx: 0, dz: -42, w: 68, d: 30, h: 2.7, eave: 10 },
    { dx: 0, dz: 0, w: 56, d: 34, h: 3.2, eave: 10 },
    { dx: 0, dz: 46, w: 54, d: 28, h: 2.8, eave: 10 },
  ];
  for (const hall of halls) {
    const hx = x + hall.dx;
    const hz = z + hall.dz;
    const halfW = hall.w / 2;
    const halfD = hall.d / 2;
    // 柱在墙前，常驻门窗面在素壁之外，不能让整块端墙再次遮住所有窗洞。
    const bays = 11;
    const step = (hall.w - 5) / bays;
    const wallZ = halfD - 3.3;
    for (const side of [-1, 1]) {
      block('wall', hx, floor + 4.65, hz + side * wallZ,
        hall.w - 5, 9.3, 0.45);
      block('vermilion', hx, floor + 9.7, hz + side * (halfD - 1.5),
        hall.w - 3, 0.6, 0.7);
      for (let i = 0; i <= bays; i++) {
        block('vermilion', hx - halfW + 2.5 + step * i,
          floor + hall.eave / 2, hz + side * (halfD - 1.5),
          0.8, hall.eave, 0.8);
      }
      for (let bay = 0; bay < bays; bay++) {
        block('dark', hx - halfW + 2.5 + step * (bay + 0.5), floor + 3.5,
          hz + side * (wallZ + 0.3), step * 0.66, 5.2, 0.06);
      }
      block('wall', hx + side * (halfW - 2.5), floor + 4.65, hz,
        0.45, 9.3, hall.d - 6.6);
    }
    batches.add(roof, 'roof', hx, floor + hall.eave,
      hz, hall.w / 20, hall.h, hall.d / 13);
  }

  const towerRoof = roof;
  // 中殿两侧为亭；北后殿两侧另置郁仪、结绮二楼。
  const sideBuildings = [
    { side: -1, zOffset: 0 }, { side: 1, zOffset: 0 },
    { side: -1, zOffset: -42 }, { side: 1, zOffset: -42 },
  ];
  for (const item of sideBuildings) {
    const tx = x + item.side * 40;
    const tz = z + item.zOffset;
    block('stone', tx, floor + 0.3, tz, 12, 0.6, 22);
    const eave = item.zOffset < 0 ? 10.4 : 6.6;
    // 后部二楼以中层平座和较高柱身区别于中部开敞亭，屋盖高度为游览方案。
    for (const height of [1.1, ...(item.zOffset < 0 ? [5.2] : []), eave - 0.4]) {
      for (const side of [-1, 1]) {
        block('wood', tx, floor + height, tz + side * 7,
          9, 0.45, 0.45);
        block('wood', tx + side * 4, floor + height, tz,
          0.45, 0.45, 15);
      }
    }
    for (const px of [-4, 4]) {
      for (const pz of [-7, 7]) {
        block('vermilion', tx + px, floor + (eave + 0.4) / 2, tz + pz,
          0.75, eave - 0.4, 0.75);
      }
    }
    batches.add(towerRoof, 'roof', tx, floor + eave, tz, 0.6, 1.3, 1.7);
  }

  // 两座后楼各有南向长廊，分段柱脚与回廊地坪共同承托廊身。
  for (const side of [-1, 1]) {
    const gx = x + side * 40;
    const startZ = z - 31;
    const endZ = z - 11;
    const centerZ = (startZ + endZ) / 2;
    const length = endZ - startZ;
    block('stone', gx, floor + 0.2, centerZ, 5, 0.4, length + 4);
    block('wood', gx, floor + 1.8, centerZ, 3.4, 2.8, length + 4);
    for (const offset of [-1, 1]) {
      for (let i = 0; i <= 4; i++) {
        const postZ = startZ + 1 + i * ((length - 2) / 4);
        block('vermilion', gx + offset * 1.8, floor + 1.8, postZ,
          0.45, 3.6, 0.45);
      }
    }
    batches.add(towerRoof, 'roof', gx, floor + 3.4, centerZ,
      length / 20, 0.45, 4.5 / 13, Math.PI / 2);
  }

  // 中殿两侧短廊接入亭楼，前殿与中殿之间保留中庭空间。
  for (const side of [-1, 1]) {
    const innerX = x + side * 28;
    const outerX = x + side * 35;
    const cx = (innerX + outerX) / 2;
    block('stone', cx, floor + 0.2, z, 7, 0.4, 5);
    block('wood', cx, floor + 1.7, z, 7, 2.6, 3.6);
    for (const edge of [-1, 1]) {
      block('vermilion', cx, floor + 1.7, z + edge * 1.7,
        7, 2.6, 0.35);
    }
    batches.add(towerRoof, 'roof', cx, floor + 3.05, z, 7 / 20, 0.42, 0.55);
  }
  // 低位连廊贯通三殿，南前庭两侧仍留空；连接屋盖属于可替换的艺术处理。
  for (const [dz, depth] of [[-22, 12], [24.5, 17]]) {
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        block('vermilion', x + side * 4.7, floor + 2.6,
          z + dz + end * (depth / 2 - 0.8), 0.65, 5.2, 0.65);
      }
    }
    batches.add(roof, 'roof', x, floor + 5.2, z + dz, 0.58, 0.5, depth / 13);
  }
}

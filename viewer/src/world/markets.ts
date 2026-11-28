import { random } from './layout.ts';
import { createCaoStorage } from './cao-storage.ts';
import type { LandmarkKit } from './landmark-kit';
import { functionalPrototype } from './functional-architecture.ts';

export function createMarkets(kit: LandmarkKit): void {
  const { block, batches, prototypes } = kit;
  for (const side of [-1, 1]) {
    const east = side > 0, x = side * 474, z = 261;
    const rng = random(east ? 256 : 128);
    // 两坊合为一市；井字街切九区，不在中间保留一条横穿市场的坊墙。
    block('paving', x, 0.17, z, 120, 0.25, 194, 0, east ? '#d9c9ae' : '#bdaa8e');
    for (const sign of [-1, 1]) {
      block('road', x + sign * 20, 0.33, z, east ? 7 : 6, 0.1, 194);
      block('road', x, 0.34, z + sign * 32.3, 120, 0.1, east ? 7 : 6);
      // 每边两门，两侧铺廊共同形成市场完整外缘。
      for (const [offset, span] of [[-43, 34], [0, 28], [43, 34]]) {
        block('earth', x + offset, 1.9, z + sign * 97, span, 3.6, 1.3);
      }
      for (const [offset, span] of [[-70, 54], [0, 52], [70, 54]]) {
        if (!east && sign === -1 && offset === 0) {
          // 西市低位进水涵只开六米宽，上部围墙保留，不能让水穿实心墙。
          for (const direction of [-1, 1]) {
            block('earth', x - 60, 1.9, z + direction * 14.5, 1.3, 3.6, 23);
          }
          block('earth', x - 60, 2.45, z, 1.3, 2.5, 6);
        } else block('earth', x + sign * 60, 1.9, z + offset, 1.3, 3.6, span);
      }
    }
    for (let row = -1; row <= 1; row++) for (let col = -1; col <= 1; col++) {
      const cx = x + col * 40, cz = z + row * 64.6;
      // 每个区块采用铺前、货院、后栈组合。东西市的院深与铺面尺度不同。
      const frontages = east ? [14, 12] : [10, 9, 9];
      const cloth = east ? '#a6afa1' : row % 2 ? '#a07c59' : '#c7ad83';
      const shop = functionalPrototype('shop').map((part) =>
        part.material === 'cloth' ? { ...part, tint: cloth } : part);
      let cursor = -14;
      for (const width of frontages) {
        for (const edge of [-1, 1]) {
          const hx = cx + cursor + width / 2;
          batches.hall(shop, hx, cz + edge * 21, width - 1, 7 + rng() * 3, 0.65 + rng() * 0.33,
            edge > 0 ? 0 : Math.PI, 0.3, east ? '#e4d6bf' : '#c8b79d');
        }
        cursor += width;
      }
      if (!east && row === 0 && col === -1) {
        createCaoStorage(kit);
      } else if (east && row === 0 && col === 0) {
        batches.hall(prototypes.tower, cx, cz, east ? 15 : 12, 10, 1.05, 0, 0.3);
      } else if (!east && row === 0) {
        // 中段铺面向外开，后方让出整块卸货坪；窄边置货架和堆箱。
        block('paving', cx, 0.34, cz, 27, 0.09, 23, 0, '#c4ad88');
        batches.hall(functionalPrototype('pavilion'), cx - 10, cz, 18, 5, 0.56,
          Math.PI / 2, 0.32);
        for (const [dx, dz, h] of [[7, -8, 1.4], [9, -4, 2], [8, 6, 1.25]]) {
          block('wood', cx + dx, 0.38 + h / 2, cz + dz, 3, h, 3, 0, '#a37f54');
        }
      } else if (east || row === -1) {
        batches.hall(prototypes.gable, cx - 11, cz, 22, 7, 0.74,
          Math.PI / 2, 0.3);
      } else {
        block('earth', cx, 0.8, cz + 1, 9, 1.3, 9, 0, '#b6a78b');
        for (let i = 0; i < 4; i++) {
          block('wood', cx - 10 + i * 6, 0.9, cz - 7, 3, 1.3, 3);
        }
      }
    }
    if (!east) {
      // 水面由永安连续干渠统一生成，卸货岸退到市墙旁，不再叠一条窄蓝槽。
      block('stone', x + 61.8, 0.6, z + 45, 1.8, 0.8, 35);
      for (const zz of [z + 30, z + 47, z + 63]) {
        block('wood', x + 64, 0.9, zz, 3.2, 0.25, 4);
      }
    }
  }
}

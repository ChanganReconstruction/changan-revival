import type { LandmarkKit } from './landmark-kit';

export function createImperialCity(kit: LandmarkKit): void {
  const { block, batches, prototypes, perimeter, tree } = kit;
  block('yard', 0, 0.07, -540, 495, 0.12, 510, 0, '#e0e0d5');
  // 西苑为林地，百司院内才铺石坪，不用整片土色或石色覆盖整个宫皇城。
  block('grass', -173, 0.145, -700, 100, 0.06, 170, 0, '#b5cba2');
  perimeter(0, -540, 500, 510, 7, 'vermilion', 0, 24);
  block('road', 0, 0.18, -549, 34, 0.1, 490, 0, '#f0e4c8');
  // 百司院外保留几块疏落草庭，打断一整片平铺地面并让主街继续醒目。
  for (const [x, z, w, d] of [[-80, -342, 42, 34], [80, -445, 46, 38],
    [-79, -510, 38, 30]]) {
    block('grass', x, 0.145, z, w, 0.06, d, 0, '#b5cba2');
  }

  // 皇城百司是朝廷办公组群：大前庭、横列署院、档库长屋分别组织，不复制住宅。
  for (const side of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      const x = side * 129, z = -366 - row * 96;
      perimeter(x, z, 184, 78, 3, 'wall', 0, 10);
      block('paving', x, 0.155, z + 4, 132, 0.05, 44, 0, '#d7dedc');
      batches.hall(prototypes.hipgable, x - side * 13, z - 20,
        row === 0 ? 59 : 83, 17, 1.15 + row * 0.2);
      for (const edge of [-1, 1]) {
        batches.hall(prototypes.gable, x + edge * 75, z, 49, 8, 0.7, Math.PI / 2);
      }
      if (row === 0 && side === 1) {
        for (const dx of [-30, 30]) batches.hall(prototypes.gable, x + dx, z + 24, 36, 9, 0.7);
      } else if (row === 1) {
        batches.hall(prototypes.gable, x + side * 51, z + 16, 34, 9, 0.65);
      }
      tree(x - 39, z + 13, 0.85);
      tree(x + 39, z + 12, 0.7);
    }
  }
  // 宫皇横街用完整留白截断纵轴，北侧是承天门与分离的太极宫前庭。
  block('road', 0, 0.19, -558, 480, 0.12, 34, 0, '#eadcc0');
  perimeter(0, -680, 494, 220, 6, 'vermilion', 0, 30);
  for (const x of [-21, 21]) block('vermilion', x, 4, -570, 12, 8, 13);
  batches.hall(prototypes.hip, 0, -570, 70, 23, 1.3, 0, 8.5);
  // 太极殿前两庑连续而后寝院密集；大殿、门观、庭院不等宽不等高。
  block('stone', 0, 1.5, -650, 100, 3, 52);
  // 太极大殿以显著高于署院的檐身比例立主次，不按普通屋高压缩宽殿。
  batches.hall(prototypes.hip, 0, -650, 86, 38, 3.25, 0, 3);
  for (const side of [-1, 1]) {
    batches.hall(prototypes.gable, side * 81, -639, 82, 11, 0.9, Math.PI / 2);
    batches.hall(prototypes.pavilion, side * 81, -597, 17, 15, 1.2);
  }
  batches.hall(prototypes.hipgable, 0, -727, 57, 24, 1.75);
  batches.hall(prototypes.gable, 0, -773, 44, 18, 1.05);
  // 东宫是横向串联小庭，西侧是疏林苑地，拒绝镜像平铺。
  for (const x of [133, 194]) {
    for (const z of [-618, -684, -749]) {
      perimeter(x, z, 51, 54, 2.3, 'wall', 0, 5);
      batches.hall(prototypes.gable, x, z - 16, x > 150 ? 35 : 28, 11, 0.85);
      batches.hall(prototypes.gable, x + 18, z + 6, 28, 7, 0.6, Math.PI / 2);
    }
  }
  for (const [x, z, size] of [[-183, -733, 1.8], [-147, -761, 1.3], [-208, -683, 1.4],
    [-172, -657, 1.1], [-126, -714, 1.35], [-199, -774, 1.6], [-153, -612, 1.1]]) {
    tree(x, z, size);
  }
  batches.hall(prototypes.pavilion, -174, -712, 20, 17, 1.2);
  // 皇城南门保留门墩空隙，门楼不落成阻塞御道的实心住宅。
  batches.hall(prototypes.hip, 0, -285, 52, 20, 1.7, 0, 7);
  for (const x of [-20, 20]) block('vermilion', x, 4, -285, 12, 8, 10);
}

export function createNorthernQuarters(kit: LandmarkKit): void {
  const { block, batches, prototypes, perimeter, tree } = kit;
  // 对照原版北部布局：保留禁苑及外朝服务区，不把108坊之外再铺40块复制坊。
  // 宫城西侧疏林与不等院落，东侧为仓场、厩院、宫门前仪仗空地。
  for (const [x, z, w, d] of [[-382, -410, 190, 100], [-629, -422, 230, 124],
    [-416, -615, 210, 180], [-684, -684, 190, 200]]) {
    perimeter(x, z, w, d, 3.1, 'earth', 0, 8);
    batches.hall(prototypes.gable, x, z - d * 0.34, w * 0.5, 13, 0.8);
    batches.hall(prototypes.gable, x - w * 0.34, z, d * 0.6, 10, 0.7, Math.PI / 2);
    if (d < 130) {
      for (let i = 0; i < 4; i++) {
        batches.hall(prototypes.gable, x - w * 0.24 + i * w * 0.16, z + 22,
          21 + i * 3, 10, 0.7 + i * 0.08);
      }
    } else {
      block('grass', x + w * 0.1, 0.12, z, w * 0.52, 0.1, d * 0.6, 0, '#c6bd94');
      // 禁苑用疏密不同的树团而非几株树摆在矩形色块中，仍共用四个植被实例网格。
      for (let i = 0; i < 48; i++) {
        tree(x + Math.sin(i * 2.399) * (18 + (i % 8) * 6),
          z + Math.cos(i * 2.399) * (20 + (i % 11) * 5),
          1.05 + (i % 5) * 0.14);
      }
    }
  }
  for (const [x, z, w, d] of [[430, -421, 260, 140], [716, -464, 154, 212]]) {
    perimeter(x, z, w, d, 3, 'earth');
    for (const sign of [-1, 1]) {
      // 仓场拆成有进深的长屋组，不把近两百米宽度压在普通小屋高度上。
      const count = w > 200 ? 3 : 2;
      const spacing = w * 0.75 / count;
      for (let i = 0; i < count; i++) {
        batches.hall(prototypes.gable, x + (i - (count - 1) / 2) * spacing,
          z + sign * d * 0.35, spacing - 6, 17, 1.15);
      }
      for (const dz of [-d * 0.16, d * 0.16]) {
        batches.hall(prototypes.gable, x + sign * w * 0.4, z + dz,
          d * 0.27, 12, 1.0, Math.PI / 2);
      }
    }
    if (w > 200) {
      for (const dx of [-70, 0, 70]) {
        block('earth', x + dx, 0.7, z, 32, 1.2, 38, 0, '#c6b68f');
      }
    }
  }
  // 宫门外的两翼服务院是艺术化空间组织；中央仪仗道保持完整净空。
  for (const [x, z, length] of [[395, -653, 86], [641, -655, 70]]) {
    batches.hall(prototypes.hipgable, x, z, length, 19, 1.65, Math.PI / 2);
    batches.hall(prototypes.gable, x, z + length / 2 + 14, 42, 14, 1.05);
  }
  block('road', 520, 0.12, -646, 170, 0.12, 160, 0, '#ddd0b1');
}

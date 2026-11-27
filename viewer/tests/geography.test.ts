import test from 'node:test';
import assert from 'node:assert/strict';
import { BASIN_WATERS, CHANNEL_PHASES, activeChannels, WEI_DISPLAY_PATH }
  from '../src/world/geography.ts';
import { mountainGeometry, weiRiverGeometry } from '../src/world/regional-landscape.ts';

test('八水保留流域方位，不以现代汇流关系冒充唐代河道', () => {
  assert.equal(BASIN_WATERS.length, 8);
  assert.equal(new Set(BASIN_WATERS.map((water) => water.id)).size, 8);
  for (const sector of ['东', '西', '南', '北']) {
    assert.equal(BASIN_WATERS.filter((water) => water.sector === sector).length, 2);
  }
  const displayed = BASIN_WATERS.filter((water) => water.displayed).map((water) => water.id);
  assert.deepEqual(displayed, ['wei']);
});

test('漕渠西市段与永泰扩建分期，不能把766年支线放到盛唐', () => {
  assert.equal(activeChannels(740).length, 4);
  assert.ok(activeChannels(750).some((channel) => channel.id === 'cao-wood'));
  assert.ok(!activeChannels(750).some((channel) => channel.id === 'cao-extension'));
  assert.ok(activeChannels(766).some((channel) => channel.id === 'cao-extension'));
  assert.equal(CHANNEL_PHASES.find((channel) => channel.id === 'huang')!.from, '义谷水');
});

test('南侧连续高山、北侧低塬，不再以等高山圈围城', () => {
  const south = mountainGeometry('south'), north = mountainGeometry('north');
  south.computeBoundingBox(); north.computeBoundingBox();
  assert.ok(south.boundingBox!.min.z >= 3000);
  assert.ok(south.boundingBox!.max.y > 500);
  assert.ok(north.boundingBox!.max.z <= -6800);
  assert.ok(north.boundingBox!.max.y < 100);
  for (const geometry of [south, north]) {
    const normal = geometry.getAttribute('normal');
    for (let i = 0; i < normal.count; i++) assert.ok(normal.getY(i) > 0);
    geometry.dispose();
  }
});

test('渭水西来东去且始终在城北，岸坡不铺成遮水的实心大坪', () => {
  assert.ok(WEI_DISPLAY_PATH.every((point, i) => i === 0
    || point[0] > WEI_DISPLAY_PATH[i - 1][0]));
  for (const bank of [false, true]) {
    const geometry = weiRiverGeometry(bank);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    assert.equal(position.count, geometry.getAttribute('uv').count);
    for (let i = 0; i < position.count; i++) {
      assert.ok(position.getZ(i) < -1500);
      assert.ok(Number.isFinite(position.getX(i)));
      assert.ok(normal.getY(i) > 0.99);
    }
    if (bank) {
      const index = geometry.index!;
      for (let i = 0; i < index.count; i += 3) {
        const sides = [0, 1, 2].map((j) => index.getX(i + j) % 4 < 2);
        assert.ok(sides.every((side) => side === sides[0]));
      }
    }
    geometry.dispose();
  }
});

test('山水骨架几何预算不超过5000三角面，不逐段创建网格', () => {
  const geometries = [mountainGeometry('south'), mountainGeometry('north'),
    weiRiverGeometry(), weiRiverGeometry(true)];
  const triangles = geometries.reduce((total, geometry) => total + geometry.index!.count / 3, 0);
  assert.ok(triangles < 5000);
  for (const geometry of geometries) geometry.dispose();
});

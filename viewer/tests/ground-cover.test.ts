import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWards } from '../src/world/layout.ts';
import { planWard } from '../src/world/ward-composition.ts';
import { planWardGround } from '../src/world/ground-cover.ts';
import { groundColorAt } from '../src/world/land-colors.ts';

// 地表应服从同一份空间规划，不能用大片草矩形盖掉巷道和水院。
test('坊内补充绿地不压建筑、道路、院坪及公共净空', () => {
  let total = 0;
  for (const ward of makeWards()) {
    const plan = planWard(ward);
    const patches = planWardGround(ward);
    total += patches.length;
    const occupied = [...plan.houses, ...plan.roads, ...plan.courtyards,
      ...plan.publicSquares, ...plan.keepouts, ...plan.greenplots];
    for (const patch of patches) {
      assert.ok(Math.abs(patch.x - ward.x) + patch.width / 2 <= ward.width / 2 - 5.9);
      assert.ok(Math.abs(patch.z - ward.z) + patch.depth / 2 <= ward.depth / 2 - 5.9);
      for (const area of occupied) {
        const overlaps = Math.abs(patch.x - area.x) < (patch.width + area.width) / 2
          && Math.abs(patch.z - area.z) < (patch.depth + area.depth) / 2;
        assert.ok(!overlaps, `${ward.id} 绿地侵入道路或建筑`);
      }
    }
    if (['market', 'garden'].includes(plan.family) || ['E4-9', 'E1-3'].includes(ward.id)) {
      assert.equal(patches.length, 0, '特殊水院与寺塔区不套普通坊区绿地');
    }
  }
  assert.ok(total > 10 && total < 2000, `补充绿地数量异常：${total}`);
});

test('城外地表保持自然绿调与连续的低饱和色差', () => {
  const colors = [];
  for (let x = -2200; x <= 2200; x += 110) {
    for (let z = -1700; z <= 1700; z += 130) {
      if (Math.abs(x) < 850 && z > -830 && z < 720) continue;
      colors.push(groundColorAt(x, z));
    }
  }
  assert.ok(new Set(colors).size >= 6);
  const green = colors.filter((color) => parseInt(color.slice(3, 5), 16)
    > parseInt(color.slice(1, 3), 16));
  assert.ok(green.length / colors.length > 0.7);
  assert.equal(groundColorAt(-1234, 1287), groundColorAt(-1234, 1287));
  const colorAtEdge = groundColorAt(840, 240);
  const nearbyColor = groundColorAt(841, 240);
  const channelDelta = [1, 3, 5].map((index) => Math.abs(
    parseInt(colorAtEdge.slice(index, index + 2), 16)
      - parseInt(nearbyColor.slice(index, index + 2), 16),
  ));
  assert.ok(Math.max(...channelDelta) <= 1, '城内外连接处不得出现颜色断层');
});

test('地表样板不会改变原坊区建筑规划', () => {
  const ward = makeWards().find((item) => item.id === 'E1-5')!;
  const original = planWard(ward);
  assert.deepEqual(planWardGround(ward), planWardGround(ward));
  assert.deepEqual(planWard(ward), original);
});

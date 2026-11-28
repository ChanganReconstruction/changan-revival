import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRenderScale, renderDimensions } from '../src/render/resolution.ts';

test('渲染比例只接受明确列出的 URL 值', () => {
  assert.equal(parseRenderScale('1'), 1);
  assert.equal(parseRenderScale('.85'), 0.85);
  assert.equal(parseRenderScale('.7'), 0.7);
  assert.equal(parseRenderScale('0.85'), 0.85);
  assert.equal(parseRenderScale('0.7'), 0.7);
  for (const value of [null, '', '0.8', '0.70', '1.0', '2']) {
    assert.equal(parseRenderScale(value), 1, `应回退默认比例：${value}`);
  }
});

test('像素缓冲尺寸结合 DPR 上限与渲染比例计算', () => {
  assert.deepEqual(renderDimensions(1000, 600, 2, 1.35, 1), {
    width: 1350, height: 810, pixelRatio: 1.35,
  });
  assert.deepEqual(renderDimensions(1000, 600, 2, 1.35, 0.85), {
    width: 1147, height: 688, pixelRatio: 1.1475,
  });
  assert.deepEqual(renderDimensions(1000, 600, 0.8, 1, 0.7), {
    width: 559, height: 335, pixelRatio: 0.5599999999999999,
  });
});

test('无效尺寸或设备像素比不参与渲染', () => {
  for (const args of [
    [0, 600, 1, 1, 1],
    [1000, -1, 1, 1, 1],
    [1000, 600, Number.NaN, 1, 1],
    [1000, 600, 1, Number.POSITIVE_INFINITY, 1],
  ] as const) {
    assert.throws(() => renderDimensions(args[0], args[1], args[2], args[3], args[4]), RangeError);
  }
});

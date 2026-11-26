import assert from "node:assert/strict";
import { test } from "node:test";
import { solvePngSize } from "./size.ts";

test("close labels and narrow details can grow the canvas", () => {
    const bounds: [number, number] = [100, 60];
    const sparse = solvePngSize(bounds, [], []);
    const label = { x: 0, y: 0, width: 76, height: 26 };
    const denseLabels = solvePngSize(bounds, [label, { ...label, x: 8 }], []);
    const narrowRoad = solvePngSize(bounds, [], [{ span: 0.8, minPixels: 8 }]);
    assert.ok(denseLabels.size[0] > sparse.size[0]);
    assert.ok(narrowRoad.size[0] > sparse.size[0]);
    assert.equal(denseLabels.limited, false);
    assert.equal(narrowRoad.limited, false);
});

test("automatic size depends on relative detail, not coordinate units", () => {
    assert.deepEqual(
        solvePngSize([100, 60], [], [{ span: 0.8, minPixels: 8 }]),
        solvePngSize([1000, 600], [], [{ span: 8, minPixels: 8 }]),
    );
});

test("caps excessive sizes and does not enlarge for coincident anchors", () => {
    const bounds: [number, number] = [100, 60];
    const label = { x: 0, y: 0, width: 76, height: 26 };
    const coincident = solvePngSize(bounds, [label, label], []);
    assert.equal(coincident.limited, true);
    assert.deepEqual(coincident.size, solvePngSize(bounds, [], []).size);

    const dense = solvePngSize(bounds, [], [{ span: 0.1, minPixels: 16 }]);
    assert.equal(dense.limited, true);
    assert.equal(Math.max(...dense.size), 2048);
});

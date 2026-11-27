import assert from "node:assert/strict";
import { test } from "node:test";
import { crc32, inflateSync } from "node:zlib";
import { encodeGrayscale, planGrayscale } from "./png.ts";

function rgba(tones: number[]): Buffer {
    return Buffer.from(tones.flatMap((tone) => [tone, tone, tone, 255]));
}

function readPng(png: Buffer) {
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    const chunks = new Map<string, Buffer>();
    for (let offset = 8; offset < png.length; ) {
        const size = png.readUInt32BE(offset);
        const bodyEnd = offset + 8 + size;
        const type = png.toString("ascii", offset + 4, offset + 8);
        const body = png.subarray(offset + 4, bodyEnd);
        assert.equal(png.readUInt32BE(bodyEnd), crc32(body));
        chunks.set(type, body.subarray(4));
        offset = bodyEnd + 4;
    }
    assert.deepEqual([...chunks.keys()], ["IHDR", "IDAT", "IEND"]);
    const header = chunks.get("IHDR");
    const compressed = chunks.get("IDAT");
    assert.ok(header && compressed);
    assert.equal(header[9], 0, "PNG uses grayscale, not RGB or a palette");
    return { header, scanlines: [...inflateSync(compressed)] };
}

test("2-bit grayscale packs odd widths and restarts on each row", () => {
    const plan = planGrayscale(new Set(["likely", "schematic"]));
    assert.deepEqual(plan.levels, [0, 85, 170, 255]);
    const { header, scanlines } = readPng(
        encodeGrayscale(rgba([0, 85, 170, 255, 87, 200]), 3, 2, plan),
    );
    assert.equal(header.readUInt32BE(0), 3);
    assert.equal(header.readUInt32BE(4), 2);
    assert.equal(header[8], 2);
    assert.deepEqual(scanlines, [0, 0b00011000, 0, 0b11011000]);
});

test("three fill states promote to 4-bit and preserve distinct grays", () => {
    const plan = planGrayscale(new Set(["schematic", "likely", "documented"]));
    assert.deepEqual(plan.levels, [0, 51, 85, 170, 255]);
    const { header, scanlines } = readPng(
        encodeGrayscale(rgba([0, 51, 85, 170, 255]), 5, 1, plan),
    );
    assert.equal(header[8], 4);
    assert.deepEqual(scanlines, [0, 0x03, 0x5a, 0xf0]);
});

test("edge pixels cannot introduce an unplanned gray", () => {
    const plan = planGrayscale(new Set(["schematic"]));
    assert.deepEqual(plan.levels, [0, 170, 255]);
    const { scanlines } = readPng(
        encodeGrayscale(rgba([80, 90, 220]), 3, 1, plan),
    );
    assert.deepEqual(scanlines, [0, 0b00101100]);
});

import { createRequire } from "node:module";
import { crc32, deflateSync } from "node:zlib";
import type { SKRSContext2D } from "@napi-rs/canvas";

export const INFERENCES = [
    "documented",
    "likely",
    "alternative",
    "schematic",
    "typological",
] as const;
export type Inference = (typeof INFERENCES)[number];

export function planGrayscale(usedFills: ReadonlySet<Inference>) {
    const used = INFERENCES.filter((inference) => usedFills.has(inference));
    const bitDepth = used.length <= 2 ? 2 : 4;
    const tones4 = [51, 85, 119, 170, 204];
    const fills = new Map<Inference, number>();
    for (const [index, inference] of used.entries()) {
        const tone =
            bitDepth === 4
                ? tones4[INFERENCES.indexOf(inference)]
                : used.length === 2
                  ? (index + 1) * 85
                  : INFERENCES.indexOf(inference) < 2
                    ? 85
                    : 170;
        fills.set(inference, tone);
    }
    return { bitDepth, fills, levels: [0, ...fills.values(), 255] } as const;
}

function chunk(type: string, data: Buffer): Buffer {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const header = Buffer.alloc(4);
    const checksum = Buffer.alloc(4);
    header.writeUInt32BE(data.length);
    checksum.writeUInt32BE(crc32(body));
    return Buffer.concat([header, body, checksum]);
}

export function encodeGrayscale(
    pixels: Buffer,
    width: number,
    height: number,
    { bitDepth, levels }: ReturnType<typeof planGrayscale>,
): Buffer {
    const maxSample = (1 << bitDepth) - 1;
    const nearest = Uint8Array.from({ length: 256 }, (_, value) => {
        const tone = levels.reduce((best, candidate) =>
            Math.abs(candidate - value) < Math.abs(best - value)
                ? candidate
                : best,
        );
        return Math.round((tone * maxSample) / 255);
    });
    const stride = 1 + Math.ceil((width * bitDepth) / 8);
    const scanlines = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            // The canvas has an opaque white background; all channels are equal.
            const sample = nearest[pixels[4 * (y * width + x)]];
            const bit = x * bitDepth;
            // Each row starts with filter byte 0. Pack samples high bits first.
            scanlines[y * stride + 1 + (bit >> 3)] |=
                sample << (8 - bitDepth - (bit & 7));
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = bitDepth;
    // Color type 0 = grayscale, no alpha. Other IHDR fields stay zero.
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(scanlines)),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

const FONT = "Ward Render CJK";
let registeredFont: string | undefined;

function loadCanvas(): typeof import("@napi-rs/canvas") {
    const previous = process.env.DISABLE_SYSTEM_FONTS_LOAD;
    process.env.DISABLE_SYSTEM_FONTS_LOAD = "1";
    try {
        return createRequire(import.meta.url)("@napi-rs/canvas");
    } finally {
        if (previous === undefined) {
            delete process.env.DISABLE_SYSTEM_FONTS_LOAD;
        } else {
            process.env.DISABLE_SYSTEM_FONTS_LOAD = previous;
        }
    }
}

export function renderPng(
    [width, height]: [number, number],
    plan: ReturnType<typeof planGrayscale>,
    fontFile: string,
    draw: (ctx: SKRSContext2D) => void,
): Buffer {
    const { createCanvas, GlobalFonts } = loadCanvas();
    if (registeredFont !== fontFile) {
        if (!GlobalFonts.registerFromPath(fontFile, FONT)) {
            throw new Error(`无法载入 PNG 字体：${fontFile}`);
        }
        registeredFont = fontFile;
    }
    const ctx = createCanvas(width, height).getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    draw(ctx);
    const rgba = ctx.getImageData(0, 0, width, height).data;
    return encodeGrayscale(
        Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength),
        width,
        height,
        plan,
    );
}

export function drawPngText(
    ctx: SKRSContext2D,
    text: string,
    x: number,
    y: number,
    size: number,
    align: "left" | "center" = "left",
    stroke = 0.6,
): void {
    ctx.font = `${size}px "${FONT}"`;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#000000";
    if (stroke > 0) {
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = stroke;
        ctx.lineJoin = "round";
        ctx.setLineDash([]);
        ctx.strokeText(text, x, y);
    }
    ctx.fillText(text, x, y);
}

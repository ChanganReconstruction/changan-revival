type Label = { x: number; y: number; width: number; height: number };
type Detail = { span: number; minPixels: number };

export const MAP_MARGIN = 36;
export const PNG_TITLE_HEIGHT = 102;
export const PNG_FOOTER_HEIGHT = 72;
export const PNG_LEGEND_WIDTH = 260;
export const PNG_MAP_GUTTER_X = 44;
export const PNG_MAP_GUTTER_Y = 20;
const LIMIT = 2048;
const STEP = 64;
const LABEL_GAP = 4;

export function solvePngSize(
    [spanX, spanY]: [number, number],
    labels: Label[],
    details: Detail[],
): { size: [number, number]; limited: boolean } {
    const extraX = 2 * (MAP_MARGIN + PNG_MAP_GUTTER_X) + PNG_LEGEND_WIDTH;
    const extraY =
        PNG_TITLE_HEIGHT +
        PNG_FOOTER_HEIGHT +
        MAP_MARGIN +
        2 * PNG_MAP_GUTTER_Y;
    const minWidth = 720;
    const minHeight = 560;
    let scale = Math.min(minWidth / spanX, minHeight / spanY);
    let coincident = false;
    for (const detail of details) {
        if (detail.span > 0) {
            scale = Math.max(scale, detail.minPixels / detail.span);
        }
    }
    for (const [i, a] of labels.entries()) {
        for (let j = i + 1; j < labels.length; j += 1) {
            const b = labels[j];
            if (a.x === b.x && a.y === b.y) {
                coincident = true;
                continue;
            }
            const separationX =
                ((a.width + b.width) / 2 + LABEL_GAP) / Math.abs(a.x - b.x);
            const separationY =
                (Math.max(a.height, b.height) + LABEL_GAP) /
                Math.abs(a.y - b.y);
            // Separation along either axis is enough. Coincident anchors
            // cannot be fixed by increasing the canvas.
            scale = Math.max(scale, Math.min(separationX, separationY));
        }
    }
    const maxScale = Math.min(
        (LIMIT - extraX) / spanX,
        (LIMIT - extraY) / spanY,
    );
    const limited = coincident || scale > maxScale;
    const target = Math.min(scale, maxScale);
    const round = (pixels: number) =>
        Math.min(LIMIT, Math.ceil(pixels / STEP) * STEP);
    return {
        size: [
            round(Math.max(minWidth, spanX * target) + extraX),
            round(Math.max(minHeight, spanY * target) + extraY),
        ],
        limited,
    };
}

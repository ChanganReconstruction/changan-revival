export const RENDER_SCALES = [1, 0.85, 0.7] as const;

export type RenderScale = (typeof RENDER_SCALES)[number];

export interface RenderDimensions {
  width: number;
  height: number;
  pixelRatio: number;
}

export function parseRenderScale(value: string | null): RenderScale {
  if (value === '.85' || value === '0.85') return 0.85;
  if (value === '.7' || value === '0.7') return 0.7;
  return 1;
}

export function renderDimensions(
  width: number,
  height: number,
  dpr: number,
  dprCap: number,
  scale: RenderScale,
): RenderDimensions {
  if (![width, height, dpr, dprCap].every(Number.isFinite)
    || width <= 0 || height <= 0 || dpr <= 0 || dprCap <= 0) {
    throw new RangeError('渲染尺寸与设备像素比必须为有限正数');
  }
  const pixelRatio = Math.min(dpr, dprCap) * scale;
  return {
    width: Math.floor(width * pixelRatio),
    height: Math.floor(height * pixelRatio),
    pixelRatio,
  };
}

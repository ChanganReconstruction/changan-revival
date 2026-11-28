import { CITY } from './layout.ts';

export const CITY_SURFACES = {
  wardYard: '#e4e3d9',
  wardRoad: '#bdc3ba',
  crossStreet: '#d4d6ca',
  avenue: '#e2ded1',
  planting: '#b7cba7',
} as const;

// 以统一的缓变底色服务城内地形与城外远景，避免色块边界和接缝。
export function groundColorAt(x: number, z: number): string {
  const broad = Math.sin(x / 1280 + Math.sin(z / 2100) * 0.55) * 0.52
    + Math.sin(z / 920 + Math.sin(x / 2500) * 0.4) * 0.32
    + Math.sin((x - z) / 3900) * 0.16;
  const fine = Math.sin((x + z) / 4700 + Math.sin(x / 1800)) * 0.5 + 0.5;
  // 低频场只轻微偏色，稀疏边界也柔和过渡，不制造棋盘田块。
  const edge = smoothstep(0.78, 0.98, fine) * 2.5;
  const variation = broad * 6;
  const red = Math.round(145 + variation * 0.65 - edge * 0.45);
  const green = Math.round(158 + variation + edge);
  const blue = Math.round(144 + variation * 0.72 + edge * 0.35);
  return `#${hex(red)}${hex(green)}${hex(blue)}`;
}

// 城内露出的路肩用偏灰的夯土地色；城外地表和现有绿地材质不随之变色。
export function cityGroundColorAt(x: number, z: number): string {
  const natural = groundColorAt(x, z);
  const inset = Math.min(x - CITY.west, CITY.east - x, z - CITY.north, CITY.south - z);
  const urban = smoothstep(0, 28, inset) * 0.85;
  return `#${[172, 169, 154].map((target, i) => {
    const base = parseInt(natural.slice(1 + i * 2, 3 + i * 2), 16);
    return hex(Math.round(base + (target - base) * urban));
  }).join('')}`;
}

function smoothstep(low: number, high: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

function hex(value: number): string {
  return value.toString(16).padStart(2, '0');
}

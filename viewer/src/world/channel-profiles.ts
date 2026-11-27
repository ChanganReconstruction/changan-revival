import type { ChannelProfile } from './channel-geometry.ts';

export type ChannelTier = 'main' | 'branch' | 'drain';

// 宽深是低多边形浏览用的层级，不是古渠实测；同级仍可保留不同的地方断面。
export const CHANNEL_PROFILES = {
  main: { width: 6, depth: 0.85, bank: 'earth',
    section: { halfWidth: 3, crestOffset: 3.35, outerOffset: 4.3, rise: 0.55, depth: 0.85 } },
  branch: { width: 3, depth: 0.55, bank: 'earth',
    section: { halfWidth: 1.5, crestOffset: 1.8, outerOffset: 2.3, rise: 0.4, depth: 0.55 } },
  drain: { width: 0.9, depth: 0.25, bank: 'stone',
    section: { halfWidth: 0.45, crestOffset: 0.6, outerOffset: 0.8, rise: 0.16, depth: 0.25 } },
} as const satisfies Record<ChannelTier, {
  width: number; depth: number; bank: string; section: ChannelProfile;
}>;

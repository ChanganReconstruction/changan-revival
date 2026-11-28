import type { LandmarkKit } from './landmark-kit';
import { CHANNEL_PROFILES } from './channel-profiles.ts';
import { channelGeometries } from './channel-geometry.ts';

export const AVENUE_DRAINS = { centers: [-17.5, 17.5], north: -280, south: 705 } as const;

// 细沟随道路原坡分区排水，不当作一条逆坡攀升的连续引水干渠。
export function avenueDrainSamples(x: number, groundAt: (x: number, z: number) => number) {
  return Array.from({ length: 81 }, (_, i) => {
    const z = AVENUE_DRAINS.north + (AVENUE_DRAINS.south - AVENUE_DRAINS.north) * i / 80;
    return { x, z, level: groundAt(x, z) + 0.02 };
  });
}

export function createAvenueDrains(
  kit: LandmarkKit, groundAt: (x: number, z: number) => number,
): void {
  for (const x of AVENUE_DRAINS.centers) {
    const geometry = channelGeometries(avenueDrainSamples(x, groundAt),
      CHANNEL_PROFILES.drain.section);
    geometry.water.name = '朱雀街侧细沟水面（艺术示意）';
    geometry.water.userData = { channel: 'avenue-drain', tier: 'drain', width: 0.9,
      depth: 0.25, complete: false, accuracy: '街侧排水有依据，断面与出水支路为艺术示意',
      flow: '随原坡分区汇流；横街下为覆涵，不代表整条沟向北供水' };
    kit.batches.add(geometry.water, 'water', 0, 0, 0);
    kit.batches.add(geometry.banks, 'stone', 0, 0, 0, 1, 1, 1, 0, '#b7beb9');
    kit.batches.add(geometry.skirts, 'yard', 0, 0, 0);
  }
}

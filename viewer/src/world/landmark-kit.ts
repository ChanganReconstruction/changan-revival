import type { Batches } from '../render/batches';
import type { MaterialKey } from '../render/materials';
import type { PrototypePart } from './architecture';

// 地标使用同一套批次工具，不允许为了景点逐件建立独立 Mesh 或材质。
export interface LandmarkKit {
  batches: Pick<Batches, 'add' | 'hall'>;
  prototypes: {
    gable: PrototypePart[];
    hip: PrototypePart[];
    hipgable: PrototypePart[];
    pavilion: PrototypePart[];
    tower: PrototypePart[];
  };
  block: (
    material: MaterialKey, x: number, y: number, z: number,
    w: number, h: number, d: number, rotation?: number, tint?: string,
  ) => void;
  tree: (x: number, z: number, size?: number, y?: number) => void;
  perimeter: (
    x: number, z: number, w: number, d: number, h?: number,
    material?: MaterialKey, y?: number, gate?: number,
  ) => void;
  pond: (x: number, z: number, rx: number, rz: number, y?: number) => void;
}

import * as THREE from 'three';

export interface ChannelSample { x: number; z: number; level: number; }
export interface ChannelProfile {
  halfWidth: number; crestOffset: number; outerOffset: number; rise: number; depth?: number;
}

// 共用断面与标高算法，不意味着不同渠系共享历史路线或实测尺寸。
export function sampleChannel(
  path: readonly (readonly [number, number])[], source: number, destination: number, steps = 120,
): ChannelSample[] {
  const curve = new THREE.CatmullRomCurve3(
    path.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal',
  );
  const points = curve.getPoints(steps);
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  }
  return points.map((point, i) => ({ x: point.x, z: point.z,
    level: destination + (source - destination) * (1 - lengths[i] / lengths.at(-1)!),
  }));
}

export function channelGeometries(samples: readonly ChannelSample[], profile: ChannelProfile) {
  const water: number[] = [], banks: number[] = [], skirts: number[] = [];
  const emit = (out: number[], a: number[], b: number[], c: number[], d: number[]) => {
    out.push(...a, ...b, ...d, ...b, ...c, ...d);
  };
  const { halfWidth: half, crestOffset: crest, outerOffset: outer, rise } = profile;
  const sections = samples.map((point, i) => {
    const before = samples[Math.max(0, i - 1)];
    const after = samples[Math.min(samples.length - 1, i + 1)];
    const dx = after.x - before.x, dz = after.z - before.z;
    const length = Math.hypot(dx, dz), nx = -dz / length, nz = dx / length;
    const offsets = [-outer, -crest, -half, half, crest, outer];
    const bed = point.level - (profile.depth ?? 0.05);
    const heights = [-0.3, point.level + rise, bed, bed, point.level + rise, -0.3];
    return offsets.map((offset, j) => [point.x + nx * offset, heights[j], point.z + nz * offset]);
  });
  for (let i = 1; i < samples.length; i++) {
    const leftA = [...sections[i - 1][2]], rightA = [...sections[i - 1][3]];
    const leftB = [...sections[i][2]], rightB = [...sections[i][3]];
    leftA[1] = rightA[1] = samples[i - 1].level;
    leftB[1] = rightB[1] = samples[i].level;
    emit(water, leftA, rightA, rightB, leftB);
    for (const j of [0, 1, 3, 4]) {
      emit(banks, sections[i - 1][j], sections[i - 1][j + 1],
        sections[i][j + 1], sections[i][j]);
    }
    for (const j of [0, 5]) {
      const p = sections[i - 1][j], q = sections[i][j];
      if (j === 0) emit(skirts, q, [q[0], -0.8, q[2]], [p[0], -0.8, p[2]], p);
      else emit(skirts, p, [p[0], -0.8, p[2]], [q[0], -0.8, q[2]], q);
    }
  }
  const make = (positions: number[]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const uv: number[] = [];
    for (let i = 0; i < positions.length; i += 3) uv.push(positions[i] / 16, positions[i + 2] / 16);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    return geometry;
  };
  return { water: make(water), banks: make(banks), skirts: make(skirts) };
}

// 局部轴坐标下拆分墙身，留低位涵口，不删除整段城墙或新增城门。
export function channelWallSegments(
  start: number, end: number, center: number, width: number, height: number,
) {
  const left = center - width / 2, right = center + width / 2;
  if (end <= left || start >= right) {
    return [{ x: (start + end) / 2, y: 5.5, width: end - start, height: 11 }];
  }
  const lo = Math.max(start, left), hi = Math.min(end, right);
  return [
    { x: (start + lo) / 2, y: 5.5, width: lo - start, height: 11 },
    { x: (hi + end) / 2, y: 5.5, width: end - hi, height: 11 },
    { x: (lo + hi) / 2, y: (11 + height) / 2, width: hi - lo, height: 11 - height },
  ].filter((part) => part.width > 0);
}

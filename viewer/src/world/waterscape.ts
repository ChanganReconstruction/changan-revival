import * as THREE from 'three';

// 非对称手绘岸线以局部坐标表达，避免椭圆拉伸或随机扰动冒充湖形。
export function sampleOutline(
  outline: readonly [number, number][], steps = 5,
): [number, number][] {
  const points = outline.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  return curve.getPoints(outline.length * steps).slice(0, -1)
    .map((point) => [point.x, point.z]);
}

export const TAIYE_OUTLINE: readonly [number, number][] = [
  [-68, -7], [-62, -28], [-48, -43], [-35, -40], [-27, -52], [-8, -47],
  [4, -37], [18, -42], [32, -34], [43, -36], [58, -22], [54, -9],
  [66, 1], [54, 12], [52, 29], [37, 36], [24, 30], [13, 40], [-2, 35],
  [-14, 47], [-31, 39], [-35, 26], [-52, 22], [-58, 8], [-70, 4],
];

export const LONGCHI_OUTLINE: readonly [number, number][] = [
  [-43, -9], [-38, -20], [-24, -23], [-13, -18], [-5, -22], [8, -18],
  [17, -23], [30, -18], [38, -8], [34, 2], [42, 11], [31, 20],
  [18, 18], [8, 25], [-4, 19], [-14, 24], [-25, 17], [-39, 16],
  [-45, 6], [-34, 0],
];

/** 将手工曲岸轮廓三角化为水平水面，适用于共享实例批次。 */
export function createLakeGeometry(
  outline: readonly [number, number][],
): THREE.BufferGeometry {
  const sampled = sampleOutline(outline);
  const shape = new THREE.Shape();
  sampled.forEach(([x, z], index) => {
    // 旋转到XZ平面时反转局部纵轴，使水面与正向z岸坡重合。
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** 形成有厚度的岸坡：内缘近水面，外缘落至地基，不是薄线装饰。 */
export function createShoreGeometry(
  inner: readonly [number, number][],
  outer: readonly [number, number][],
  drop = 1.8,
  opening?: (x: number, z: number) => boolean,
): THREE.BufferGeometry {
  const sampledInner = sampleOutline(inner);
  const sampledOuter = sampleOutline(outer);
  if (sampledInner.length !== sampledOuter.length) {
    throw new Error('岸坡内外轮廓采样数必须一致');
  }
  const vertices: number[] = [];
  const push = (p: readonly number[], y: number) => vertices.push(p[0], y, p[1]);
  for (let i = 0; i < sampledInner.length; i++) {
    const j = (i + 1) % sampledInner.length;
    // 有实际入水口时连土坡和外裙一起让开，不能只把蓝色水条画在封闭岸上。
    const corners = [sampledInner[i], sampledInner[j], sampledOuter[i], sampledOuter[j]];
    if (opening && (corners.some(([x, z]) => opening(x, z))
      || opening((sampledInner[i][0] + sampledOuter[j][0]) / 2,
        (sampledInner[i][1] + sampledOuter[j][1]) / 2))) continue;
    // 内岸坡朝上，外缘封底；同一组采样点保证坡面紧贴湖岸。
    push(sampledInner[i], 0); push(sampledOuter[j], -drop);
    push(sampledOuter[i], -drop);
    push(sampledInner[i], 0); push(sampledInner[j], 0);
    push(sampledOuter[j], -drop);
    push(sampledOuter[i], -drop); push(sampledOuter[i], -Math.max(drop, 0) - 0.8);
    push(sampledOuter[j], -Math.max(drop, 0) - 0.8); push(sampledOuter[i], -drop);
    push(sampledOuter[j], -Math.max(drop, 0) - 0.8); push(sampledOuter[j], -drop);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const uvs: number[] = [];
  for (let i = 0; i < vertices.length; i += 3) {
    uvs.push(vertices[i] / 64 + 0.5, vertices[i + 2] / 64 + 0.5);
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** 蓬莱山多圈异形等高面，外坡折面与偏心台地合并为单个几何体。 */
export function createIslandGeometry(): THREE.BufferGeometry {
  const base: readonly [number, number][] = [
    [-17, -5], [-14, -12], [-8, -14], [-2, -12], [5, -15], [12, -11],
    [17, -5], [14, 2], [17, 8], [10, 14], [3, 12], [-4, 16],
    [-12, 11], [-16, 4],
  ];
  const levels = [
    { y: 0, sx: 1, sz: 1, dx: 0, dz: 0 },
    { y: 1.6, sx: 0.82, sz: 0.76, dx: -1, dz: 0.8 },
    { y: 3.5, sx: 0.59, sz: 0.54, dx: 1.2, dz: 0.2 },
    { y: 5.4, sx: 0.36, sz: 0.33, dx: 2.4, dz: -0.8 },
  ];
  const points = levels.map((level) => base.map(([x, z]) => [
    x * level.sx + level.dx, z * level.sz + level.dz,
  ] as [number, number]));
  const positions: number[] = [];
  const emit = (a: [number, number, number], b: [number, number, number],
    c: [number, number, number]) => positions.push(...a, ...b, ...c);
  for (let layer = 0; layer < levels.length - 1; layer++) {
    for (let i = 0; i < base.length; i++) {
      const j = (i + 1) % base.length;
      const lowA: [number, number, number] = [
        points[layer][i][0], levels[layer].y, points[layer][i][1],
      ];
      const lowB: [number, number, number] = [
        points[layer][j][0], levels[layer].y, points[layer][j][1],
      ];
      const highA: [number, number, number] = [
        points[layer + 1][i][0], levels[layer + 1].y, points[layer + 1][i][1],
      ];
      const highB: [number, number, number] = [
        points[layer + 1][j][0], levels[layer + 1].y, points[layer + 1][j][1],
      ];
      emit(lowA, highB, lowB);
      emit(lowA, highA, highB);
    }
  }
  const top = points.at(-1)!;
  const topY = levels.at(-1)!.y;
  const center: [number, number, number] = [0, topY, 0];
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length;
    emit(center, [top[j][0], topY, top[j][1]], [top[i][0], topY, top[i][1]]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const uvs: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    uvs.push(positions[i] / 40 + 0.5, positions[i + 2] / 40 + 0.5);
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

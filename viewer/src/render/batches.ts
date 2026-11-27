import * as THREE from 'three';
import type { MaterialKey, Materials } from './materials';
import type { PrototypePart } from '../world/architecture';

interface Batch {
  geometry: THREE.BufferGeometry;
  material: MaterialKey;
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
  detail: boolean;
}

export class Batches {
  private batches = new Map<string, Batch>();
  private transform = new THREE.Object3D();
  readonly meshes: THREE.InstancedMesh[] = [];
  readonly details: THREE.InstancedMesh[] = [];
  instances = 0;
  buildings = 0;

  constructor(private scene: THREE.Scene, private materials: Materials) {}

  add(
    geometry: THREE.BufferGeometry, material: MaterialKey,
    x: number, y: number, z: number, sx = 1, sy = 1, sz = 1,
    rotation = 0, tint = '#ffffff', detail = false,
  ) {
    // 空间分块兼顾批次与剔除，禁止为每栋建筑创建 Mesh 或独立材质。
    const cell = detail ? 128 : 800;
    const chunk = `${Math.floor((x + 900) / cell)}:${Math.floor((z + 1100) / cell)}`;
    const key = `${chunk}:${geometry.id}:${material}:${detail}`;
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { geometry, material, matrices: [], colors: [], detail };
      this.batches.set(key, batch);
    }
    this.transform.position.set(x, y, z);
    this.transform.scale.set(sx, sy, sz);
    this.transform.rotation.set(0, rotation, 0);
    this.transform.updateMatrix();
    batch.matrices.push(this.transform.matrix.clone());
    batch.colors.push(new THREE.Color(tint));
    this.instances++;
  }

  hall(
    parts: PrototypePart[], x: number, z: number, width = 18, depth = 11,
    height = 1, rotation = 0, y = 0, tint = '#ffffff',
  ) {
    this.buildings++;
    for (const part of parts) {
      this.add(
        part.geometry, part.material, x, y, z, width / 18, height, depth / 11,
        rotation, part.tint
          ?? (part.material === 'roof' || part.material === 'wall' ? tint : '#ffffff'),
        part.detail,
      );
    }
  }

  finish() {
    for (const [key, batch] of this.batches) {
      const mesh = new THREE.InstancedMesh(
        batch.geometry, this.materials[batch.material], batch.matrices.length,
      );
      mesh.name = key;
      batch.matrices.forEach((matrix, i) => {
        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, batch.colors[i]);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // 窗面与树冠不另投一遍影；静态主要轮廓由屋顶、墙体与城台承担。
      mesh.castShadow = !batch.detail
        && ['roof', 'wall', 'earth', 'vermilion'].includes(batch.material);
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.computeBoundingBox();
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      if (batch.detail) this.details.push(mesh);
    }
    // 上传后释放临时矩阵，实例矩阵仍由 InstancedMesh 统一持有。
    this.batches.clear();
  }

  updateDetails(camera: THREE.Camera, quality: string) {
    // 图集门窗始终在主体中；只有少量近景柱梁采用小分块距离剔除。
    const range = quality === 'low' ? 60 : quality === 'high' ? 160 : 95;
    for (const mesh of this.details) {
      const sphere = mesh.boundingSphere;
      mesh.visible = !!sphere && camera.position.distanceTo(sphere.center) < range + sphere.radius;
    }
  }
}

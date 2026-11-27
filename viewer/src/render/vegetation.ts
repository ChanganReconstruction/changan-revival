import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Materials } from './materials';

export type VegetationTier = 'near' | 'middle' | 'far';
export interface TreeRecord {
  x: number; y: number; z: number; size: number; rotation: number; tint: string;
}

// 按屏幕高度选层级，不绑定渲染比例；低分辨率开关仍只改变像素负载。
export function vegetationTier(pixels: number, quality: string, previous?: VegetationTier) {
  const near = quality === 'high' ? 24 : quality === 'low' ? 52 : 36;
  const middle = quality === 'high' ? 6 : quality === 'low' ? 14 : 9;
  if (previous === 'near' && pixels >= near * 0.85) return 'near';
  if (previous === 'middle') {
    if (pixels > near * 1.15) return 'near';
    return pixels >= middle * 0.85 ? 'middle' : 'far';
  }
  if (previous === 'far') {
    if (pixels > near * 1.15) return 'near';
    return pixels > middle * 1.15 ? 'middle' : 'far';
  }
  return pixels >= near ? 'near' : pixels >= middle ? 'middle' : 'far';
}

export function crownCards() {
  const front = new THREE.PlaneGeometry(1, 1);
  const side = front.clone().rotateY(Math.PI / 2);
  // 纯竖向卡片在正俯视时面积趋零；补一张只取树冠的水平卡片保留林木轮廓。
  const top = front.clone();
  const uv = top.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, 0.25 + uv.getY(i) * 0.75);
  top.rotateX(-Math.PI / 2).translate(0, 6.1 / 9.9 - 0.5, 0);
  const result = mergeGeometries([front, side, top])!;
  front.dispose(); side.dispose(); top.dispose();
  return result;
}

function crownMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  // 灰度树冠乘共享叶色及实例色，不绘制绿底矩形，也不铺到田草表面。
  ctx.fillStyle = '#81725a';
  ctx.fillRect(61, 60, 6, 68);
  ctx.fillStyle = '#f2f4ee';
  ctx.beginPath();
  const outline = [[64, 2], [86, 8], [97, 23], [114, 34], [119, 57],
    [106, 77], [86, 85], [65, 96], [43, 86], [21, 79], [9, 59],
    [15, 36], [30, 22], [43, 7]];
  outline.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d4dccb';
  ctx.beginPath(); ctx.moveTo(64, 2); ctx.lineTo(65, 96);
  ctx.lineTo(106, 77); ctx.lineTo(119, 57); ctx.lineTo(97, 23); ctx.fill();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({
    color: '#719450', map, alphaTest: 0.45, side: THREE.DoubleSide,
    // 使用裁切而非半透明混合，避免树冠排序穿插和不必要的透明多层绘制。
    transparent: false, depthWrite: true, alphaToCoverage: true,
  });
}

export class Vegetation {
  readonly trees: TreeRecord[] = [];
  readonly meshes: THREE.InstancedMesh[] = [];
  readonly stats = { total: 0, near: 0, middle: 0, far: 0, uploads: 0 };
  private tiers: VegetationTier[] = [];
  private transform = new THREE.Object3D();
  private point = new THREE.Vector3();
  private color = new THREE.Color();

  private scene: THREE.Scene;
  private materials: Pick<Materials, 'leaf' | 'trunk'>;
  private farMaterial?: THREE.Material;

  constructor(
    scene: THREE.Scene, materials: Pick<Materials, 'leaf' | 'trunk'>,
    farMaterial?: THREE.Material,
  ) {
    this.scene = scene; this.materials = materials; this.farMaterial = farMaterial;
  }

  add(tree: TreeRecord) { this.trees.push({ ...tree }); }

  finish() {
    const shapes = [new THREE.CylinderGeometry(0.16, 0.28, 1, 5),
      new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), crownCards()];
    const materials = [this.materials.trunk, this.materials.leaf,
      this.materials.leaf, this.farMaterial ?? crownMaterial()];
    const names = ['近景树干', '近景树冠', '中景简冠', '远景树冠卡片'];
    const bounds = new THREE.Box3();
    for (const tree of this.trees) {
      // 包围体覆盖任意树尺寸及旋转后的卡片，不以固定八米余量误剔大树。
      const extent = tree.size * 5;
      bounds.expandByPoint(new THREE.Vector3(tree.x - extent, tree.y, tree.z - extent));
      bounds.expandByPoint(new THREE.Vector3(
        tree.x + extent, tree.y + tree.size * 10, tree.z + extent,
      ));
    }
    shapes.forEach((geometry, i) => {
      const mesh = new THREE.InstancedMesh(geometry, materials[i], this.trees.length);
      mesh.name = `植被·${names[i]}`;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.boundingBox = bounds.clone();
      mesh.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    });
    this.stats.total = this.trees.length;
  }

  update(camera: THREE.PerspectiveCamera, height: number, quality: string) {
    const factor = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    let changed = this.tiers.length !== this.trees.length;
    this.trees.forEach((tree, i) => {
      this.point.set(tree.x, tree.y + 5 * tree.size, tree.z);
      const distance = Math.max(1, camera.position.distanceTo(this.point));
      const tier = vegetationTier(9.9 * tree.size * factor / distance, quality, this.tiers[i]);
      changed ||= tier !== this.tiers[i];
      this.tiers[i] = tier;
    });
    // 阈值附近有滞回；未跨层级时不重新上传矩阵，静止时也不请求额外帧。
    if (!changed) return false;
    const counts = [0, 0, 0, 0];
    const put = (mesh: number, tree: TreeRecord, cy: number, sx: number, sy: number, sz: number) => {
      this.transform.position.set(tree.x, tree.y + cy * tree.size, tree.z);
      this.transform.scale.set(sx * tree.size, sy * tree.size, sz * tree.size);
      this.transform.rotation.set(0, tree.rotation, 0);
      this.transform.updateMatrix();
      const index = counts[mesh]++;
      this.meshes[mesh].setMatrixAt(index, this.transform.matrix);
      this.meshes[mesh].setColorAt(index, this.color.set(mesh === 0 ? '#ffffff' : tree.tint));
    };
    this.trees.forEach((tree, i) => {
      const tier = this.tiers[i];
      if (tier === 'near') {
        put(0, tree, 2.5, 1, 5, 1);
        put(1, tree, 6.1, 3.5, 3.8, 3);
      } else if (tier === 'middle') put(2, tree, 6.1, 3.5, 3.8, 3);
      else put(3, tree, 4.95, 7, 9.9, 7);
    });
    this.meshes.forEach((mesh, i) => {
      mesh.count = counts[i];
      mesh.visible = counts[i] > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    this.stats.near = counts[1];
    this.stats.middle = counts[2];
    this.stats.far = counts[3];
    this.stats.uploads++;
    return true;
  }
}

import * as THREE from 'three';
import { mountainGeometry, weiRiverGeometry } from '../world/regional-landscape.ts';
import type { Materials } from './materials';
import { groundColorAt } from '../world/land-colors.ts';

function countrysideMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  // 田草直接烘焙到一张远景图，不为每块农田制造独立网格。
  for (let row = 0; row < 512; row++) {
    let start = 0, previous = '';
    for (let col = 0; col <= 512; col++) {
      const color = col < 512
        ? groundColorAt((col / 512 - 0.5) * 27000, (row / 512 - 0.5) * 27000) : '';
      if (color !== previous) {
        if (col > 0) {
          ctx.fillStyle = previous;
          ctx.fillRect(start, row, col - start, 1);
        }
        previous = color;
        start = col;
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export type Hour = 'dawn' | 'day' | 'golden' | 'night';

const PALETTES: Record<Hour, {
  sky: string; horizon: string; fog: string; sun: string;
  ambient: string; intensity: number; ambientPower: number;
  fogDensity: number; direction: number[];
}> = {
  dawn: {
    sky: '#9baeb4', horizon: '#eacba4', fog: '#c9beaa', sun: '#ffdec0',
    ambient: '#b9cddd', intensity: 2.4, ambientPower: 1.7, fogDensity: 0.00014,
    direction: [950, 370, 700],
  },
  day: {
    sky: '#a7c6d6', horizon: '#e2e8e8', fog: '#bbcbd0', sun: '#fffaf1',
    ambient: '#dbe8f2', intensity: 3.0, ambientPower: 1.5, fogDensity: 0.00012,
    direction: [-750, 1200, 500],
  },
  golden: {
    sky: '#a5bfce', horizon: '#eee0cc', fog: '#bdc3bb', sun: '#ffe6be',
    ambient: '#d1e0eb', intensity: 3.3, ambientPower: 1.65, fogDensity: 0.00015,
    direction: [-1000, 240, 650],
  },
  night: {
    sky: '#101e30', horizon: '#485360', fog: '#34464c', sun: '#9ab7df',
    ambient: '#7994ac', intensity: 0.85, ambientPower: 1.0, fogDensity: 0.00009,
    direction: [-500, 850, -500],
  },
};

export class Environment {
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.HemisphereLight;
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  hour: Hour = 'golden';
  private shadowKey = '';

  constructor(private scene: THREE.Scene, private materials: Materials) {
    scene.fog = new THREE.FogExp2('#c8bea2', 0.00019);
    this.sun = new THREE.DirectionalLight('#ffdda3', 3.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 4500;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.5;
    this.sun.shadow.radius = 2;
    scene.add(this.sun, this.sun.target);
    this.ambient = new THREE.HemisphereLight('#d1e0eb', '#82908b', 1.65);
    scene.add(this.ambient);
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(13000, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color('#aab8b4') },
          bottom: { value: new THREE.Color('#eed9ae') },
          lightDirection: { value: new THREE.Vector3() },
          orbColor: { value: new THREE.Color('#ffe6be') },
          nightMode: { value: 0 },
        },
        vertexShader: `varying vec3 vDirection;
          void main() {
            vDirection = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `varying vec3 vDirection;
          uniform vec3 top;
          uniform vec3 bottom;
          uniform vec3 lightDirection;
          uniform vec3 orbColor;
          uniform float nightMode;
          void main() {
            vec3 ray = normalize(vDirection);
            float h = pow(max(ray.y, 0.0), 0.55);
            vec3 skyColor = mix(bottom, top, h);
            float alignment = dot(ray, normalize(lightDirection));
            float visible = step(-0.005, ray.y);
            float halo = smoothstep(cos(0.09), cos(0.016), alignment);
            float discRadius = mix(0.009, 0.006, nightMode);
            float disc = smoothstep(cos(discRadius + 0.002),
              cos(discRadius - 0.002), alignment) * visible;
            skyColor = mix(skyColor, orbColor, halo * visible * 0.10);
            skyColor = mix(skyColor, orbColor, disc * 0.92);
            gl_FragColor = vec4(skyColor, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.makeLandscape();
    this.setHour('golden');
  }

  private makeLandscape() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(27000, 27000),
      new THREE.MeshLambertMaterial({ color: '#ffffff', map: countrysideMap() }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.4;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const mountainMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true, flatShading: true,
    });
    for (const side of ['south', 'north'] as const) {
      const mountain = new THREE.Mesh(mountainGeometry(side), mountainMaterial);
      mountain.name = side === 'south' ? '终南山·方位示意' : '北部远塬·低缓地平线';
      this.scene.add(mountain);
    }
    const river = new THREE.Mesh(weiRiverGeometry(), this.materials.water);
    river.name = '渭水·城北西来东去·河道示意';
    river.userData.geographicAccuracy = '相对方位与流向，不是历史测绘河岸';
    const bank = new THREE.Mesh(weiRiverGeometry(true), this.materials.earth);
    bank.name = '渭水两岸';
    this.scene.add(river, bank);
  }

  setHour(hour: Hour) {
    const palette = PALETTES[hour];
    this.hour = hour;
    this.sky.material.uniforms.top.value.set(palette.sky);
    this.sky.material.uniforms.bottom.value.set(palette.horizon);
    this.sky.material.uniforms.orbColor.value.set(palette.sun);
    this.sky.material.uniforms.lightDirection.value
      .set(palette.direction[0], palette.direction[1], palette.direction[2]).normalize();
    this.sky.material.uniforms.nightMode.value = hour === 'night' ? 1 : 0;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.set(palette.fog);
    fog.density = palette.fogDensity;
    this.sun.color.set(palette.sun);
    this.sun.intensity = palette.intensity;
    this.ambient.color.set(palette.ambient);
    this.ambient.intensity = palette.ambientPower;
    this.materials.lamp.emissiveIntensity = hour === 'night' ? 4 : 0;
    this.materials.dark.color.set(hour === 'night' ? '#9d6941' : '#342c24');
    this.materials.dark.emissive.set(hour === 'night' ? '#a05a25' : '#000000');
    this.materials.dark.emissiveIntensity = hour === 'night' ? 0.65 : 0;
    this.materials.facade.emissiveIntensity = hour === 'night' ? 0.6 : 0;
  }

  update(camera: THREE.Camera, target: THREE.Vector3) {
    this.sky.position.copy(camera.position);
    const direction = PALETTES[this.hour].direction;
    // 阴影聚焦当前观察区域；鸟瞰扩大覆盖，近景保留檐柱接触层次。
    const distance = camera.position.distanceTo(target);
    const range = THREE.MathUtils.clamp(Math.ceil(distance * 0.48 / 12) * 12, 95, 1150);
    const step = Math.max(0.25, range / 256);
    const cx = Math.round(target.x / step) * step;
    const cy = Math.round(target.y / step) * step;
    const cz = Math.round(target.z / step) * step;
    const key = `${this.hour}:${range}:${cx}:${cy}:${cz}`;
    if (key === this.shadowKey) return false;
    this.shadowKey = key;
    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = shadowCamera.bottom = -range;
    shadowCamera.right = shadowCamera.top = range;
    shadowCamera.updateProjectionMatrix();
    this.sun.position.set(cx + direction[0], cy + direction[1], cz + direction[2]);
    this.sun.target.position.set(cx, cy, cz);
    return true;
  }
}

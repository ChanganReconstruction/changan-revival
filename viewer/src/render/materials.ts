import * as THREE from 'three';
import { random } from '../world/layout';

function surface(kind: 'roof' | 'earth' | 'stone' | 'wall' | 'facade'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const rng = random(126 + kind.length);
  ctx.fillStyle = kind === 'roof' ? '#9fa4a0' : '#e4e3de';
  ctx.fillRect(0, 0, 256, 256);
  // 程序纹理替代逐片瓦和逐块砖，固定种子保证截图与布局可复现。
  if (kind === 'roof') {
    for (let x = 0; x < 256; x += 16) {
      const grad = ctx.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, '#969e99');
      grad.addColorStop(0.35, '#a5aca5');
      grad.addColorStop(0.7, '#a0a7a0');
      grad.addColorStop(1, '#929b95');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 16, 256);
      for (let y = 0; y < 256; y += 32) {
        ctx.fillStyle = 'rgba(33,46,42,.13)';
        ctx.fillRect(x, y, 16, 1);
      }
    }
  }
  if (kind === 'stone') {
    ctx.strokeStyle = 'rgba(66,60,50,.16)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 256; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
      for (let x = (y % 128) / 2; x < 256; x += 96) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke();
      }
    }
  }
  for (let i = 0; i < 11000; i++) {
    const light = rng() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,255,230,.045)' : 'rgba(40,32,24,.035)';
    ctx.fillRect(rng() * 256, rng() * 256, rng() * 2 + 0.5, 1);
  }
  if (kind === 'facade') {
    // 图集将门窗画进同一张共享纹理，远景也不依赖独立窗框网格。
    ctx.fillStyle = '#e3ded1';
    ctx.fillRect(0, 0, 256, 256);
    // 背景柱梁改画在共享图集中，檐下有压暗层次而不增加每屋构件。
    ctx.fillStyle = '#7c6550';
    ctx.fillRect(0, 0, 256, 13);
    ctx.fillRect(0, 238, 256, 18);
    for (let x = 0; x < 256; x += 50) ctx.fillRect(x, 12, 4, 226);
    for (let i = 0; i < 5; i++) {
      const x = 8 + i * 50;
      const door = i === 2;
      ctx.fillStyle = door ? '#44372c' : '#3d332b';
      ctx.fillRect(x, door ? 105 : 92, 34, door ? 150 : 78);
      if (!door) {
        ctx.fillStyle = '#89918a';
        ctx.fillRect(x + 4, 96, 26, 62);
        ctx.fillStyle = '#332c25';
        for (let j = 1; j < 4; j++) ctx.fillRect(x + j * 7, 96, 2, 62);
        ctx.fillRect(x + 4, 126, 26, 2);
      }
      ctx.fillStyle = '#76543a';
      ctx.fillRect(x - 3, door ? 101 : 88, 40, 4);
    }
  }
  if (kind === 'earth') {
    for (let y = 0; y < 256; y += 4) {
      ctx.fillStyle = `rgba(80,63,35,${rng() * 0.04})`;
      ctx.fillRect(0, y, 256, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function facadeGlow(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 256);
  // 仅窗玻璃进入自发光贴图，墙面、窗框和门保持黑色。
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12 + i * 50, 96, 26, 62);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function palaceFacade(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d8cbb6';
  ctx.fillRect(0, 0, 128, 128);
  // 一开间循环；柱、檐下阴影、斗栱和格扇都在墙面贴图上。
  ctx.fillStyle = '#4b3a31';
  ctx.fillRect(0, 0, 128, 26);
  ctx.fillStyle = '#894b39';
  ctx.fillRect(0, 23, 128, 10);
  ctx.fillRect(0, 23, 11, 103);
  ctx.fillRect(117, 23, 11, 103);
  ctx.fillRect(18, 45, 92, 70);
  ctx.fillStyle = '#514c42';
  ctx.fillRect(24, 51, 80, 56);
  ctx.fillStyle = '#ab8a65';
  for (let x = 31; x < 104; x += 9) ctx.fillRect(x, 51, 2, 56);
  for (const y of [63, 76, 91]) ctx.fillRect(24, y, 80, 2);
  ctx.fillStyle = '#ad7853';
  for (const x of [4, 56, 108]) {
    ctx.fillRect(x, 12, 16, 6);
    ctx.fillRect(x + 4, 18, 8, 9);
  }
  ctx.fillStyle = '#807466';
  ctx.fillRect(0, 117, 128, 11);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createMaterials() {
  const roofMap = surface('roof');
  // 瓦垄约四十厘米一级，避免把贴图拉成夸张的波浪形屋面。
  roofMap.repeat.set(4, 1);
  const earthMap = surface('earth');
  const stoneMap = surface('stone');
  const wallMap = surface('wall');
  const facadeMap = surface('facade');
  const facadeGlowMap = facadeGlow();
  const standard = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  const lambert = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
    new THREE.MeshLambertMaterial({ color, ...extra });
  return {
    // 中性纹理配材质底色，避免米黄贴图、米黄材质和实例色连续相乘。
    roof: lambert('#a5b2bb', { map: roofMap, side: THREE.DoubleSide }),
    stone: lambert('#c8cdcb', { map: stoneMap }),
    wall: lambert('#f2eee2', { map: wallMap }),
    facade: lambert('#ffffff', {
      map: facadeMap, emissive: '#ffbf67', emissiveMap: facadeGlowMap,
      emissiveIntensity: 0, side: THREE.DoubleSide,
    }),
    palaceFacade: lambert('#ffffff', { map: palaceFacade() }),
    wood: lambert('#805137'),
    vermilion: lambert('#b24b39'),
    dark: standard('#342c24'),
    earth: lambert('#b9ad98', { map: earthMap }),
    // 院地与夯土城墙分材质，改地表不能连城墙和台基一起刷绿。
    yard: lambert('#c3c5bc', { map: earthMap }),
    paving: lambert('#c2cac9', { map: stoneMap }),
    road: lambert('#c6c2b6', { map: earthMap }),
    grass: lambert('#8fa67e', { map: earthMap }),
    leaf: lambert('#719450', { flatShading: true }),
    trunk: lambert('#63513a'),
    water: standard('#4f8f96', {
      roughness: 0.27, metalness: 0.26, transparent: true, opacity: 0.94,
    }),
    cloth: standard('#c18b61', { side: THREE.DoubleSide }),
    gold: standard('#b79d60', { roughness: 0.5, metalness: 0.35 }),
    lamp: standard('#ffd698', { emissive: '#ffb357', emissiveIntensity: 0 }),
  };
}

export type Materials = ReturnType<typeof createMaterials>;
export type MaterialKey = keyof Materials;

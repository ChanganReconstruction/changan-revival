import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials } from './render/materials';
import { Environment, type Hour } from './render/environment';
import { createCity } from './world/city';
import { CLASSIC_VIEWS, PLACES, VIEWS, type Ward } from './world/layout';
import { districtFor } from './world/districts';
import { parseRenderScale, renderDimensions, type RenderScale } from './render/resolution';
import { PAGODAS } from './world/temple-pagodas';
import { createJianfusiDemo } from './jianfusi-demo';

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`未找到界面元素：${selector}`);
  return element;
};

interface CityStats {
  fps: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  instances: number;
  buildings: number;
  batches: number;
  loadMs: number;
  view: string;
  quality: string;
  renderedFrames: number;
  shadowUpdates: number;
  idle: boolean;
  gpu: string;
  renderScale: number;
  bufferWidth: number;
  bufferHeight: number;
  vegetationTotal: number;
  vegetationNear: number;
  vegetationMiddle: number;
  vegetationFar: number;
  vegetationUploads: number;
}

declare global {
  interface Window {
    __CHANGAN__?: {
      ready: boolean;
      stats: CityStats;
      setView: (id: string, immediate?: boolean) => void;
      setHour: (hour: Hour) => void;
      setRenderScale: (scale: RenderScale) => void;
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
    };
  }
}

async function start() {
  const started = performance.now();
  const params = new URLSearchParams(location.search);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = $<HTMLCanvasElement>('#world');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let renderRequested = true;
  const invalidate = () => { renderRequested = true; };
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  // 公里级鸟瞰提高近裁面精度，避免地形、薄路面与院坪远处深度争抢。
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 5, 25000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 20;
  controls.maxDistance = 10000;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.minPolarAngle = 0.1;
  controls.zoomSpeed = 0.7;
  controls.panSpeed = 0.7;
  controls.target.set(0, 0, -120);
  controls.addEventListener('change', invalidate);
  const materials = createMaterials();
  const environment = new Environment(scene, materials);
  // 先让加载界面完成一帧，再生成城市，避免首屏无反馈。
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const city = createCity(scene, materials);
  const jianfusi = createJianfusiDemo($('#jianfusi-demo'), invalidate);

  const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { samples: 2 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  ao.updateGtaoMaterial({ radius: 5, thickness: 2, samples: 8, distanceExponent: 1 });
  ao.blendIntensity = 0.6;
  composer.addPass(ao);
  composer.addPass(new OutputPass());

  const stats: CityStats = {
    fps: 0, calls: 0, triangles: 0, geometries: 0, textures: 0,
    instances: city.batches.instances, buildings: city.batches.buildings,
    batches: city.batches.meshes.length + city.vegetation.meshes.length,
    loadMs: 0, view: 'city', quality: 'medium',
    renderedFrames: 0, shadowUpdates: 0, idle: false, gpu: '',
    renderScale: parseRenderScale(params.get('scale')),
    bufferWidth: 0, bufferHeight: 0,
    vegetationTotal: city.vegetation.stats.total,
    vegetationNear: 0, vegetationMiddle: 0, vegetationFar: 0, vegetationUploads: 0,
  };
  let renderScale = stats.renderScale as RenderScale;
  const qualitySelect = $<HTMLSelectElement>('#quality');
  const scaleSelect = $<HTMLSelectElement>('#render-scale');
  const mobile = matchMedia('(max-width: 700px)').matches;
  const gl = renderer.getContext();
  const debugRenderer = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = debugRenderer ? String(gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL)) : '';
  const software = /swiftshader|llvmpipe|software/i.test(gpu);
  stats.gpu = gpu;
  const benchmark = params.get('benchmark') === '1';
  // 无独立显卡的环境默认降档，避免阴影和环境遮蔽占满软件光栅器。
  let quality = params.get('q') || (mobile || software ? 'low' : 'medium');
  if (!['low', 'medium', 'high'].includes(quality)) quality = 'medium';

  function resize() {
    invalidate();
    const dprCap = quality === 'high' ? 1.75 : quality === 'medium' ? 1.35 : 1;
    const dimensions = renderDimensions(
      innerWidth, innerHeight, devicePixelRatio, dprCap, renderScale,
    );
    renderer.setPixelRatio(dimensions.pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    // 合成器各画质档都同步缓冲尺寸，避免切档后保留旧分辨率。
    composer.setPixelRatio(dimensions.pixelRatio);
    composer.setSize(innerWidth, innerHeight);
    stats.renderScale = renderScale;
    stats.bufferWidth = dimensions.width;
    stats.bufferHeight = dimensions.height;
  }
  function setRenderScale(value: RenderScale) {
    renderScale = value;
    stats.renderScale = value;
    scaleSelect.value = value === 1 ? '1' : value === 0.85 ? '.85' : '.7';
    resize();
  }
  function setQuality(value: string) {
    quality = value;
    stats.quality = value;
    qualitySelect.value = value;
    ao.enabled = value === 'high';
    renderer.shadowMap.enabled = value !== 'low';
    renderer.shadowMap.needsUpdate = true;
    invalidate();
    const shadowSize = value === 'high' ? 4096 : 2048;
    environment.sun.shadow.mapSize.set(shadowSize, shadowSize);
    environment.sun.shadow.map?.dispose();
    environment.sun.shadow.map = null;
    city.batches.updateDetails(camera, quality);
    resize();
  }
  qualitySelect.addEventListener('change', () => setQuality(qualitySelect.value));
  scaleSelect.value = renderScale === 1 ? '1' : renderScale === 0.85 ? '.85' : '.7';
  scaleSelect.addEventListener('change', () => {
    setRenderScale(parseRenderScale(scaleSelect.value));
  });
  addEventListener('resize', resize);

  let flight: {
    start: number; from: THREE.Vector3; to: THREE.Vector3;
    fromTarget: THREE.Vector3; toTarget: THREE.Vector3;
  } | null = null;
  let activeView = 'city';
  let touring = false;
  let lastTour = 0;
  let labelsEnabled = params.get('labels') !== '0';
  const viewKeys: string[] = ['city', 'basin', ...CLASSIC_VIEWS, 'manor', 'artisan', 'craft'];
  const nav = $('#view-nav');
  function openJianfusi(trigger: HTMLElement) {
    flight = null;
    setTour(false);
    jianfusi.open(trigger);
  }

  // 只拾取小雁塔的包围盒，不遍历全城实例。OrbitControls 的拖动不能触发入口。
  const tower = PAGODAS.xiaoyan;
  const towerBounds = new THREE.Box3(
    new THREE.Vector3(tower.x - tower.width / 2, 0, tower.z - tower.width / 2),
    new THREE.Vector3(tower.x + tower.width / 2, tower.height + 2, tower.z + tower.width / 2),
  );
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let tap: { id: number; x: number; y: number } | undefined;
  function hitsTower(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      1 - (event.clientY - rect.top) / rect.height * 2);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray.intersectsBox(towerBounds);
  }
  canvas.addEventListener('pointerdown', (event) => {
    tap = event.isPrimary && event.button === 0 && hitsTower(event)
      ? { id: event.pointerId, x: event.clientX, y: event.clientY } : undefined;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 6) {
      tap = undefined;
    }
  });
  canvas.addEventListener('pointercancel', () => { tap = undefined; });
  canvas.addEventListener('pointerup', (event) => {
    const start = tap;
    tap = undefined;
    if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 6
      && hitsTower(event)) openJianfusi(canvas);
  });
  const navSubtitles: Record<string, string> = {
    city: '盛唐全景', avenue: '都城中轴', palace: '大明宫阙', market: '西市棚肆',
    pagoda: '慈恩浮图', lake: '城南园林', craft: '密居近赏', manor: '府第深院',
    artisan: '作坊邸店', temple: '大兴善寺', eastMarket: '东市货院', qinglong: '高地寺阁',
  };
  for (const [index, id] of viewKeys.entries()) {
    const view = VIEWS[id];
    const button = document.createElement('button');
    button.dataset.view = id;
    const number = String(index + 1).padStart(2, '0');
    button.innerHTML = `<span class="nav-number">${number}</span><span><strong>${view.name}</strong>`
      + `<small>${navSubtitles[id] || view.subtitle.split(' · ')[0]}</small></span>`;
    button.addEventListener('click', () => { setTour(false); setView(id); });
    nav.append(button);
  }
  function setView(id: string, immediate = false) {
    const view = VIEWS[id];
    if (!view) return;
    if (id === 'curfew') setHour('night');
    activeView = id;
    document.querySelectorAll('[data-ward].selected').forEach((item) => {
      item.classList.remove('selected');
    });
    stats.view = id;
    invalidate();
    const position = new THREE.Vector3(...view.position);
    const lookAt = new THREE.Vector3(...view.target);
    if (immediate || reducedMotion) {
      flight = null;
      camera.position.copy(position);
      controls.target.copy(lookAt);
      controls.update();
      city.batches.updateDetails(camera, quality);
    } else {
      flight = {
        start: performance.now(), from: camera.position.clone(), to: position,
        fromTarget: controls.target.clone(), toTarget: lookAt,
      };
    }
    $('#view-number').textContent = String(viewKeys.indexOf(id) + 1).padStart(2, '0');
    $('#view-name').textContent = view.name;
    $('#view-subtitle').textContent = view.subtitle;
    $('#view-description').textContent = view.description;
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
      const active = button.dataset.view === id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'true' : 'false');
      if (active) button.scrollIntoView({ block: 'nearest', inline: 'nearest',
        behavior: immediate || reducedMotion ? 'instant' : 'smooth' });
    });
  }
  controls.addEventListener('start', () => { flight = null; setTour(false); });
  $('#home').addEventListener('click', (event) => {
    event.preventDefault(); setTour(false); setView('city');
  });

  function setHour(hour: Hour) {
    invalidate();
    renderer.shadowMap.needsUpdate = true;
    environment.setHour(hour);
    city.setNight(hour === 'night');
    document.body.classList.toggle('night', hour === 'night');
    document.querySelectorAll<HTMLButtonElement>('[data-hour]').forEach((button) => {
      const active = button.dataset.hour === hour;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  document.querySelectorAll<HTMLButtonElement>('[data-hour]').forEach((button) => {
    button.addEventListener('click', () => setHour(button.dataset.hour as Hour));
  });
  const initialHour = params.get('hour') as Hour;
  if (['dawn', 'day', 'golden', 'night'].includes(initialHour)) setHour(initialHour);

  function setTour(enabled: boolean) {
    touring = enabled;
    invalidate();
    lastTour = performance.now();
    $('#tour').setAttribute('aria-pressed', String(enabled));
    $('#tour').innerHTML = enabled ? 'Ⅱ 暂停巡游' : '<span class="play-symbol">▷</span> 自动巡游';
  }
  $('#tour').addEventListener('click', () => setTour(!touring));
  $('#toggle-labels').setAttribute('aria-pressed', String(labelsEnabled));
  $('#toggle-labels').addEventListener('click', () => {
    labelsEnabled = !labelsEnabled;
    invalidate();
    $('#toggle-labels').setAttribute('aria-pressed', String(labelsEnabled));
  });
  function toggleInterface() {
    const hidden = document.body.classList.toggle('ui-hidden');
    $('#restore-ui').hidden = !hidden;
  }
  $('#hide-ui').addEventListener('click', toggleInterface);
  $('#restore-ui').addEventListener('click', toggleInterface);
  $('#fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { $('#fullscreen').title = '当前浏览器不允许全屏，可使用浏览器全屏功能'; }
  });
  const dialog = $<HTMLDialogElement>('#help');
  $('#help-button').addEventListener('click', () => dialog.showModal());
  $('#close-help').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  $('#stats-button').addEventListener('click', () => { $('#stats').hidden = !$('#stats').hidden; });
  addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'h' && !dialog.open) toggleInterface();
    if (event.key === 'Escape') setTour(false);
  });

  const labelRoot = $('#labels');
  const labels = PLACES.map((place) => {
    const element = document.createElement('span');
    element.className = 'place-label';
    element.textContent = place.name;
    labelRoot.append(element);
    return { ...place, element, position: new THREE.Vector3(place.x, place.y, place.z) };
  });
  const projected = new THREE.Vector3();
  const direction = new THREE.Vector3();
  function updateLabels() {
    labelRoot.hidden = !labelsEnabled;
    if (!labelsEnabled) return;
    const occupied: { x: number; y: number }[] = [];
    for (const label of labels) {
      projected.copy(label.position).project(camera);
      const x = (projected.x * 0.5 + 0.5) * innerWidth;
      const y = (-projected.y * 0.5 + 0.5) * innerHeight - 9;
      const distance = camera.position.distanceTo(label.position);
      const overlaps = occupied.some((other) => Math.abs(other.x - x) < 78 && Math.abs(other.y - y) < 47);
      const labelRange = Math.max(250, camera.position.distanceTo(controls.target) * 4);
      const visible = distance < labelRange && projected.z < 1 && projected.z > -1
        && x > 40 && x < innerWidth - 40
        && y > 150 && y < innerHeight - 210 && !overlaps
        && (distance < 2600 || label.rank === 1) && (distance > 100 || label.id !== 'zhuque');
      label.element.style.opacity = visible ? '1' : '0';
      if (visible) {
        label.element.style.left = `${x}px`;
        label.element.style.top = `${y}px`;
        occupied.push({ x, y });
      }
    }
  }

  function inspectWard(ward: Ward) {
    const profile = districtFor(ward);
    setTour(false);
    invalidate();
    flight = {
      start: performance.now(), from: camera.position.clone(),
      to: new THREE.Vector3(ward.x + 90, profile.elevation + 85, ward.z + 110),
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(ward.x, profile.elevation + 3, ward.z),
    };
    $('#view-number').textContent = '坊';
    $('#view-name').textContent = profile.name;
    $('#view-subtitle').textContent = profile.feature;
    $('#view-description').textContent = '坊名沿用原项目坊表，部分为推定；'
      + '院落、道路与地标位置均经艺术化压缩，并非逐坊考古复原。';
    document.querySelectorAll('[data-ward]').forEach((item) => {
      item.classList.toggle('selected', item.getAttribute('data-ward') === ward.id);
    });
    document.querySelectorAll('[data-view]').forEach((item) => {
      item.classList.remove('active'); item.setAttribute('aria-current', 'false');
    });
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  for (const ward of city.wards) {
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', String(ward.x - ward.width / 2));
    rect.setAttribute('y', String(ward.z - ward.depth / 2));
    rect.setAttribute('width', String(ward.width));
    rect.setAttribute('height', String(ward.depth));
    const profile = districtFor(ward);
    rect.setAttribute('class', `map-ward map-${profile.family}`);
    rect.setAttribute('data-ward', ward.id);
    rect.setAttribute('tabindex', '0');
    rect.setAttribute('role', 'button');
    rect.setAttribute('aria-label', `${profile.name} · ${profile.feature}`);
    const title = document.createElementNS(svgNS, 'title');
    title.textContent = `${profile.name} · ${profile.feature}`;
    rect.append(title);
    rect.addEventListener('click', () => inspectWard(ward));
    rect.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); inspectWard(ward);
      }
    });
    $('#map-wards').append(rect);
  }

  setView(params.get('view') || 'city', true);
  setQuality(quality);
  if (params.get('ui') === '0') toggleInterface();
  if (params.get('stats') === '1') $('#stats').hidden = false;
  let lastStats = performance.now();
  let frames = 0;
  let ready = false;
  let previousFrame = performance.now();
  let lastRendered = 0;
  function updateStatsPanel() {
    const state = stats.idle ? '静止 · 暂停重绘' : `交互 ${stats.fps} FPS`;
    $('#stats').innerHTML = `${state}<br>绘制 ${stats.calls}（当前帧全遍）`
      + `<br>三角面 ${(stats.triangles / 10000).toFixed(1)} 万`
      + `<br>建筑 ${stats.buildings} · 实例 ${stats.instances}`
      + `<br>批次 ${stats.batches} · GPU 几何 ${stats.geometries}`
      + `<br>已绘 ${stats.renderedFrames} 帧 · 阴影更新 ${stats.shadowUpdates}`
      + `<br>首帧提交 ${stats.loadMs} ms · ${quality}`
      + `<br>渲染比例 ${Math.round(stats.renderScale * 100)}% · 缓冲`
      + ` ${stats.bufferWidth}×${stats.bufferHeight}`;
  }

  function frame(now: number) {
    requestAnimationFrame(frame);
    if (document.hidden || jianfusi.active) { previousFrame = now; return; }
    const delta = Math.min((now - previousFrame) / 1000, 0.05);
    previousFrame = now;
    if (flight) {
      const t = Math.min((now - flight.start) / 2200, 1);
      const eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(flight.from, flight.to, eased);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
      if (t === 1) flight = null;
    }
    if (touring && !flight && !reducedMotion) {
      direction.copy(camera.position).sub(controls.target).applyAxisAngle(
        new THREE.Vector3(0, 1, 0), delta * 0.018,
      );
      camera.position.copy(controls.target).add(direction);
    }
    if (touring && now - lastTour > 14000) {
      const next = (viewKeys.indexOf(activeView) + 1) % viewKeys.length;
      setView(viewKeys[next]); lastTour = now;
    }
    // 相机目标限制在城域内，防止平移失控后只剩地平线。
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -1100, 1100);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -1200, 1000);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 90);
    camera.position.y = Math.max(camera.position.y, 4);
    controls.update();
    // 阻尼仍逐帧推进，但静止城市不重复提交 GPU，也不重复生成阴影。
    if (!renderRequested && !benchmark) {
      if (!stats.idle) { stats.idle = true; updateStatsPanel(); }
      return;
    }
    if (software && now - lastRendered < 125) return;
    lastRendered = now;
    renderRequested = false;
    stats.idle = false;
    if (environment.update(camera, controls.target)) renderer.shadowMap.needsUpdate = true;
    city.batches.updateDetails(camera, quality);
    city.vegetation.update(camera, innerHeight, quality);
    const foliage = city.vegetation.stats;
    stats.vegetationNear = foliage.near;
    stats.vegetationMiddle = foliage.middle;
    stats.vegetationFar = foliage.far;
    stats.vegetationUploads = foliage.uploads;
    stats.instances = city.batches.instances + foliage.near * 2 + foliage.middle + foliage.far;
    // 按需绘制时不能等下一帧纠正投影，切镜头后先同步相机矩阵。
    camera.updateMatrixWorld();
    updateLabels();
    const angle = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    $('#compass-needle').style.transform = `rotate(${-angle}rad)`;
    $('#map-target').setAttribute('cx', String(controls.target.x));
    $('#map-target').setAttribute('cy', String(controls.target.z));
    renderer.info.reset();
    if (renderer.shadowMap.enabled && renderer.shadowMap.needsUpdate) stats.shadowUpdates++;
    // 常规档直接绘制到屏幕；只有精致档支付环境遮蔽与离屏缓冲的成本。
    if (quality === 'high') composer.render();
    else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
    frames++;
    stats.renderedFrames++;
    stats.calls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;
    stats.geometries = renderer.info.memory.geometries;
    stats.textures = renderer.info.memory.textures;
    if (!ready) {
      ready = true;
      stats.loadMs = Math.round(performance.now() - started);
      $('#loading').style.opacity = '0';
      setTimeout(() => { $('#loading').hidden = true; }, 750);
      window.__CHANGAN__ = {
        ready, stats, setView, setHour, setRenderScale, renderer, scene, camera, controls,
      };
    }
    if (now - lastStats > 1000) {
      stats.fps = Math.round(frames * 1000 / (now - lastStats));
      updateStatsPanel();
      frames = 0; lastStats = now;
    }
  }
  requestAnimationFrame(frame);
}

start().catch((error: unknown) => {
  console.error(error);
  $('#loading h1').textContent = '暂未入城';
  $('#loading p').textContent = '请使用支持 WebGL 2 的现代浏览器，刷新重试';
  $('#loading small').textContent = error instanceof Error ? error.message : '场景加载失败';
});

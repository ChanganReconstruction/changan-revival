import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5174';
const output = new URL(process.env.OUTPUT || '../artifacts/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: Number(process.env.WIDTH || 1440), height: Number(process.env.HEIGHT || 900) },
});
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 120000 });
console.log('页面已响应，等待三维场景首帧');
if (!response?.ok()) throw new Error(`预览地址不可用：${response?.status()}`);
await page.waitForFunction(() => window.__CHANGAN__?.ready, { timeout: 120000 });
await page.waitForTimeout(1800);
const gpu = await page.evaluate(() => {
  const gl = window.__CHANGAN__.renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
const report = { url: baseURL, gpu, views: {}, checks: {}, errors };
await page.waitForFunction(() => window.__CHANGAN__.stats.idle);
report.checks.sunMatchesLight = await page.evaluate(() => {
  const scene = window.__CHANGAN__.scene;
  const sky = scene.children.find((mesh) => mesh.material?.uniforms?.lightDirection);
  const sun = scene.children.find((light) => light.isDirectionalLight);
  if (!sky || !sun) return false;
  const direction = sun.position.clone().sub(sun.target.position).normalize();
  return direction.distanceTo(sky.material.uniforms.lightDirection.value) < 0.00001;
});
const idleBefore = await page.evaluate(() => ({ ...window.__CHANGAN__.stats }));
await page.waitForTimeout(1200);
const idleAfter = await page.evaluate(() => ({ ...window.__CHANGAN__.stats }));
report.checks.idleNoDraw = idleAfter.renderedFrames === idleBefore.renderedFrames;
report.checks.idleNoShadow = idleAfter.shadowUpdates === idleBefore.shadowUpdates;
report.checks.idleNoVegetationUpload = idleAfter.vegetationUploads === idleBefore.vegetationUploads;
report.checks.vegetationCoverage = idleAfter.vegetationTotal > 0
  && idleAfter.vegetationNear + idleAfter.vegetationMiddle + idleAfter.vegetationFar
    === idleAfter.vegetationTotal;
report.checks.vegetationFarPresent = idleAfter.vegetationFar > 0;
report.checks.vegetationSharedMeshes = await page.evaluate(() => {
  const trees = window.__CHANGAN__.scene.children.filter((mesh) => mesh.name.startsWith('植被·'));
  const far = trees.find((mesh) => mesh.name === '植被·远景树冠卡片');
  return trees.length === 4 && trees.every((mesh) => mesh.isInstancedMesh && !mesh.castShadow)
    && far.material.alphaTest > 0 && !far.material.transparent;
});
await page.evaluate(() => {
  const { camera, controls } = window.__CHANGAN__;
  const offset = camera.position.clone().sub(controls.target);
  const theta = 0.05, x = offset.x, z = offset.z;
  offset.x = x * Math.cos(theta) + z * Math.sin(theta);
  offset.z = z * Math.cos(theta) - x * Math.sin(theta);
  camera.position.copy(controls.target).add(offset);
  controls.update();
});
await page.waitForTimeout(350);
await page.waitForFunction(() => window.__CHANGAN__.stats.idle);
const orbitAfter = await page.evaluate(() => ({ ...window.__CHANGAN__.stats }));
report.checks.orbitDraws = orbitAfter.renderedFrames > idleAfter.renderedFrames;
report.checks.orbitReusesShadow = orbitAfter.shadowUpdates === idleAfter.shadowUpdates;
report.checks.noUndefinedLabels = !(await page.locator('#view-nav').innerText()).includes('undefined');
report.checks.allWardsNamed = await page.locator('[data-ward]').count() === 108;
report.checks.geographyEntry = await page.locator('[data-view="basin"]').count() === 1;
report.checks.geographicBackdrop = await page.evaluate(() => {
  const scene = window.__CHANGAN__.scene;
  const names = ['终南山·方位示意', '北部远塬·低缓地平线',
    '渭水·城北西来东去·河道示意', '渭水两岸'];
  return names.every((name) => {
    const mesh = scene.getObjectByName(name);
    return mesh?.isMesh && !mesh.castShadow;
  });
});
report.checks.huangReachPresent = await page.evaluate(() => {
  const parts = window.__CHANGAN__.scene.children.filter((mesh) =>
    ['黄渠末段水面（示意）', '黄渠末段两岸', '黄渠末段岸脚'].includes(mesh.geometry?.name));
  return parts.length === 3 && parts.every((mesh) => mesh.isInstancedMesh && mesh.count === 1);
});
report.checks.huangReachDisclaimer = await page.evaluate(() => {
  const water = window.__CHANGAN__.scene.children.find((mesh) =>
    mesh.geometry?.name === '黄渠末段水面（示意）');
  const data = water?.geometry.userData;
  return data?.channel === 'huang' && data.complete === false && data.downstream === '曲江'
    && data.accuracy.includes('艺术示意') && data.upstream.includes('上游省略');
});
report.checks.longshouReachPresent = await page.evaluate(() => {
  const mesh = window.__CHANGAN__.scene.children.find((part) =>
    part.geometry?.name === '龙首西支末段水面（示意）');
  return mesh?.isInstancedMesh && mesh.count === 1
    && mesh.geometry.userData.downstream === '兴庆龙池'
    && mesh.geometry.userData.complete === false;
});
report.checks.longshouBridgeHasRealRoadGap = await page.evaluate(() => {
  // 验证实际提交到场景的实例几何，而不只验证生成函数的理想参数。
  const heights = (material) => {
    const result = [];
    for (const mesh of window.__CHANGAN__.scene.children) {
      if (!mesh.isInstancedMesh || !mesh.name.endsWith(`:${material}:false`)) continue;
      const p = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
      for (let instance = 0; instance < mesh.count; instance++) {
        const m = mesh.instanceMatrix.array.subarray(instance * 16, instance * 16 + 16);
        const vertex = (id) => {
          const i = index ? index.getX(id) : id;
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          return [m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14]];
        };
        for (let i = 0; i < (index?.count ?? p.count); i += 3) {
          const [a, b, c] = [vertex(i), vertex(i + 1), vertex(i + 2)];
          const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
          if (Math.abs(den) < 1e-8) continue;
          const u = ((b[2] - c[2]) * (819 - c[0])
            + (c[0] - b[0]) * (-193.5 - c[2])) / den;
          const v = ((c[2] - a[2]) * (819 - c[0])
            + (a[0] - c[0]) * (-193.5 - c[2])) / den;
          if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) {
            result.push(u * a[1] + v * b[1] + (1 - u - v) * c[1]);
          }
        }
      }
    }
    return result;
  };
  return heights('road').length === 0 && heights('wood').some((height) =>
    height > 1.6 && height < 1.7);
});
report.checks.channelHierarchy = await page.evaluate(() => {
  const meshes = window.__CHANGAN__.scene.children.filter((mesh) => mesh.isInstancedMesh
    && mesh.geometry.userData.tier);
  const widths = new Map();
  for (const mesh of meshes) {
    const data = mesh.geometry.userData;
    if (!['yongan', 'qingming', 'avenue-drain'].includes(data.channel)) continue;
    const p = mesh.geometry.getAttribute('position');
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < p.count; i++) { min = Math.min(min, p.getX(i)); max = Math.max(max, p.getX(i)); }
    if (Math.abs(max - min - data.width) > 0.001) return false;
    widths.set(data.channel, data.width);
  }
  return widths.get('yongan') === 6 && widths.get('qingming') === 3
    && widths.get('avenue-drain') === 0.9;
});
report.checks.westernChannelsDisclaimer = await page.evaluate(() => {
  const meshes = window.__CHANGAN__.scene.children.filter((mesh) => mesh.isInstancedMesh
    && ['yongan', 'qingming'].includes(mesh.geometry.userData.channel));
  return meshes.length === 2 && meshes.every((mesh) => mesh.geometry.userData.complete === false
    && mesh.geometry.userData.accuracy.includes('艺术示意'));
});
await page.locator('[data-ward="E3-2"]').click();
report.checks.wardInspection = await page.locator('#view-name').innerText() === '崇仁坊';
await page.evaluate(() => window.__CHANGAN__.setView('curfew', true));
report.checks.curfewNight = await page.locator('body').evaluate((body) => body.classList.contains('night'));
report.checks.nightGateClosed = await page.evaluate(() =>
  window.__CHANGAN__.scene.getObjectByName('坊门昼夜门扇').userData.closed === true);
await page.evaluate(() => window.__CHANGAN__.setHour('day'));
report.checks.dayGateOpen = await page.evaluate(() =>
  window.__CHANGAN__.scene.getObjectByName('坊门昼夜门扇').userData.closed === false);
const viewNames = process.env.VIEWS?.split(',') || ['city', 'craft', 'avenue', 'palace', 'market', 'pagoda', 'lake'];
for (const view of viewNames) {
  await page.evaluate((id) => {
    const api = window.__CHANGAN__;
    api.setHour(id === 'curfew' ? 'night' : 'day');
    api.setView(id, true);
  }, view);
  await page.waitForTimeout(400);
  await page.waitForFunction(() => window.__CHANGAN__.stats.idle);
  await page.screenshot({ animations: 'disabled', path: new URL(`${view}.png`, output).pathname });
  const shadowFrame = await page.evaluate(() => ({ ...window.__CHANGAN__.stats }));
  // 同一观察范围内微转相机，分开记录缓存阴影后的主场景成本。
  await page.evaluate(() => {
    const { camera, controls } = window.__CHANGAN__;
    const offset = camera.position.clone().sub(controls.target);
    const angle = 0.0001, x = offset.x, z = offset.z;
    offset.x = x * Math.cos(angle) + z * Math.sin(angle);
    offset.z = z * Math.cos(angle) - x * Math.sin(angle);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  });
  await page.waitForFunction((frames) => window.__CHANGAN__.stats.renderedFrames > frames
    && window.__CHANGAN__.stats.idle, shadowFrame.renderedFrames);
  report.views[view] = await page.evaluate(() => ({ ...window.__CHANGAN__.stats }));
  report.views[view].firstFrameCalls = shadowFrame.calls;
  report.views[view].firstFrameTriangles = shadowFrame.triangles;
  report.views[view].shadowReused = report.views[view].shadowUpdates === shadowFrame.shadowUpdates;
  console.log(`已检查机位：${view}`);
}
await page.evaluate(() => window.__CHANGAN__.setView('craft', true));
report.checks.nearDetails = await page.evaluate(() => window.__CHANGAN__.scene.children.some(
  (mesh) => mesh.name.endsWith(':true') && mesh.visible,
));
await page.waitForFunction(() => window.__CHANGAN__.stats.idle);
report.checks.vegetationNearPresent = await page.evaluate(() =>
  window.__CHANGAN__.stats.vegetationNear > 0);
await page.locator('[data-hour="night"]').click();
await page.waitForTimeout(800);
report.checks.night = await page.locator('body').evaluate((body) => body.classList.contains('night'));
report.checks.nightSkySwitches = await page.evaluate(() => {
  const sky = window.__CHANGAN__.scene.children.find((mesh) => mesh.material?.uniforms?.nightMode);
  return sky?.material.uniforms.nightMode.value === 1;
});
await page.screenshot({ animations: 'disabled', path: new URL('night.png', output).pathname });
await page.locator('[data-hour="day"]').click();
report.checks.day = await page.locator('[data-hour="day"]').getAttribute('aria-pressed') === 'true';
await page.locator('#toggle-labels').click();
report.checks.labels = await page.locator('#toggle-labels').getAttribute('aria-pressed') === 'false';
await page.locator('#toggle-labels').click();
await page.locator('#tour').click();
report.checks.tour = await page.locator('#tour').getAttribute('aria-pressed') === 'true';
await page.keyboard.press('Escape');
report.checks.tourStop = await page.locator('#tour').getAttribute('aria-pressed') === 'false';
await page.locator('#help-button').click();
report.checks.help = await page.locator('#help').evaluate((dialog) => dialog.open);
await page.locator('#close-help').click();
await page.keyboard.press('h');
report.checks.hide = await page.locator('body').evaluate((body) => body.classList.contains('ui-hidden'));
await page.locator('#restore-ui').click();
report.checks.restore = await page.locator('body').evaluate((body) => !body.classList.contains('ui-hidden'));
await page.locator('#quality').selectOption('low');
await page.waitForTimeout(1200);
report.checks.low = await page.evaluate(() => window.__CHANGAN__.stats.quality === 'low');
const uiBeforeScale = await page.locator('#view-nav').evaluate((node) => ({
  width: node.getBoundingClientRect().width, font: getComputedStyle(node).fontSize,
}));
await page.waitForFunction(() => window.__CHANGAN__.stats.idle);
const foliageBeforeScale = await page.evaluate(() => {
  const s = window.__CHANGAN__.stats;
  return [s.vegetationNear, s.vegetationMiddle, s.vegetationFar, s.vegetationUploads];
});
for (const [value, scale] of [['.7', 0.7], ['.85', 0.85]]) {
  const frames = await page.evaluate(() => window.__CHANGAN__.stats.renderedFrames);
  await page.locator('#render-scale').selectOption(value);
  await page.waitForFunction(({ expected, before }) => {
    const s = window.__CHANGAN__.stats;
    return s.renderScale === expected && s.renderedFrames > before && s.idle;
  }, { expected: scale, before: frames });
  report.checks[`resolution${scale * 100}`] = await page.evaluate((expected) => {
    const api = window.__CHANGAN__, gl = api.renderer.getContext();
    const ratio = Math.min(devicePixelRatio, 1) * expected;
    return gl.drawingBufferWidth === Math.floor(innerWidth * ratio)
      && gl.drawingBufferHeight === Math.floor(innerHeight * ratio)
      && api.stats.bufferWidth === gl.drawingBufferWidth
      && document.querySelector('#world').getBoundingClientRect().width === innerWidth;
  }, scale);
}
const foliageAfterScale = await page.evaluate(() => {
  const s = window.__CHANGAN__.stats;
  return [s.vegetationNear, s.vegetationMiddle, s.vegetationFar, s.vegetationUploads];
});
report.checks.scaleKeepsVegetation = JSON.stringify(foliageBeforeScale)
  === JSON.stringify(foliageAfterScale);
await page.locator('#quality').selectOption('medium');
report.checks.scaleSurvivesQuality = await page.evaluate(() =>
  window.__CHANGAN__.stats.renderScale === 0.85);
const uiAfterScale = await page.locator('#view-nav').evaluate((node) => ({
  width: node.getBoundingClientRect().width, font: getComputedStyle(node).fontSize,
}));
report.checks.nativeInterfaceScale = JSON.stringify(uiBeforeScale) === JSON.stringify(uiAfterScale);
await page.screenshot({ animations: 'disabled', path: new URL('scaled-ui.png', output).pathname });
await page.locator('#quality').selectOption('high');
await page.locator('#render-scale').selectOption('.7');
await page.waitForFunction(() => window.__CHANGAN__.stats.idle);
report.checks.highResolution70 = await page.evaluate(() => {
  const api = window.__CHANGAN__, gl = api.renderer.getContext();
  return api.stats.quality === 'high' && api.stats.renderScale === 0.7
    && gl.drawingBufferWidth === Math.floor(innerWidth * Math.min(devicePixelRatio, 1.75) * 0.7);
});
await page.screenshot({ animations: 'disabled', path: new URL('high-70.png', output).pathname });
await page.locator('#render-scale').selectOption('1');
await page.locator('#quality').selectOption('low');
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => window.__CHANGAN__.setView('city', true));
await page.waitForTimeout(1000);
await page.screenshot({ animations: 'disabled', path: new URL('mobile.png', output).pathname });
report.checks.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
await writeFile(new URL('browser-report.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (errors.length || Object.values(report.checks).some((pass) => !pass)) process.exitCode = 1;

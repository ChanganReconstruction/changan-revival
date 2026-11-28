import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// 只读加载原版离线产物，对照图写入新项目，不改动旧项目。
const out = new URL('../artifacts/rebuild/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(180000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto('file:///root/work/agent/changan/changan-voxel-city/index.html'
    + '?q=low&view=hanyuanTop&t=noon');
  await page.waitForFunction(() => window.__CHANGAN_READY__);
  await page.addStyleTag({ content: `
    body * { visibility: hidden !important; }
    #scene, #scene * { visibility: visible !important; }
  ` });
  await page.evaluate(() => {
    const { Engine } = window.__CHANGAN__;
    Engine.autoQuality.enabled = false;
    Engine.camera.fov = 40;
    Engine.camera.far = 5000;
    Engine.camera.position.set(630, 525, 798);
    Engine.controls.target.set(0, 0, -50);
    Engine.camera.updateProjectionMatrix();
    Engine.controls.update();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: new URL('voxel-city.png', out).pathname });
  await page.evaluate(() => {
    const { Engine } = window.__CHANGAN__;
    Engine.camera.position.set(0, 1260, -30);
    Engine.controls.target.set(0, 0, -31);
    Engine.controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: new URL('voxel-plan.png', out).pathname });
  await writeFile(new URL('voxel-errors.json', out), JSON.stringify(errors, null, 2));
  console.log('原版只读鸟瞰截图完成', errors);
} finally { await browser.close(); }

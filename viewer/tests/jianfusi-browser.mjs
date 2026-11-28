import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = new URL(process.env.BASE_URL || 'http://127.0.0.1:5174');
url.search = '?q=low';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__CHANGAN__?.ready);
  await page.locator('#loading').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => window.__CHANGAN__.stats.view), 'city');
  const dialog = page.locator('#jianfusi-demo');
  const selection = page.locator('#jianfusi-selection');
  const point = await page.evaluate(() => {
    const { camera, controls, renderer } = window.__CHANGAN__;
    const point = controls.target.clone().set(80, 23, -4).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  });
  const cityPosition = await page.evaluate(() => window.__CHANGAN__.camera.position.toArray());
  await page.mouse.click(point.x, point.y);
  await selection.waitFor();
  const card = await selection.locator('.jianfusi-card').boundingBox();
  assert.ok(card && (card.x > point.x || card.x + card.width < point.x), '桌面卡片应避开塔身点击点');
  assert.equal(await dialog.evaluate((node) => node.open), false, '点塔身不能直接进入');
  assert.equal(await dialog.locator('video, iframe').count(), 0, '确认前不加载视频和庭院');
  assert.deepEqual(await page.evaluate(() => window.__CHANGAN__.camera.position.toArray()), cityPosition);
  await page.locator('#jianfusi-cancel').click();
  await selection.waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: '小雁塔', exact: true }).click();
  await selection.waitFor();
  assert.equal(await dialog.evaluate((node) => node.open), false, '点小雁塔名称不能直接进入');
  assert.equal(await dialog.locator('video, iframe').count(), 0, '点名称也须确认后才加载');
  const started = performance.now();
  await page.locator('#jianfusi-enter').click();
  await dialog.waitFor();
  await page.waitForFunction(() => document.querySelector('#jianfusi-demo video')?.currentTime > 0);
  console.log('点击小雁塔塔身或名称均仅选中，确认后播放引入短片');
  await page.waitForFunction(() => ['waiting', 'reveal', 'courtyard', 'error'].includes(
    document.querySelector('#jianfusi-demo').dataset.phase,
  ), undefined, { timeout: 240_000 });
  const waiting = await dialog.evaluate((node) => node.dataset.phase === 'waiting'
    ? { ended: node.querySelector('video')?.ended } : null);
  if (waiting) assert.equal(waiting.ended, true, '等待期间应保留已播完的视频');
  await page.waitForFunction(() => ['courtyard', 'error'].includes(
    document.querySelector('#jianfusi-demo').dataset.phase,
  ), undefined, { timeout: 240_000 });
  assert.equal(await dialog.getAttribute('data-phase'), 'courtyard', await dialog.getByRole('status').textContent());
  const frame = page.frameLocator('.jianfusi-stage iframe');
  await frame.locator('body[data-state=walking]').waitFor();
  assert.equal(await frame.locator('body').getAttribute('data-splat-count'), '5013038');
  console.log(`庭院首帧已交接，包含全部 5013038 个高斯；点击至进入约 ${Math.round(performance.now() - started)} ms`);

  await dialog.locator('[data-return]').click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await dialog.locator('iframe').count(), 0, '返回时应卸载庭院 iframe');
  assert.deepEqual(await page.evaluate(() => window.__CHANGAN__.camera.position.toArray()), cityPosition);
  console.log('已返回长安并卸载庭院');
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 28, point.y, { steps: 4 });
  await page.mouse.up();
  assert.equal(await selection.isVisible(), false, '拖动塔身不能选中');
  assert.equal(await dialog.evaluate((node) => node.open), false, '拖动塔身不能触发进入');
} finally {
  await browser.close();
}

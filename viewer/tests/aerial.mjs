import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = new URL(process.env.OUTPUT || '../artifacts/rebuild/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(120000);
const errors = [], report = { views: {}, errors };
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
try {
  const offline = process.env.AERIAL_DIST === '1';
  const url = new URL(offline ? 'http://viewer.test/' : process.env.BASE_URL || 'http://127.0.0.1:5174');
  if (offline) {
    const dist = fileURLToPath(new URL('../dist', import.meta.url));
    await page.route(`${url.origin}/**`, async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const path = resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!path.startsWith(`${dist}${sep}`)) return route.abort();
      await route.fulfill({ path });
    });
  }
  const labels = process.env.LABELS === '1';
  for (const [key, value] of Object.entries({ ui: labels ? '1' : '0', labels: labels ? '1' : '0', q: 'medium',
    hour: process.env.HOUR || 'day' })) url.searchParams.set(key, value);
  await page.goto(url.href);
  await page.waitForFunction(() => window.__CHANGAN__?.ready && window.__CHANGAN__.stats.idle);
  await page.addStyleTag({ content: '#restore-ui { display: none !important; }' });
  if (labels) await page.addStyleTag({ content: '#interface > :not(#labels) { visibility: hidden !important; }' });
  for (const view of (process.env.VIEWS || 'city,plan,palace,taiye,lake').split(',')) {
    const before = await page.evaluate(() => window.__CHANGAN__.stats.renderedFrames);
    await page.evaluate((id) => {
      const api = window.__CHANGAN__;
      api.controls.minPolarAngle = id === 'plan' ? 0.001 : 0.1;
      const details = {
        hanyuanDetail: [[650, 88, -776], [520, 25, -931]],
        lindeDetail: [[495, 83, -951], [402, 21, -1046]],
        danfengDetail: [[635, 60, -696], [520, 14, -820]],
        danfengStreet: [[528, 6, -731], [520, 6, -820]],
         northernOverview: [[140, 1020, -20], [0, 0, -695]],
         northwest: [[-750, 420, -244], [-536, 0, -628]],
         northeast: [[690, 480, -267], [555, 0, -655]],
         taiji: [[210, 212, -366], [0, 6, -680]],
         taijiHall: [[91, 49, -546], [0, 17, -649]],
         taijiComplex: [[117, 145, -868], [-11, 9, -714]],
         eastPalace: [[248, 88, -550], [178, 12, -658]],
         taijiGarden: [[-18, 56, -683], [-72, 2, -745]],
         damingGarden: [[374, 115, -1137], [535, 13, -1180]],
         imperial: [[153, 190, -202], [0, 4, -410]],
         imperialContext: [[-275, 315, -115], [-20, 4, -344]],
         imperialCourt: [[101, 39, -309], [142, 5, -355]],
         xingqing: [[960, 175, -24], [750, 0, -183]],
         xingqingGarden: [[820, 67, -86], [747, 3, -161]],
        huaeDetail: [[798, 54, -32], [725, 16, -104]],
        huaeShore: [[674, 26, -166], [730, 14, -100]],
        inletOverview: [[940, 230, 970], [725, 0, 733]],
        inletDetail: [[810, 55, 774], [725, 1, 693]],
        inletCulvert: [[716, 2.1, 737], [716, 1.7, 710]],
        longshouOverview: [[1030, 180, -90], [810, 1, -265]],
        longshouBridge: [[785, 18, -150], [819, 1, -193.5]],
        longshouCulvert: [[890, 4, -318], [839, 1.4, -318]],
        westernOverview: [[-770, 380, 540], [-350, 0, 220]],
        westernBridge: [[-383, 14, 183], [-408, 1, 155]],
        drainDetail: [[35, 10, 350], [17.5, 0.2, 320]],
        sunsetStudy: [[1200, 45, -180], [0, 10, 580]],
      };
      if (details[id]) {
        api.camera.position.set(...details[id][0]);
        api.controls.target.set(...details[id][1]);
        api.controls.update();
      } else if (id === 'plan') {
        api.camera.position.set(0, 3050, -200);
        api.controls.target.set(0, 0, -201);
        api.controls.update();
      } else api.setView(id, true);
    }, view);
    await page.waitForFunction((frames) => window.__CHANGAN__.stats.idle
      && window.__CHANGAN__.stats.renderedFrames > frames, before);
    await page.screenshot({ path: new URL(`${view}.png`, output).pathname,
      animations: 'disabled' });
    report.views[view] = await page.evaluate(() => ({ ...window.__CHANGAN__.stats }));
    console.log('无界面鸟瞰完成：', view);
  }
  await writeFile(new URL('aerial-report.json', output), JSON.stringify(report, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }

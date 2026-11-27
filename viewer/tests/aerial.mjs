import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

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
  const url = new URL(process.env.BASE_URL || 'http://127.0.0.1:5174');
  for (const [key, value] of Object.entries({ ui: '0', labels: '0', q: 'medium',
    hour: process.env.HOUR || 'day' })) url.searchParams.set(key, value);
  await page.goto(url.href);
  await page.waitForFunction(() => window.__CHANGAN__?.ready && window.__CHANGAN__.stats.idle);
  await page.addStyleTag({ content: '#restore-ui { display: none !important; }' });
  for (const view of (process.env.VIEWS || 'city,plan,palace,taiye,lake').split(',')) {
    const before = await page.evaluate(() => window.__CHANGAN__.stats.renderedFrames);
    await page.evaluate((id) => {
      const api = window.__CHANGAN__;
      api.controls.minPolarAngle = id === 'plan' ? 0.001 : 0.1;
      const details = {
        hanyuanDetail: [[650, 88, -700], [520, 25, -855]],
        lindeDetail: [[495, 83, -875], [402, 21, -970]],
        danfengDetail: [[635, 60, -620], [520, 14, -744]],
        danfengStreet: [[528, 6, -655], [520, 6, -744]],
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

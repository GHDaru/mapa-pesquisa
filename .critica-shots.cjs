const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const OUT = '/home/user/mapa-pesquisa/docs/screenshots/critica';
const BASE = 'http://localhost:4173';

const viewports = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '400x800', width: 400, height: 800 },
];
const themes = ['dark', 'light'];

const consoleErrors = {};
const hScroll = {};

async function shootRoute(browser, routeKey, hash, vp, theme, action) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errs.push(msg.text());
  });
  page.on('pageerror', (err) => errs.push('pageerror: ' + err.message));

  await page.goto(BASE + '/' + hash, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  if (action) await action(page);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const key = `${routeKey}__${vp.name}__${theme}`;
  hScroll[key] = { scrollWidth, viewport: vp.width, overflow: scrollWidth > vp.width };
  consoleErrors[key] = errs;

  const fname = `${routeKey}__${vp.name}__${theme}.png`;
  await page.screenshot({ path: path.join(OUT, fname), fullPage: true });
  console.log('saved', fname, 'scrollWidth=', scrollWidth, 'errs=', errs.length);

  await ctx.close();
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });

  const routes = [
    { key: 'mapa', hash: '#/mapa', action: null },
    {
      key: 'mapa-sp-aberto',
      hash: '#/mapa',
      action: async (page) => {
        const sp = page.locator('path[data-uf="SP"]');
        await sp.click();
        await page.waitForTimeout(400);
      },
    },
    {
      key: 'mapa-hover-mg',
      hash: '#/mapa',
      action: async (page) => {
        const mg = page.locator('path[data-uf="MG"]');
        await mg.hover();
        await page.waitForTimeout(300);
      },
    },
    { key: 'presidente', hash: '#/presidente', action: null },
    { key: 'senado', hash: '#/senado', action: null },
    {
      key: 'senado-composicao-atual',
      hash: '#/senado',
      action: async (page) => {
        const btn = page.getByRole('button', { name: /Composição atual/i });
        await btn.click();
        await page.waitForTimeout(300);
      },
    },
    { key: 'partidos', hash: '#/partidos', action: null },
  ];

  for (const route of routes) {
    for (const vp of viewports) {
      for (const theme of themes) {
        try {
          await shootRoute(browser, route.key, route.hash, vp, theme, route.action);
        } catch (e) {
          console.error('FAILED', route.key, vp.name, theme, e.message);
        }
      }
    }
  }

  await browser.close();

  fs.writeFileSync(
    path.join(OUT, '_console-errors.json'),
    JSON.stringify(consoleErrors, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT, '_hscroll.json'),
    JSON.stringify(hScroll, null, 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

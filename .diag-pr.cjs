const { chromium } = require('playwright-core');
async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:4173/#/mapa', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => {
    const path = document.querySelector('path[data-uf="PR"]');
    return {
      fill: path.style.fill,
      opacity: path.style.opacity,
      ariaLabel: path.getAttribute('aria-label'),
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
main();

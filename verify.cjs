const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('http://127.0.0.1:8787', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  const btns = await page.$$eval('.side-bottom-btn', els => els.map(e => e.textContent.trim()));
  console.log('Sidebar buttons:', JSON.stringify(btns));

  await page.click('#openProvider');
  await page.waitForTimeout(500);
  const title1 = await page.textContent('#settingsTitle');
  console.log('Provider page:', title1);
  
  const hasSelf = await page.$('[data-provider-section="self"]');
  const hasShare = await page.$('[data-provider-section="share"]');
  console.log('Self:', !!hasSelf, 'Share:', !!hasShare);

  await page.click('#settingsCloseBtn');
  await page.waitForTimeout(300);
  
  await page.click('#openShare');
  await page.waitForTimeout(500);
  const title2 = await page.textContent('#settingsTitle');
  console.log('Share page:', title2);

  await page.screenshot({ path: '/tmp/verify_share.png' });
  await browser.close();
  console.log('DONE');
})();

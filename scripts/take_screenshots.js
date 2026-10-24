const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function capture() {
  const screenshotsDir = path.resolve(__dirname, '../docs/screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  // Test User credentials & profile
  const testUserId = process.env.SCREENSHOT_USER_ID || 'test_user_id';
  const testUser = {
    id: testUserId,
    username: 'tester',
    display_name: 'Tester',
    is_admin: false,
    role: 'user'
  };

  // Pre-seed localStorage before navigating
  await page.addInitScript(({ id, user }) => {
    window.localStorage.setItem('audiohub_user_id', id);
    window.localStorage.setItem('audiohub_user', JSON.stringify(user));
    window.localStorage.setItem('audiohub_volume', '0.7');
    window.localStorage.setItem('audiohub_visualizer_theme', 'turntable');
  }, { id: testUserId, user: testUser });

  console.log('Navigating to http://localhost:3000/#/home...');
  await page.goto('http://localhost:3000/#/home', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // 1. Dashboard
  console.log('Capturing 01_dashboard.png...');
  await page.screenshot({
    path: path.join(screenshotsDir, '01_dashboard.png'),
    fullPage: false
  });

  // 2. Play a track and open 3D Vinyl Turntable
  console.log('Playing track for visualizer...');
  // Click first play button on dashboard (quick access or trending)
  const playBtn = page.locator('button:has(svg.lucide-play)').first();
  if (await playBtn.isVisible()) {
    await playBtn.click();
    await page.waitForTimeout(2000);
  }

  // Open Visualizer modal
  console.log('Opening Visualizer modal...');
  // Press visualizer button on player bar
  const visualizerBtn = page.locator('button[title*="Visualizer"], button:has(svg.lucide-sparkles), button:has(svg.lucide-disc)').first();
  if (await visualizerBtn.isVisible()) {
    await visualizerBtn.click();
  } else {
    // Or dispatch custom event
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('audiohub:open-visualizer')));
  }
  await page.waitForTimeout(3500);

  console.log('Capturing 02_turntable.png...');
  await page.screenshot({
    path: path.join(screenshotsDir, '02_turntable.png'),
    fullPage: false
  });

  // Close visualizer
  const closeBtn = page.locator('button:has(svg.lucide-x)').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(1000);
  }

  // 3. Cover Flow Crate Digger
  console.log('Navigating to Cover Flow / Albums...');
  await page.goto('http://localhost:3000/#/albums', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Look for Cover Flow toggle button
  const coverflowBtn = page.locator('button:has-text("Cover Flow"), button[title*="Cover Flow"]').first();
  if (await coverflowBtn.isVisible()) {
    await coverflowBtn.click();
    await page.waitForTimeout(2000);
  }

  console.log('Capturing 03_coverflow.png...');
  await page.screenshot({
    path: path.join(screenshotsDir, '03_coverflow.png'),
    fullPage: false
  });

  // 4. Now Playing / Queue Drawer
  console.log('Capturing Queue Drawer (04_now_playing.png)...');
  await page.goto('http://localhost:3000/#/home', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Open queue button
  const queueBtn = page.locator('button[title*="Queue"], button:has(svg.lucide-list-music)').first();
  if (await queueBtn.isVisible()) {
    await queueBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({
    path: path.join(screenshotsDir, '04_now_playing.png'),
    fullPage: false
  });

  // 5. Setup Wizard
  console.log('Navigating to Setup Wizard (05_setup_wizard.png)...');
  const wizardContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const wizardPage = await wizardContext.newPage();

  // Intercept /api/v1/setup/status to simulate fresh install
  await wizardPage.route('**/api/v1/setup/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        is_configured: false,
        setup_required: true,
        app_name: 'AudioHub'
      })
    });
  });

  await wizardPage.goto('http://localhost:3000/#/setup', { waitUntil: 'networkidle' });
  await wizardPage.waitForTimeout(2000);

  await wizardPage.screenshot({
    path: path.join(screenshotsDir, '05_setup_wizard.png'),
    fullPage: false
  });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});

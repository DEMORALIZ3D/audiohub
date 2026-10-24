const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));
const fs = require('fs');

const RES_DIR = path.resolve(__dirname, '../frontend/android/app/src/main/res');
const ICON_SVG_PATH = path.resolve(__dirname, '../frontend/public/icon.svg');
const MARK_SVG_PATH = path.resolve(__dirname, '../frontend/public/azify-mark.svg');

const iconSvg = fs.readFileSync(ICON_SVG_PATH, 'utf-8');
const markSvg = fs.readFileSync(MARK_SVG_PATH, 'utf-8');

const MIPMAP_SIZES = [
  { dir: 'mipmap-mdpi', launcherSize: 48, fgSize: 108 },
  { dir: 'mipmap-hdpi', launcherSize: 72, fgSize: 162 },
  { dir: 'mipmap-xhdpi', launcherSize: 96, fgSize: 216 },
  { dir: 'mipmap-xxhdpi', launcherSize: 144, fgSize: 324 },
  { dir: 'mipmap-xxxhdpi', launcherSize: 192, fgSize: 432 },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('1. Generating legacy launcher and round icons...');
  for (const { dir, launcherSize } of MIPMAP_SIZES) {
    const targetDir = path.join(RES_DIR, dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // Full icon
    await page.setViewportSize({ width: launcherSize, height: launcherSize });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:0;background:transparent;overflow:hidden;">
          <div style="width:${launcherSize}px;height:${launcherSize}px;">
            ${iconSvg}
          </div>
        </body>
      </html>
    `);
    const fullBuffer = await page.screenshot({ omitBackground: true });
    fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), fullBuffer);

    // Round icon (clipped into circle)
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:0;background:transparent;overflow:hidden;">
          <div style="width:${launcherSize}px;height:${launcherSize}px;border-radius:50%;overflow:hidden;">
            ${iconSvg}
          </div>
        </body>
      </html>
    `);
    const roundBuffer = await page.screenshot({ omitBackground: true });
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), roundBuffer);
  }

  console.log('2. Generating adaptive foreground icons...');
  for (const { dir, fgSize } of MIPMAP_SIZES) {
    const targetDir = path.join(RES_DIR, dir);
    // Safe zone is 66% of canvas
    const logoSize = Math.round(fgSize * 0.62);

    await page.setViewportSize({ width: fgSize, height: fgSize });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:0;background:transparent;overflow:hidden;display:flex;align-items:center;justify-content:center;width:${fgSize}px;height:${fgSize}px;">
          <div style="width:${logoSize}px;height:${logoSize}px;display:flex;align-items:center;justify-content:center;">
            ${iconSvg.replace(/<rect[^>]*rx="120"[^>]*\/>/, '')}
          </div>
        </body>
      </html>
    `);
    const fgBuffer = await page.screenshot({ omitBackground: true });
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), fgBuffer);
  }

  console.log('3. Generating Android TV Banner (320x180)...');
  const drawableDir = path.join(RES_DIR, 'drawable');
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });

  await page.setViewportSize({ width: 320, height: 180 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #0c0c0e 0%, #15151a 100%);
            width: 320px;
            height: 180px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #ffffff;
            box-sizing: border-box;
          }
          .container {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .logo {
            width: 80px;
            height: 80px;
          }
          .text {
            display: flex;
            flex-direction: column;
          }
          .title {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #ffffff;
          }
          .sub {
            font-size: 11px;
            color: #1ed760;
            font-weight: 600;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            ${iconSvg}
          </div>
          <div class="text">
            <span class="title">Audiohub</span>
            <span class="sub">homelab entertainment</span>
          </div>
        </div>
      </body>
    </html>
  `);
  const bannerBuffer = await page.screenshot();
  fs.writeFileSync(path.join(drawableDir, 'banner.png'), bannerBuffer);

  console.log('4. Generating splash screens...');
  await page.setViewportSize({ width: 480, height: 800 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#0c0c0e;display:flex;flex-direction:column;align-items:center;justify-content:center;width:480px;height:800px;font-family:-apple-system,BlinkMacSystemFont,Roboto,sans-serif;">
        <div style="width:160px;height:160px;margin-bottom:24px;">
          ${iconSvg}
        </div>
        <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 6px 0;">Audiohub</h1>
        <p style="color:#1ed760;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0;">homelab entertainment</p>
      </body>
    </html>
  `);
  const splashBuffer = await page.screenshot();
  fs.writeFileSync(path.join(drawableDir, 'splash.png'), splashBuffer);

  await browser.close();
  console.log('All Android icons and banners generated successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

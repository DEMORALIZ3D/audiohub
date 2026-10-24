import { test, expect } from '@playwright/test';

interface MockDbState {
  isConfigured: boolean;
  setupRequired: boolean;
  appName: string;
  tagline: string;
  accentColor: string;
  logoUrl: string;
  users: Record<string, any>;
  activeUserId: string | null;
  streamRequests: string[];
}

const state: MockDbState = {
  isConfigured: false,
  setupRequired: true,
  appName: 'AudioHub',
  tagline: 'Homelab Hi-Fi Streaming & Infinite Catalog',
  accentColor: '#1ed760',
  logoUrl: '/icon.svg?v=2',
  users: {},
  activeUserId: null,
  streamRequests: [],
};

test.describe.serial('OOBE -> Account Setup -> Login -> Playback E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept backend API requests to provide a self-contained, isolated database environment
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const pathname = url.pathname;
      const method = request.method();

      if (pathname.endsWith('/setup/status')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            is_configured: state.isConfigured,
            setup_required: state.setupRequired,
            app_name: state.appName,
          }),
        });
      }

      if ((pathname.endsWith('/setup') || pathname.endsWith('/setup/')) && method === 'POST') {
        const body = request.postDataJSON() || {};
        state.appName = body.app_name || 'MyHomeBeats';
        state.tagline = body.tagline || state.tagline;
        state.accentColor = body.accent_color || state.accentColor;
        state.isConfigured = true;
        state.setupRequired = false;

        const user = {
          id: 'admin_e2e_id_101',
          username: body.username,
          display_name: body.display_name || body.username,
          email: body.email,
          role: 'super_admin',
          is_admin: true,
          is_under_13: false,
          is_active: true,
          password: body.password,
        };
        state.users[body.username] = user;
        state.activeUserId = user.id;

        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'completed',
            user: { ...user, password: '' },
            token: user.id,
          }),
        });
      }

      if (pathname.includes('/settings/branding') || pathname.endsWith('/branding')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            appName: state.appName,
            appShortName: state.appName,
            tagline: state.tagline,
            logoUrl: state.logoUrl,
            themeColor: state.accentColor,
            accentColor: state.accentColor,
            poweredBy: state.appName,
          }),
        });
      }

      if (pathname.endsWith('/auth/me')) {
        const xUserId = request.headers()['x-user-id'] || state.activeUserId;
        const user = Object.values(state.users).find((u: any) => u.id === xUserId);
        if (user) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...user, password: '' }),
          });
        }
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Unauthorized' }),
        });
      }

      if (pathname.endsWith('/auth/login') && method === 'POST') {
        const body = request.postDataJSON() || {};
        const user = state.users[body.username];
        if (user && user.password === body.password) {
          state.activeUserId = user.id;
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...user, password: '' }),
          });
        }
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Invalid username or password' }),
        });
      }

      if (pathname.endsWith('/auth/profiles')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            Object.values(state.users).map((u: any) => ({ ...u, password: '' }))
          ),
        });
      }

      if (pathname.includes('/discovery/home')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            quick_access: [],
            daily_mixes: [],
            featured_charts: [],
            genre_playlists: [],
            trending: [
              {
                id: 'track-e2e-audiophile-1',
                title: 'Solar Echoes',
                artist: 'Cosmic Pulse',
                album: 'Stellar Horizons',
                duration: 215,
                cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
              },
            ],
          }),
        });
      }

      if (
        pathname.includes('/stream/') &&
        !pathname.endsWith('/prefetch') &&
        !pathname.endsWith('/info')
      ) {
        state.streamRequests.push(request.url());
        return route.fulfill({
          status: 200,
          contentType: 'audio/mpeg',
          body: Buffer.from([0xff, 0xfb, 0x90, 0x64]),
        });
      }

      if (pathname.endsWith('/version')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ version: '1.0.0' }),
        });
      }

      if (pathname.includes('/playlists')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }

      if (pathname.includes('/tracks/liked')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });
  });

  test('Test 1: OOBE / First-Run Setup Wizard renames server, picks accent color, and creates admin', async ({
    page,
  }) => {
    // Clear any previous session
    await page.addInitScript(() => {
      localStorage.clear();
    });

    await page.goto('/#/');

    // Verify redirection to Setup Wizard
    const setupTitle = page.locator('text=Brand Your Server');
    await expect(setupTitle).toBeVisible({ timeout: 10000 });

    // Step 1: Rename the server
    const appNameInput = page.locator('input[data-testid="setup-app-name"]');
    await expect(appNameInput).toBeVisible();
    await appNameInput.fill('MyHomeBeats');

    // Choose Emerald accent color
    const emeraldColorBtn = page.locator('button[title="Emerald"]');
    if (await emeraldColorBtn.isVisible()) {
      await emeraldColorBtn.click();
    }

    // Continue to Step 2
    const continueBtn = page.locator('button[data-testid="setup-continue-step1"]');
    await continueBtn.click();

    // Step 2: Create initial admin account
    const adminHeading = page.locator('text=Create Super Admin');
    await expect(adminHeading).toBeVisible({ timeout: 5000 });

    await page.locator('input[data-testid="setup-username"]').fill('admin');
    await page.locator('input[data-testid="setup-password"]').fill('AdminPass123!');
    await page.locator('input[data-testid="setup-confirm-password"]').fill('AdminPass123!');

    // Submit setup
    const submitBtn = page.locator('button[data-testid="setup-submit-btn"]');
    await submitBtn.click();

    // Step 3: Confirmation and Launch
    const launchBtn = page.locator('button[data-testid="setup-launch-app-btn"]');
    await expect(launchBtn).toBeVisible({ timeout: 10000 });
    await launchBtn.click();

    // Verify landing on Dashboard
    const homeNav = page.locator('button:has-text("Home")').first();
    await expect(homeNav).toBeVisible({ timeout: 10000 });
  });

  test('Test 2: Account Login & Session Persistence displays custom server name and restores session', async ({
    page,
  }) => {
    // Ensure state reflects completed setup
    state.isConfigured = true;
    state.setupRequired = false;

    await page.goto('/#/');
    await page.waitForTimeout(500);

    // Simulate Logout
    await page.evaluate(() => {
      localStorage.removeItem('audiohub_user_id');
      window.location.hash = '#/home';
      window.location.reload();
    });

    // Verify LoginView displays the custom server name 'MyHomeBeats'
    const brandHeading = page.locator('h1, h2, span').filter({ hasText: 'MyHomeBeats' }).first();
    await expect(brandHeading).toBeVisible({ timeout: 10000 });

    // Switch to Password tab if QR tab is active
    const passwordTab = page.locator('button:has-text("Password")').first();
    if (await passwordTab.isVisible()) {
      await passwordTab.click();
    }

    // Log in with created credentials
    await page
      .locator('input[placeholder*="admin@example.com"], input[type="text"]')
      .first()
      .fill('admin');
    await page.locator('input[type="password"]').first().fill('AdminPass123!');
    await page.click('button:has-text("Sign In")');

    // Verify session restoration on Dashboard
    const homeNav = page.locator('button:has-text("Home")').first();
    await expect(homeNav).toBeVisible({ timeout: 10000 });

    // Check stored user ID
    const storedUserId = await page.evaluate(() => localStorage.getItem('audiohub_user_id'));
    expect(storedUserId).toBe('admin_e2e_id_101');
  });

  test('Test 3: Playback, Now Playing Bar & 3D Turntable Visualizer', async ({ page }) => {
    // Set authenticated session before navigating
    await page.addInitScript(() => {
      localStorage.setItem('audiohub_user_id', 'admin_e2e_id_101');
    });

    state.streamRequests = [];
    await page.goto('/#/');
    await page.waitForTimeout(500);

    // Verify Trending track 'Solar Echoes' is displayed
    const trackCard = page.locator('text=Solar Echoes').first();
    await expect(trackCard).toBeVisible({ timeout: 10000 });

    // Click play on track
    await trackCard.click();

    // Verify stream URL request included ?user_id=admin_e2e_id_101
    await expect.poll(() => state.streamRequests.length, { timeout: 10000 }).toBeGreaterThan(0);
    const lastStreamUrl = state.streamRequests[state.streamRequests.length - 1];
    expect(lastStreamUrl).toContain('user_id=admin_e2e_id_101');

    // Verify bottom PlayerBar displays matching track title and artist
    const playerBar = page.locator('[data-testid="player-bar"]');
    await expect(playerBar).toBeVisible({ timeout: 10000 });
    await expect(playerBar.locator('text=Solar Echoes').first()).toBeVisible();

    // Click album art in PlayerBar to open 3D Turntable Visualizer modal
    const visualizerTrigger = playerBar
      .locator(
        '[data-testid="now-playing-art"], div[title*="Visualizer"], div[title*="Stage"], div[title*="Spinning Vinyl"]'
      )
      .first();
    await visualizerTrigger.click();

    // Verify 3D Turntable Visualizer modal opens
    const visualizerModal = page
      .locator('text=/3D Turntable|Visualizer Stage|Turntable Scene|3D Audiophile/i')
      .first();
    await expect(visualizerModal).toBeVisible({ timeout: 10000 });

    // Close the visualizer modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Open Queue drawer from PlayerBar
    const queueBtn = page.locator('button[title="Queue"]').first();
    await queueBtn.click();

    // Verify Queue drawer opens and displays Play Queue header
    const queueHeader = page.locator('h3:has-text("Play Queue")');
    await expect(queueHeader).toBeVisible({ timeout: 5000 });
  });
});

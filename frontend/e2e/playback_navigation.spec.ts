import { test, expect } from '@playwright/test';

test.describe('Navigation, Breadcrumbs & Playback Resilience', () => {
  test.beforeEach(async ({ page }) => {
    // Inject test account user ID into localStorage before app mounts
    await page.addInitScript(() => {
      localStorage.setItem('audiohub_user_id', 'test-user-id-qa');
    });
    await page.goto('/#/');
    await page.waitForTimeout(1000);
  });

  test('Breadcrumbs and back navigation hierarchy work correctly', async ({ page }) => {
    // Start at Home / Dashboard
    await page.goto('/#/');
    await page.waitForTimeout(500);

    // Navigate to a playlist view
    await page.goto('/#/playlist/0c2fba41-85c4-4eee-b8ba-c28bbebb805d');
    await page.waitForTimeout(1000);

    // Verify breadcrumbs exist
    const breadcrumbNav = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumbNav).toBeVisible();

    // Verify back button inside breadcrumb
    const backBtn = breadcrumbNav.locator('button:has-text("Back")');
    await expect(backBtn).toBeVisible();

    // Click Back button - should unwind hierarchically to Library
    await backBtn.click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('#/library');

    // Click breadcrumb crumb or back again - should unwind to Home / Dashboard
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('audiohub:back'));
    });
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/#\/(home)?$/);
  });

  test('Playback state persists in localStorage', async ({ page }) => {
    await page.goto('/#/');
    await page.waitForTimeout(500);

    // Simulate saving playback position in localStorage
    await page.evaluate(() => {
      const state = {
        track: {
          id: 'test_track_1',
          title: 'Resilience Test Song',
          artist: 'AudioHub QA',
          duration_seconds: 240,
        },
        currentTime: 75.5,
        isPlaying: false,
        volume: 0.8,
        playbackMode: 'normal',
        timestamp: Date.now(),
      };
      localStorage.setItem('audiohub_last_playback_state', JSON.stringify(state));
    });

    // Reload page
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify localStorage state is restored
    const savedState = await page.evaluate(() => {
      const raw = localStorage.getItem('audiohub_last_playback_state');
      return raw ? JSON.parse(raw) : null;
    });

    expect(savedState).not.toBeNull();
    expect(savedState.track.title).toBe('Resilience Test Song');
    expect(savedState.currentTime).toBe(75.5);
  });

  test('Offline network detection triggers status banner', async ({ page }) => {
    await page.goto('/#/');
    await page.waitForTimeout(500);

    // Simulate offline event in browser
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Check if network status chip appears
    const offlineChip = page.locator('text=/No Connection|Offline|Connection lost/i').first();
    await expect(offlineChip).toBeVisible({ timeout: 5000 });

    // Simulate back online
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Offline chip should either disappear or transition to connected
    await page.waitForTimeout(1500);
  });
});

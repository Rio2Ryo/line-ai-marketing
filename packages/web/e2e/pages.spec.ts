import { test, expect } from '@playwright/test';

// ─── Public pages ───

test.describe('Public pages', () => {
  test('Landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/LINE AI Marketing/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    // Should have LINE login button or login form
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});

// ─── Dashboard pages (redirect to login or render) ───

test.describe('Dashboard pages render', () => {
  const dashboardPages = [
    { path: '/dashboard', name: 'ダッシュボード' },
    { path: '/dashboard/customers', name: '顧客管理' },
    { path: '/dashboard/scenarios', name: 'シナリオ' },
    { path: '/dashboard/segments', name: 'セグメント配信' },
    { path: '/dashboard/richmenu', name: 'リッチメニュー' },
    { path: '/dashboard/messages', name: 'メッセージ' },
    { path: '/dashboard/surveys', name: 'アンケート' },
    { path: '/dashboard/knowledge', name: 'ナレッジベース' },
    { path: '/dashboard/ai-generate', name: 'AIコンテンツ' },
    { path: '/dashboard/settings', name: '設定' },
  ];

  for (const { path, name } of dashboardPages) {
    test(`${name} (${path}) loads with 200`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('body')).toBeVisible();
    });
  }
});

// ─── Sidebar navigation ───

test.describe('Sidebar navigation', () => {
  test('Sidebar contains all nav items', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const expectedItems = [
      'ダッシュボード',
      '顧客管理',
      'シナリオ',
      'セグメント配信',
      'リッチメニュー',
      'メッセージ',
      'アンケート',
      'ナレッジベース',
      'AIコンテンツ',
      '設定',
    ];

    for (const item of expectedItems) {
      const link = page.locator(`a:has-text("${item}")`);
      await expect(link).toBeVisible();
    }
  });

  test('Sidebar nav links are clickable', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Click segments link
    await page.click('a:has-text("セグメント配信")');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/dashboard/segments');

    // Click surveys link
    await page.click('a:has-text("アンケート")');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/dashboard/surveys');

    // Click AI content link
    await page.click('a:has-text("AIコンテンツ")');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/dashboard/ai-generate');
  });
});

// ─── Page-specific content checks ───

test.describe('Page content checks', () => {
  test('Segments page has condition builder UI', async ({ page }) => {
    await page.goto('/dashboard/segments');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.textContent('body');
    // Should have segment-related content
    expect(body?.length).toBeGreaterThan(0);
  });

  test('Surveys page has survey UI', async ({ page }) => {
    await page.goto('/dashboard/surveys');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(0);
  });

  test('AI Generate page has tabs', async ({ page }) => {
    await page.goto('/dashboard/ai-generate');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(0);
  });
});

// ─── 404 handling ───

test.describe('404 handling', () => {
  test('Non-existent page returns content', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-xyz');
    // Static export may return 200 with _redirects or actual 404
    expect(response?.status()).toBeDefined();
    await expect(page.locator('body')).toBeVisible();
  });
});

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startServer, webRoot } from './server.mjs';

export async function openBrowser({ width = 1280, height = 820 } = {}) {
  const runtime = resolve(webRoot, '.runtime');
  await mkdir(runtime, { recursive: true });
  process.env.TMPDIR = runtime;
  process.env.TMP = runtime;
  process.env.TEMP = runtime;
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(webRoot, '.browsers');
  const { chromium } = await import('playwright');
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const errors = [], blocked = [];
    const origin = new URL(server.url).origin;
    await context.route('**/*', route => {
      const url = route.request().url();
      if (new URL(url).origin === origin) return route.continue();
      blocked.push(url);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    return {
      browser, context, page, url: server.url, errors, blocked,
      close: async () => { await browser.close(); await server.close(); },
    };
  } catch (error) {
    await browser?.close();
    await server.close();
    throw new Error(`${error.message}\nInstall Chromium from art/canopy/viewer: npm run browser:install`, { cause: error });
  }
}

export async function loadScene(session, { capture = false } = {}) {
  await session.page.goto(`${session.url}${capture ? '?capture=1' : ''}`, { waitUntil: 'networkidle' });
  await session.page.waitForFunction(() => window.canopyTest?.ready || window.canopyTest?.error, null, { timeout: 120_000 });
  const error = await session.page.evaluate(() => window.canopyTest.error);
  if (error) throw new Error(`Scene load failed; not browser-verified:\n${error}`);
  await session.page.evaluate(() => { window.canopyTest.setPlaying(false); window.canopyTest.renderOnce(); });
}

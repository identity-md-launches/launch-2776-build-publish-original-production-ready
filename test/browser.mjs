import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve } from '../scripts/serve.mjs';
import { LEVELS } from '../src/levels.ts';
import { STATUS_URL } from '../src/live.ts';

const { chromium, webkit } = await import(process.env.SQUEEK_PLAYWRIGHT || 'playwright');
const { default: AxeBuilder } = await import(process.env.SQUEEK_AXE || '@axe-core/playwright');
const output = 'test/scratch/browser-validation';
await mkdir(output, { recursive: true });
const { server, url } = await serve({ port: 0, base: '/preview/' });
const results = [];
const engines = process.env.SQUEEK_BROWSER === 'chromium' ? { chromium } : { chromium, webkit };
const response = (state = 'IDLE', extra = {}) => ({ schemaVersion: 1, measurement: { coreStatus: state, rpmMilli: state === 'SPINNING' ? 17250 : 0, freshness: 'online', observedAt: new Date().toISOString(), staleAfterSeconds: 120, ...extra } });
async function run(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: String(error.stack || error) }); console.error(`FAIL ${name}: ${error.message}`); }
}
const wait = (page, attr, value) => page.waitForFunction(([a, v]) => document.querySelector('#app').getAttribute(a) === v, [attr, String(value)]);
async function noOverflow(page) {
  const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  assert.ok(size.document <= size.viewport + 1, `horizontal overflow: ${JSON.stringify(size)}`);
}
async function visibleDialog(page) {
  await page.getByRole('dialog').waitFor();
  await page.waitForFunction(() => {
    const dialog = document.querySelector('#modal'), rect = dialog.getBoundingClientRect();
    return getComputedStyle(dialog).opacity === '1' && rect.top >= 0 && rect.bottom <= innerHeight && rect.width > 0;
  });
}
async function axe(page, label) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  await writeFile(`${output}/axe-${label}.json`, JSON.stringify({ violations: report.violations, passes: report.passes.length }, null, 2));
  assert.deepEqual(report.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })), []);
}
function solution(level) {
  return level.pieces.map(piece => {
    const coords = level.map.flatMap((row, y) => [...row].flatMap((id, x) => id === piece.id ? [[x, y]] : []));
    return { id: piece.id, x: Math.min(...coords.map(p => p[0])), y: Math.min(...coords.map(p => p[1])), rotations: (4 - piece.startRotation) % 4 };
  });
}
try {
  for (const [engine, browserType] of Object.entries(engines)) {
    let browser;
    try { browser = await browserType.launch({ headless: true, ...(engine === 'chromium' ? { args: ['--disable-gpu', '--renderer-process-limit=1'] } : {}) }); }
    catch (error) { results.push({ name: `${engine}: launch`, passed: false, error: String(error) }); console.error(`${engine} unavailable: ${error.message}`); continue; }
    async function context(options = {}, state = 'IDLE') {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
      await context.route(STATUS_URL, route => route.fulfill({ json: response(state) }));
      const page = await context.newPage(); page.setDefaultTimeout(8000);
      await page.goto(url); await wait(page, 'data-route', state === 'IDLE' ? 'nap' : 'spinning');
      return { context, page };
    }
    await run(`${engine}: desktop keyboard, undo, win, progress, tutorial focus, sound`, async () => {
      const { context: ctx, page } = await context();
      try {
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        assert.equal(await page.title(), 'Squeek Pouch');
        await page.screenshot({ path: `${output}/${engine}-desktop.png`, fullPage: true });
        await page.locator('[data-cell="0,0"]').focus();
        await page.keyboard.press('Enter'); await wait(page, 'data-filled', 4);
        await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await wait(page, 'data-filled', 8);
        await page.keyboard.press('u'); await wait(page, 'data-filled', 4);
        await page.keyboard.press('Enter'); await wait(page, 'data-filled', 8);
        await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter'); await wait(page, 'data-filled', 12);
        assert.equal(await page.getByRole('button', { name: 'Finish pouch', exact: true }).count(), 1);
        await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
        await visibleDialog(page);
        assert.equal(await page.locator('.result-stars .earned').count(), 3);
        await axe(page, `${engine}-result`);
        await page.screenshot({ path: `${output}/${engine}-result.png` });
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Sound', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Sound', exact: true }).getAttribute('aria-pressed'), 'true');
        await page.reload(); await wait(page, 'data-route', 'nap');
        assert.equal(await page.locator('h2').textContent(), 'First handful');
        assert.equal(await page.getByRole('button', { name: 'Sound', exact: true }).getAttribute('aria-pressed'), 'true');
        await page.locator('[data-action="levels"]').click();
        assert.equal(await page.locator('[data-level="1"]').isDisabled(), false);
        assert.equal(await page.locator('[data-level="2"]').isDisabled(), true);
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'How to play', exact: true }).click();
        await visibleDialog(page);
        assert.equal(await page.locator('#modal').evaluate(el => el.scrollTop), 0);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'modal-title');
        await axe(page, `${engine}-tutorial`);
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.closest('dialog') !== null), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.focus), 'help');
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
    await run(`${engine}: mobile touch, rotation, invalid move, restart, Chinese and reduced motion`, async () => {
      const { context: ctx, page } = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'SPINNING');
      try {
        await noOverflow(page);
        const button = await page.locator('[data-action="pack"]').boundingBox();
        assert.ok(button.y + button.height <= 844, `Pack button is below first screen (${button.y + button.height})`);
        await page.screenshot({ path: `${output}/${engine}-mobile.png`, fullPage: true });
        await axe(page, `${engine}-mobile`);
        await page.locator('[data-action="rotate"]').tap();
        await page.locator('[data-cell="3,3"]').tap();
        await page.locator('[data-action="pack"]').tap(); await wait(page, 'data-moves', 0);
        assert.match(await page.locator('.notice').textContent(), /overlaps or spills/);
        await page.locator('[data-cell="0,0"]').tap(); await page.locator('[data-action="pack"]').tap(); await wait(page, 'data-moves', 1);
        await page.locator('[data-action="undo"]').tap(); await wait(page, 'data-moves', 0);
        await page.locator('[data-action="pack"]').tap(); await page.locator('[data-action="restart"]').tap();
        await page.getByRole('button', { name: 'Keep packing' }).tap(); await wait(page, 'data-moves', 1);
        await page.locator('[data-action="restart"]').tap(); await page.getByRole('button', { name: 'Restart level', exact: true }).tap(); await wait(page, 'data-moves', 0);
        await page.locator('[data-action="language"]').tap();
        assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
        await noOverflow(page); await axe(page, `${engine}-chinese`);
        await page.screenshot({ path: `${output}/${engine}-chinese.png`, fullPage: true });
        await page.reload(); assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.locator('.wheel-spokes').first().evaluate(el => getComputedStyle(el).animationName), 'none');
        for (const width of [320, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await noOverflow(page); }
      } finally { await ctx.close(); }
    });
    await run(`${engine}: all 12 levels playable through UI, larger grids unlock, three-star collection`, async () => {
      const { context: ctx, page } = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      try {
        for (const level of LEVELS) {
          assert.equal(await page.locator('#pouch-grid').getAttribute('aria-rowcount'), String(level.size));
          for (const move of solution(level)) {
            await page.locator(`[data-piece="${move.id}"]`).tap();
            for (let i = 0; i < move.rotations; i++) await page.locator('[data-action="rotate"]').tap();
            await page.locator(`[data-cell="${move.x},${move.y}"]`).tap();
            await page.locator('[data-action="pack"]').tap();
          }
          await visibleDialog(page);
          assert.equal(await page.locator('.result-stars .earned').count(), 3, `level ${level.id}`);
          if (level.id < 12) await page.locator('#modal [data-action="next"]').tap();
        }
        assert.match(await page.locator('#modal-title').textContent(), /All 12/);
        await page.locator('#modal [data-action="levels"]').tap();
        assert.equal(await page.locator('.level-stars .earned').count(), 36);
        await page.screenshot({ path: `${output}/${engine}-collection.png` });
        await page.locator('[data-level="11"]').tap();
        await page.evaluate(() => scrollTo(0, 0));
        await noOverflow(page);
        await page.screenshot({ path: `${output}/${engine}-level12.png`, fullPage: true });
      } finally { await ctx.close(); }
    });
    await run(`${engine}: API failure, backoff, recovery and mid-attempt route freeze`, async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      let status = 'fail', requests = 0;
      await ctx.route(STATUS_URL, route => { requests++; return status === 'fail' ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fulfill({ json: response(status) }); });
      const page = await ctx.newPage();
      try {
        await page.clock.install(); await page.goto(url);
        await page.locator('#mobile-live [data-action="retry"]').waitFor();
        assert.equal(requests, 1); await wait(page, 'data-route', 'practice');
        await page.clock.fastForward(29000); assert.equal(requests, 1);
        await page.clock.fastForward(2000); await page.waitForFunction(() => document.querySelector('#mobile-live [data-action="retry"]'));
        assert.equal(requests, 2);
        await page.locator('[data-action="pack"]').click(); await wait(page, 'data-locked', true);
        await page.screenshot({ path: `${output}/${engine}-practice.png`, fullPage: true });
        status = 'SPINNING'; await page.locator('#mobile-live [data-action="retry"]').click();
        await page.getByText('The wheel is spinning', { exact: true }).last().waitFor();
        assert.equal(await page.locator('#app').getAttribute('data-route'), 'practice');
        await page.locator('[data-action="restart"]').click(); await page.getByRole('button', { name: 'Restart level', exact: true }).click();
        await wait(page, 'data-route', 'spinning');
        assert.match(await page.locator('.moves-stat').textContent(), /6/);
        await page.locator('[data-action="pack"]').click(); await wait(page, 'data-locked', true);
        status = 'IDLE'; await page.clock.fastForward(16000);
        await page.getByText('The wheel is napping', { exact: true }).last().waitFor();
        assert.equal(await page.locator('#app').getAttribute('data-route'), 'spinning');
        assert.equal(await page.locator('.board-seed.special').count(), 1);
      } finally { await ctx.close(); }
    });
    await run(`${engine}: timeout, stale payload, missing state and missing speed`, async () => {
      const ctx = await browser.newContext(); const page = await ctx.newPage();
      try {
        await page.clock.install();
        await ctx.route(STATUS_URL, () => {});
        await page.goto(url); await page.clock.fastForward(6000);
        await page.locator('#live-panel [data-action="retry"]').waitFor();
        assert.equal(await page.locator('#app').getAttribute('data-route'), 'practice');
        await ctx.unroute(STATUS_URL);
        await ctx.route(STATUS_URL, route => route.fulfill({ json: response('SPINNING', { observedAt: new Date(Date.now() - 300000).toISOString() }) }));
        await page.locator('#live-panel [data-action="retry"]').click();
        await page.getByText('Stale reading', { exact: true }).first().waitFor();
        await ctx.unroute(STATUS_URL);
        await ctx.route(STATUS_URL, route => route.fulfill({ json: { measurement: { rpmMilli: 9000 } } }));
        await page.locator('#live-panel [data-action="retry"]').click();
        await page.getByText('Live data unavailable', { exact: true }).first().waitFor();
        await ctx.unroute(STATUS_URL);
        await ctx.route(STATUS_URL, route => route.fulfill({ json: response('IDLE', { rpmMilli: undefined }) }));
        await page.locator('#live-panel [data-action="retry"]').click(); await wait(page, 'data-route', 'nap');
        assert.match(await page.locator('#live-panel').textContent(), /Speed not reported/);
      } finally { await ctx.close(); }
    });
    await run(`${engine}: 200% text size, 320px reflow, source links and local assets`, async () => {
      const { context: ctx, page } = await context({ viewport: { width: 320, height: 900 } });
      try {
        await noOverflow(page);
        await page.screenshot({ path: `${output}/${engine}-320.png`, fullPage: true });
        await page.evaluate(() => document.documentElement.style.fontSize = '32px');
        await noOverflow(page);
        await page.locator('[data-action="help"]').click(); await noOverflow(page);
        assert.equal(await page.getByRole('link', { name: 'Genesis Code lane' }).getAttribute('href'), 'https://squeekchain.com/genesis/d4sp8cje');
        assert.equal(await page.getByRole('link', { name: 'Official Squeekchain' }).getAttribute('href'), 'https://squeekchain.com');
        for (const asset of ['share.png', 'favicon.svg']) assert.equal((await page.request.get(url + asset)).status(), 200);
      } finally { await ctx.close(); }
    });
    await browser.close();
  }
} finally {
  server.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ testedAt: new Date().toISOString(), export: 'dist/ under /preview/', results }, null, 2));
}
console.log(`${results.filter(r => r.passed).length}/${results.length} browser scenarios passed`);
if (results.some(r => !r.passed)) process.exitCode = 1;

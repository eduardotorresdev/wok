import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../db/index.ts', () => ({ sqlite: () => ({}), db: () => ({}), schema: {} }));

const { followNavigations, captureJpeg } = await import('./service.ts');

// One real Chromium, closed at the end: what counts as "a new page" is decided
// by the browser's own events, which a stand-in would not reproduce.
let browser: Browser;
beforeAll(async () => {
	browser = await chromium.launch();
});
afterAll(async () => {
	await browser.close();
});

const PAGE = `<!doctype html><title>spa</title><body style="background:#fff">
<p>same picture on every route</p><iframe id="inner" src="/inner"></iframe></body>`;

describe('navigations of a tab', () => {
	it('counts new documents and route changes, and a frame can be made for each', async () => {
		const context = await browser.newContext();
		try {
			const page = await context.newPage();
			await page.route('https://spa.test/**', (route) =>
				route.fulfill({
					contentType: 'text/html',
					body: route.request().url().includes('/inner') ? '<p>inner</p>' : PAGE
				})
			);
			const cdp = await context.newCDPSession(page);
			let nav = 0;
			const frames: { nav: number; ms: number }[] = [];
			let since = Date.now();
			await followNavigations(cdp, () => {
				const mine = ++nav;
				void captureJpeg(cdp).then((jpeg) => {
					if (jpeg) frames.push({ nav: mine, ms: Date.now() - since });
				});
			});
			const settled = () => new Promise((r) => setTimeout(r, 400));

			await page.goto('https://spa.test/');
			await settled();
			expect(nav).toBe(1); // the iframe's own load did not count

			// A route change that paints nothing new: the screencast would stay silent.
			since = Date.now();
			await page.evaluate(() => history.pushState({}, '', '/vagas'));
			await settled();
			expect(nav).toBe(2);
			const forced = frames.find((f) => f.nav === 2);
			expect(forced).toBeDefined();
			expect(forced!.ms).toBeLessThan(2000);

			// The same address pushed again, a hash that does not change, a frame inside the page.
			await page.evaluate(() => history.pushState({}, '', '/vagas'));
			await page.evaluate(() => history.replaceState({}, '', '/vagas'));
			await page.evaluate(() => {
				(document.getElementById('inner') as HTMLIFrameElement).src = '/inner?again';
			});
			await settled();
			expect(nav).toBe(2);

			await page.evaluate(() => (location.hash = '#topo'));
			await settled();
			expect(nav).toBe(3);

			// Reopening the very same address is a new page.
			await page.goto('https://spa.test/vagas');
			await page.reload();
			await settled();
			expect(nav).toBe(5);
		} finally {
			await context.close();
		}
	}, 60_000);
});

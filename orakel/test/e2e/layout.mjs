// Screenshot the boss bar at several window sizes to check it never covers the HUD panels.
import {chromium, devices, GAME_URL, SHOTS, launch} from './_env.mjs';
const file = process.env.FILE || GAME_URL;
const SH = SHOTS;
const browser = await launch();
const sizes = [
  ['960x540', {viewport: {width: 960, height: 540}}],
  ['1280x720', {viewport: {width: 1280, height: 720}}],
  ['800x600', {viewport: {width: 800, height: 600}}],
  ['phone-landscape', {...devices['iPhone 13 landscape']}],
  ['phone-portrait', {...devices['iPhone 13']}],
  ['640x360', {viewport: {width: 640, height: 360}}],
  ['667x375-touch', {viewport: {width: 667, height: 375}, isMobile: true, hasTouch: true, deviceScaleFactor: 2}],
  ['800x360-touch', {viewport: {width: 800, height: 360}, isMobile: true, hasTouch: true, deviceScaleFactor: 2}],
  ['568x320-touch', {viewport: {width: 568, height: 320}, isMobile: true, hasTouch: true, deviceScaleFactor: 2}],
  ['ipad-landscape', {...devices['iPad Mini landscape']}],
];
for (const [name, opts] of sizes) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(file + '?q=low');
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('#titleBtns .go').click());
  await page.waitForTimeout(1500);
  await page.evaluate(async () => { await __orakel.run(1); });
  const r = await page.evaluate(() => {
    const b = document.getElementById('bossbar');
    b.hidden = false;
    document.getElementById('bossName').textContent = 'De Glimmende Demo';
    document.getElementById('bossPhase').textContent = 'Glimmend en onkwetsbaar · laat het licht openbarsten (R)';
    document.getElementById('bossFill').style.transform = 'scaleX(.6)';
    const box = e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    const hit = (a, c) => a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3];
    const bb = box(b);
    const others = ['.status', '.mapcard', '.tools', '#touch .tbtn', '.joy', '.corner, #btnMenu'].flatMap(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null && e.getBoundingClientRect().width > 0).map(e => [sel, box(e)]));
    return {bar: bb, overlaps: others.filter(([, r]) => hit(bb, r)).map(([s, r]) => `${s} ${r}`)};
  });
  await page.waitForTimeout(300);
  await page.screenshot({path: `${SH}bossbar-${name}.png`});
  console.log(name, JSON.stringify(r), errs.length ? errs : '');
  await ctx.close();
}
await browser.close();

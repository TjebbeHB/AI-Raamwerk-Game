// Screenshot the boss bar at several window sizes to check it never covers the HUD panels.
//   node orakel/test/e2e/layout.mjs            the boss bar at ten sizes
//   node orakel/test/e2e/layout.mjs options    the options, the key remapping and the accessibility settings at 1280x720
import {chromium, devices, GAME_URL, SHOTS, launch} from './_env.mjs';
const file = process.env.FILE || GAME_URL;
const SH = SHOTS;
const browser = await launch();
if (process.argv[2] === 'options') {
  const page = await browser.newPage({viewport: {width: 1280, height: 720}});
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(file + '?q=low');
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('#titleBtns .go').click());
  await page.waitForTimeout(2500);
  // the opening conversation, with the speaker's face in the box
  await page.screenshot({path: `${SH}options-0-dialog.png`});
  const face = await page.evaluate(() => ({shown: !document.getElementById('dlgFace').hidden, name: document.getElementById('dlgName').textContent}));
  for (let i = 0; i < 10; i++) { await page.evaluate(() => { const d = document.getElementById('dialog'); if (!d.hidden) d.click(); }); await page.waitForTimeout(250); }
  await page.evaluate(async () => { await __orakel.run(1); });
  await page.evaluate(() => { document.exitPointerLock?.(); document.getElementById('btnMenu').click(); });
  await page.waitForTimeout(400);
  await page.screenshot({path: `${SH}options-1-menu.png`});
  const menu = await page.evaluate(() => ({focus: document.activeElement?.textContent, buttons: [...document.querySelectorAll('#menuBody .tbtns button')].map(b => b.textContent)}));
  // accessibility: high contrast, the readable font and a bigger interface
  await page.evaluate(() => {
    const btn = t => [...document.querySelectorAll('#menuBody .btn')].find(b => b.textContent === t);
    btn('Hoog contrast').click(); btn('Extra leesbaar').click();
    const r = [...document.querySelectorAll('#menuBody input[type=range]')].find(i => i.getAttribute('aria-label') === 'Tekst en interface');
    r.value = 1.25; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));
    document.querySelector('.optsec:nth-of-type(2)')?.scrollIntoView();
  });
  await page.waitForTimeout(400);
  await page.screenshot({path: `${SH}options-2-a11y.png`});
  const pressed = await page.evaluate(() => ['Contrast', 'Lettertype'].map(l => [...document.querySelectorAll(`#menuBody [aria-label=${l}] button`)].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent).join()));
  // the remap screen: interact onto F (the ability's key) swaps the two
  await page.evaluate(() => [...document.querySelectorAll('#menuBody .btn')].find(b => b.textContent === 'Toetsen aanpassen').click());
  await page.waitForTimeout(300);
  await page.screenshot({path: `${SH}options-3-remap.png`});
  await page.evaluate(() => document.getElementById('rm-interact').click());
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(300);
  await page.screenshot({path: `${SH}options-4-swapped.png`});
  const remap = await page.evaluate(() => ({note: document.querySelector('.remapnote')?.textContent, keymap: __orakel.SETTINGS.keymap}));
  // back in the world, the prompt shows the new key
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const o = __orakel, letter = o.W.ents.find(e => /brief|letter/.test(e.id || '') || /brief/i.test(e.def?.label || '')) || o.W.ents.find(e => e.type === 'npc');
    if (letter) { o.teleport(letter.tx, letter.tz + 1, 0); await o.run(0.5); }
  });
  await page.screenshot({path: `${SH}options-5-hud.png`});
  const hud = await page.evaluate(() => ({prompt: document.getElementById('prompt').textContent.trim(), zoom: getComputedStyle(document.getElementById('hud')).zoom, body: document.body.className}));
  // put everything back for the next run in this browser profile
  await page.evaluate(() => { localStorage.removeItem('orakel-dalwijk-settings-v1'); });
  console.log(JSON.stringify({face, menu, pressed, remap, hud}), errs.length ? errs : 'no page errors');
  await browser.close();
  process.exit(0);
}
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

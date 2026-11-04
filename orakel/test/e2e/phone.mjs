// The game on phones: dialogue without touch buttons over it, and a HUD where nothing overlaps.
import {chromium, devices, GAME_URL, SHOTS, launch} from './_env.mjs';
const file = process.env.FILE || GAME_URL;
const SH = SHOTS;
const browser = await launch();
const overlaps = () => {
  const box = e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
  const hit = (a, c) => a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3];
  const vis = sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') && e.getBoundingClientRect().width > 0).map(e => [sel, box(e)]);
  const all = ['.status', '.mapcard', '.corner', '.tools', '#prompt', '#bossbar', '#dialog', '.joy', '#touch .tbtn'].flatMap(vis);
  const out = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (all[i][0] !== all[j][0] && hit(all[i][1], all[j][1])) out.push(`${all[i][0]} x ${all[j][0]}`);
  return {shown: all.map(([s]) => s).filter((s, i, a) => a.indexOf(s) === i), overlaps: out};
};
for (const [name, dev] of [['portrait', devices['iPhone 13']], ['landscape', devices['iPhone 13 landscape']], ['tablet', devices['iPad Mini']]]) {
  const ctx = await browser.newContext({...dev});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(file + '?q=low');
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('#titleBtns .go').click());
  await page.waitForTimeout(2500);
  // the opening is a conversation
  await page.screenshot({path: `${SH}phone-${name}-talk.png`});
  const talk = await page.evaluate(overlaps);
  const touchShown = await page.evaluate(() => getComputedStyle(document.getElementById('touch')).display);
  // tap through it
  for (let i = 0; i < 8; i++) { await page.evaluate(() => { const d = document.getElementById('dialog'); if (!d.hidden) d.click(); }); await page.waitForTimeout(500); }
  await page.evaluate(async () => { await __orakel.run(1); });
  // stand next to the letter so a prompt shows, and show the boss bar
  await page.evaluate(async () => {
    const letter = __orakel.W.ents.find(e => /brief|letter/.test(e.id || '') || /brief/i.test(e.def?.label || ''));
    if (letter) { __orakel.teleport(letter.tx, letter.tz + 1, 0); await __orakel.run(0.5); }
    const b = document.getElementById('bossbar'); b.hidden = false;
    document.getElementById('bossName').textContent = 'De Glimmende Demo';
    document.getElementById('bossPhase').textContent = 'Glimmend en onkwetsbaar · laat het licht openbarsten (R)';
  });
  await page.waitForTimeout(600);
  await page.screenshot({path: `${SH}phone-${name}-hud.png`});
  const hud = await page.evaluate(overlaps);
  console.log(name, JSON.stringify({talk, touchWhileTalking: touchShown, hud}), errs.length ? errs : '');
  await ctx.close();
}
await browser.close();

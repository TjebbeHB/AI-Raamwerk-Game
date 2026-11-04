// The game on phones: dialogue without touch buttons over it, and a compact HUD where nothing overlaps:
// the trust ring, the buttons and minimap in the corner, toasts, Pip, the boss bar, the E button that
// only shows when something is in reach, the tool button and the thumb arc (with a stand-in ability button).
//   node orakel/test/e2e/phone.mjs            portrait 390x844, landscape 844x390 and a tablet
//   ONLY=portrait node orakel/test/e2e/phone.mjs
import {devices, GAME_URL, SHOTS, launch} from './_env.mjs';
const file = process.env.FILE || GAME_URL;
const SH = SHOTS;
const browser = await launch();
const overlaps = () => {
  const box = e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
  const hit = (a, c) => a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3];
  // round buttons only clash when the circles do
  const round = e => { const r = e.getBoundingClientRect(); return Math.abs(r.width - r.height) < 1 && parseFloat(getComputedStyle(e).borderTopLeftRadius) >= r.width / 2 - 1; };
  const ring = b => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, (b[2] - b[0]) / 2];
  const clash = (x, y) => { if (x[2] && y[2]) { const p = ring(x[1]), q = ring(y[1]); return Math.hypot(p[0] - q[0], p[1] - q[1]) < p[2] + q[2]; } return hit(x[1], y[1]); };
  const vis = sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none' && !e.closest('[hidden]') && e.getBoundingClientRect().width > 0).map(e => [sel, box(e), round(e)]);
  const all = ['.status', '.mapcard', '.corner', '.tools', '#prompt', '#bossbar', '#dialog', '#toasts .toast', '#pip.on', '.joy', '#touch .tbtn'].flatMap(vis);
  const out = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if ((all[i][0] !== all[j][0] || all[i][0] === '#touch .tbtn') && clash(all[i], all[j])) out.push(`${all[i][0]} ${all[i][1]} x ${all[j][0]} ${all[j][1]}`);
  return {shown: all.map(([s]) => s).filter((s, i, a) => a.indexOf(s) === i), overlaps: out};
};
const runs = [['portrait', devices['iPhone 13']], ['landscape', devices['iPhone 13 landscape']], ['tablet', devices['iPad Mini']]].filter(([n]) => !process.env.ONLY || process.env.ONLY === n);
for (const [name, dev] of runs) {
  const ctx = await browser.newContext({...dev});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(file + '?q=low');
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('#titleBtns .go').click());
  await page.waitForTimeout(2500);
  // the opening is a conversation (another lane may open a character creator first: close it if so)
  await page.screenshot({path: `${SH}phone-${name}-talk.png`});
  const talk = await page.evaluate(overlaps);
  const touchShown = await page.evaluate(() => getComputedStyle(document.getElementById('touch')).display);
  // tap through it
  for (let i = 0; i < 8; i++) { await page.evaluate(() => { const d = document.getElementById('dialog'); if (!d.hidden) d.click(); }); await page.waitForTimeout(400); }
  await page.evaluate(async () => { await __orakel.run(1); });
  // tools in hand, a stand-in ability button, next to the letter so the E button shows, and the boss bar, a toast and Pip
  await page.evaluate(async () => {
    const o = __orakel;
    o.G.tools.lamp = true; o.G.tools.scale = true;
    if (!document.getElementById('tAbility')) document.getElementById('touch').append(Object.assign(document.createElement('button'), {className: 'tbtn', id: 'tAbility', textContent: '✸'}));
    const letter = o.W.ents.find(e => /brief|letter/.test(e.id || '') || /brief/i.test(e.def?.label || '')) || o.W.ents.find(e => e.type === 'npc');
    if (letter) { o.teleport(letter.tx, letter.tz + 1, 0); await o.run(0.5); }
    const b = document.getElementById('bossbar'); b.hidden = false;
    document.getElementById('bossName').textContent = 'De Glimmende Demo';
    document.getElementById('bossPhase').textContent = 'Glimmend en onkwetsbaar · laat het licht openbarsten (R)';
    o.giveItem('bron:test:a');
  });
  await page.waitForTimeout(600);
  await page.screenshot({path: `${SH}phone-${name}-hud.png`});
  const hud = await page.evaluate(overlaps);
  const act = await page.evaluate(() => { const a = document.getElementById('tAct'); return a.hidden ? 'hidden' : a.textContent.trim(); });
  // tap the trust ring: the whole card unfolds
  await page.evaluate(() => { document.getElementById('bossbar').hidden = true; document.getElementById('status').click(); });
  await page.waitForTimeout(300);
  await page.screenshot({path: `${SH}phone-${name}-open.png`});
  const open = await page.evaluate(overlaps);
  console.log(name, JSON.stringify({talk, touchWhileTalking: touchShown, hud, eButton: act, open}), errs.length ? errs : '');
  await ctx.close();
}
await browser.close();

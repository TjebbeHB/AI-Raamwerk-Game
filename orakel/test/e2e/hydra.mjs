// Can the Lekkende Hydra be beaten the way a player would: look at a head, fire the lamp?
import {chromium, devices, GAME_URL, SHOTS, launch} from './_env.mjs';
const file = process.env.FILE || GAME_URL;
const SH = SHOTS;
const browser = await launch();
const page = await browser.newPage({viewport: {width: 960, height: 540}});
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(file + '?q=low');
await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('#titleBtns .go').click());
await page.waitForTimeout(1500);
const cam = process.env.CAM || 'third';
console.log(await page.evaluate(async cam => {
  const o = __orakel; o.autoDecide = 'best';
  await o.run(1);
  Object.assign(o.G.flags, {pip: true, godmode: true, lift_ready: true}); Object.assign(o.G.tools, {lamp: true, scale: true, seal: true});
  o.setStage('main', 13, true); await o.travel('f3', 'from_f2'); await new Promise(r => setTimeout(r, 1500)); await o.run(6);
  if (cam === 'first') { o.press('KeyV'); await o.run(0.2); }
  const n = o.W.byId.get('slotje'); o.teleport(n.tx + 1, n.tz, 0); await o.run(0.2); n.interact(); await o.run(8);
  const h = o.C.enemies.find(e => e.type === 'hydra');
  const heads = () => o.C.enemies.filter(e => e.type === 'hydraHead' && e.alive);
  const info = {hydra: [h.x.toFixed(1), h.z.toFixed(1)], aware: h.aware, heads: heads().map(e => [e.x.toFixed(1), e.y.toFixed(1), e.z.toFixed(1), e.hp])};
  // stand south of the body, look at each head in turn and fire, the way a player would (aim first, then shoot next frame)
  o.teleport(Math.floor(h.x / 2), Math.floor(h.z / 2) + 3, 0); await o.run(0.3);
  const log = [];
  for (let k = 0; k < 320 && h.alive; k++) {
    const hs = heads();
    if (hs.length) {
      const t = hs[0]; const dx = t.x - o.P.x, dz = t.z - o.P.z;
      o.P.yaw = Math.atan2(-dx, -dz); o.P.pitch = Math.atan2(t.y + 0.3 - 1.6, Math.hypot(dx, dz));
      await o.run(0.05);                       // let the camera follow
      const a = o.aim ? o.aim() : null;
      o.C.cd.lamp = 0; o.useTool('lamp');
      if (k < 3) log.push({target: a?.target?.type || null, hp: t.hp});
    } else {
      // seal the stumps, then the body
      for (let i = 0; i < 3; i++) { const s = h.stumps[i]; if (s && !s.sealed) { const v = new o.THREE.Vector3(); h.model.parts.necks[i].base.getWorldPosition(v); o.teleport(Math.floor(v.x / 2), Math.floor(v.z / 2) + 1, 0); await o.run(0.05); const dx = v.x - o.P.x, dz = v.z - o.P.z; o.P.yaw = Math.atan2(-dx, -dz); o.C.cd.seal = 0; o.useTool('seal'); await o.run(0.1); } }
      if (!h.invuln) { o.teleport(Math.floor(h.x / 2), Math.floor(h.z / 2) + 1, 0); const dx = h.x - o.P.x, dz = h.z - o.P.z; o.P.yaw = Math.atan2(-dx, -dz); o.P.pitch = 0; await o.run(0.05); o.C.cd.seal = 0; o.useTool('seal'); }
    }
    await o.run(0.25);
  }
  return JSON.stringify({info, firstShots: log, alive: h.alive, hp: Math.round(h.hp), invuln: h.invuln, stumps: h.stumps.map(s => s && s.sealed), headsLeft: heads().length});
}, cam));
await page.screenshot({path: SH + 'hydra-diag.png'});
console.log(errs.join('\n') || 'no page errors');
await browser.close();

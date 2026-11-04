// The four guardians of the descent. Each fight asks for the right tool at the right time.
import * as THREE from 'three';
import {P, UI, SFX, ON, chamberState} from '../game/bus.js';
import {spawnEnemy, shoot, C, ringFx, damage} from '../game/combat.js';
import {hurtPlayer, PL} from '../game/player.js';
import {FX} from '../engine/particles.js';
import {R} from '../engine/render.js';
import {W, ent, collide, solidTile} from '../game/world.js';
import {G, SETTINGS} from '../game/state.js';
import {tileOf} from '../core/util.js';

const v3 = new THREE.Vector3();
const distP = e => Math.hypot(P.x - e.x, P.z - e.z);
const alive = type => C.enemies.filter(o => o.alive && o.type === type).length;
let barkT = 0;
function bark(e, text) { e.barkText = text; e.barkT = 3.2; }
function bossBar(e, phase) {
  if (!e.alive) return;
  // only the boss you are actually fighting gets the bar
  if (!e.aware || distP(e) > 30) { if (UI.bossOwner === e) { UI.boss(null); UI.bossOwner = null; } return; }
  UI.bossOwner = e;
  e.barkT = Math.max(0, (e.barkT || 0) - 1 / 30);
  UI.boss(e.def.name, e.hp / e.maxHp, e.barkT > 0 ? `“${e.barkText}”` : phase);
}
// a red ring on the floor that warns where a blow will land
function warn(x, z, r, sec) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.05, 1, 40), new THREE.MeshBasicMaterial({color: 0xff5a40, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, z); R.scene.add(m);
  const t0 = R.time;
  const tick = () => { const k = Math.min(1, (R.time - t0) / sec); m.scale.setScalar(r * (0.3 + 0.7 * k)); m.material.opacity = 0.25 + 0.4 * k; if (k < 1) requestAnimationFrame(tick); else setTimeout(() => { R.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }, 150); };
  tick();
}
function fan(e, n, spread, opts = {}) {
  const from = {x: e.x, y: e.y + (opts.y ?? e.def.aimY), z: e.z};
  const base = Math.atan2(P.x - from.x, P.z - from.z);
  for (let k = 0; k < n; k++) {
    const a = base + (k - (n - 1) / 2) * spread;
    const dir = new THREE.Vector3(Math.sin(a), (P.y + 1.1 - from.y) / Math.max(4, distP(e)), Math.cos(a)).normalize();
    shoot({...from, dir, speed: opts.speed ?? 10, dmg: SETTINGS.difficulty === 'calm' ? 0 : (opts.dmg ?? 9), owner: 'enemy', color: opts.color ?? 0xffd36b, r: opts.r ?? 0.3, life: 3, homing: opts.homing});
  }
  SFX.play('enemyShot');
}
function summon(e, type, n, max = 4) {
  if (alive(type) >= max) return;
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    let x = e.x + Math.cos(a) * 3.5, z = e.z + Math.sin(a) * 3.5;
    if (solidTile(tileOf(x), tileOf(z))) { x = e.x; z = e.z; }
    const m = spawnEnemy(type, x, z, {group: e.group + '_minions', aware: true});
    if (m) { m.def.respawn = true; FX.burst(x, 1, z, 20, {color: m.def.color ?? 0xffffff, speed: 3, life: 0.6}); }
  }
}
const calm = () => SETTINGS.difficulty === 'calm';

export const BOSS_DEFS = {
  // ---------------------------------------------------------------- Diepte 1
  demoBoss: {name: 'De Glimmende Demo', boss: true, model: {kind: 'demo'}, color: 0xffd36b, hp: 220, speed: 1.3, weak: 'lamp', shielded: true, dmg: 15,
    attack: 'custom', aimY: 2.0, r: 1.2, h: 3.6, heavy: true, wake: 16, noDrop: true, hiddenInBook: false,
    shieldHint: 'Al dat glimmen houdt je licht tegen. Laat het licht openbarsten (R) om te zien wat er onder de glans zit.',
    lesson: 'Achter de glans van een demo zit vaak karton. Laat beloftes toetsen voordat je erop bouwt.',
    init(e) { e.t1 = 2.5; e.t2 = 5; e.t3 = 9; e.gold = e.model.parts.shell.material.color.getHex(); },
    onReveal(e) { bark(e, ['Wacht, dit stond niet in de demo!', 'Niet naar de kabels kijken!', 'Dit is een bètaversie!'][Math.floor(Math.random() * 3)]); },
    update(e, dt) {
      const ex = e.exposed > 0;
      bossBar(e, ex ? 'Ontmaskerd: toets hem nu met de Toetslamp (1)' : 'Glimmend en onkwetsbaar · laat het licht openbarsten (R)');
      const sh = e.model.parts.shell.material;
      sh.color.setHex(ex ? 0x9a7a50 : e.gold); sh.emissiveIntensity = ex ? 0.05 : 0.6;
      e.model.parts.screen.material.emissiveIntensity = ex ? 0.2 : 1.2;
      if (!e.aware || calm() && false) return;
      e.t1 -= dt; e.t2 -= dt; e.t3 -= dt;
      if (e.slam) {
        e.slam.t += dt; e.attackAnim = Math.min(1, e.slam.t / 1.0); e.speedMul = 0;
        if (e.slam.t > 1.0) {
          if (distP(e) < 3.6 && !calm()) hurtPlayer(16, e.x, e.z);
          ringFx(e.x, 0.1, e.z, 3.6, 0xffd36b, 0.5, true); PL.shake = Math.max(PL.shake, 0.3); SFX.play('sealHit');
          e.slam = null; e.attackAnim = undefined;
        }
        return;
      }
      e.speedMul = 1;
      if (distP(e) < 3.4 && e.t1 <= 0) { e.slam = {t: 0}; e.t1 = 3.6; warn(e.x, e.z, 3.6, 1.0); SFX.play('windup'); bark(e, 'BINNEN ZES WEKEN LIVE!'); }
      if (e.t2 <= 0) { fan(e, 5, 0.22, {color: 0xffd36b, dmg: 8}); e.t2 = 5.5; if (Math.random() < 0.4) bark(e, ['100% nauwkeurig!*', 'Uw vraag is onze oplossing!', 'Tientallen gemeenten gingen u voor!'][Math.floor(Math.random() * 3)]); }
      if (e.t3 <= 0) { summon(e, e.hp < e.maxHp / 2 ? 'haste' : 'demo', 2, 3); e.t3 = 13; }
    }},
  // ---------------------------------------------------------------- Diepte 2
  king: {name: 'De Haastkoning', boss: true, model: {kind: 'king'}, color: 0xff8a5c, hp: 280, speed: 2.4, weak: 'scale', dmg: 18,
    attack: 'custom', aimY: 1.8, r: 1.3, h: 3.0, heavy: true, wake: 20, noDrop: true,
    lesson: 'Haast is een slechte raadgever. Bedenktijd is geen vertraging, maar onderdeel van het werk.',
    init(e) { e.t1 = 3; e.t2 = 5; e.t3 = 10; e.dizzy = 0; },
    damageFilter(e, tool, mult) { return e.dizzy > 0 ? (tool === 'scale' ? 3 : 1.6) : mult; },
    onHit(e, tool) { if (tool === 'scale' && !e.charge && e.dizzy <= 0) { e.dizzy = 3.2; bark(e, 'Bedenk… tijd…?'); SFX.play('reveal'); } },
    update(e, dt) {
      bossBar(e, e.dizzy > 0 ? 'Duizelig van de bedenktijd: nu is hij kwetsbaar!' : e.charge ? 'Hij stormt op je af · duik weg (Spatie)' : 'Geef hem bedenktijd met de Weegschaal (2)');
      e.dizzy = Math.max(0, e.dizzy - dt); e.st.dizzy = e.dizzy > 0;
      if (e.dizzy > 0) { e.speedMul = 0; e.attackAnim = 0; if (Math.random() < dt * 10) FX.one({x: e.x + Math.cos(R.time * 6) * 1.2, y: 3.4, z: e.z + Math.sin(R.time * 6) * 1.2, life: 0.5, s0: 0.25, color: 0xfff1b8}); return; }
      if (!e.aware) return;
      e.t1 -= dt; e.t2 -= dt; e.t3 -= dt;
      if (e.charge) {
        const c = e.charge; c.t += dt;
        if (c.t < 0.9) { e.speedMul = 0; e.attackAnim = c.t / 0.9; e.yaw = Math.atan2(c.dx, c.dz); return 'skipMove'; }
        e.attackAnim = 1;
        const step = 15 * dt, nx = e.x + c.dx * step, nz = e.z + c.dz * step;
        const r = collide(nx, nz, e.def.r);
        const blocked = Math.hypot(r.x - nx, r.z - nz) > 0.05;
        e.x = r.x; e.z = r.z;
        if (!c.hit && distP(e) < e.def.r + 0.6) { c.hit = true; if (!calm()) hurtPlayer(18, e.x, e.z); }
        if (Math.random() < 0.6) FX.one({x: e.x, y: 0.3, z: e.z, vy: 1, life: 0.6, s0: 0.3, color: 0x9a8a78, additive: false, a: 0.6});
        if (blocked || c.t > 2.3) {
          e.charge = null; e.attackAnim = undefined;
          if (blocked) { e.dizzy = 1.8; PL.shake = Math.max(PL.shake, 0.4); SFX.play('gateDown'); bark(e, 'Au! Wie heeft die muur daar neergezet?!'); }
        }
        return 'skipMove';
      }
      e.speedMul = 1;
      if (e.t1 <= 0 && distP(e) > 3) {
        const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1;
        e.charge = {t: 0, dx: dx / d, dz: dz / d}; e.t1 = 5.5; SFX.play('windup');
        bark(e, ['LIVE! LIVE! LIVE!', 'Waarom duurt dit zo lang?!', 'Vrijdag moet het af!'][Math.floor(Math.random() * 3)]);
        for (let k = 1; k <= 6; k++) warn(e.x + dx / d * k * 2, e.z + dz / d * k * 2, 1.0, 0.9);
        return 'skipMove';
      }
      if (e.t2 <= 0) { fan(e, 3, 0.3, {color: 0xff8a5c, dmg: 10, speed: 12}); e.t2 = 4; }
      if (e.t3 <= 0) { summon(e, 'haste', 2, 4); e.t3 = 14; bark(e, 'Kobolden! Sneller!'); }
    }},
  // ---------------------------------------------------------------- Diepte 3
  hydra: {name: 'De Lekkende Hydra', boss: true, model: {kind: 'hydra'}, color: 0x7fe0a4, hp: 220, speed: 0, weak: 'seal', dmg: 12,
    attack: 'custom', aimY: 1.0, r: 1.8, h: 3, heavy: true, wake: 16, noDrop: true, ghostShots: true, immuneText: 'De koppen beschermen het lijf',
    lesson: 'Een lek dicht je niet door er één keer naar te kijken. Elke route naar buiten moet begrensd worden.',
    init(e) {
      e.heads = [0, 1, 2].map(i => spawnEnemy('hydraHead', e.x, e.z, {aware: true, extra: {hydra: e, idx: i}}));
      e.stumps = [null, null, null]; e.invuln = true; e.t3 = 10;
      e.onSeal = (sx, sz) => {
        e.stumps.forEach((s, i) => {
          if (!s || s.sealed) return;
          e.model.parts.necks[i].base.getWorldPosition(v3);
          if (Math.hypot(v3.x - sx, v3.z - sz) < 3.2 || Math.hypot(P.x - v3.x, P.z - v3.z) < 3.2) {
            s.sealed = true; FX.burst(v3.x, v3.y, v3.z, 30, {color: [0x7fe0a4, 0xffffff], speed: 3, life: 0.8}); SFX.play('sealHit');
            UI.number(v3.x, v3.y + 0.6, v3.z, 'Verzegeld!', '#7fe0a4', true);
          }
        });
        if (e.stumps.every(s => s && s.sealed) && e.invuln) { e.invuln = false; bark(e, 'Mijn… lekken…'); UI.pip('Alle koppen zijn verzegeld! Nu het lijf, met het Zegel (3).'); }
      };
      (ON.sealSwing ||= []).push(e.onSeal);
    },
    onDeath(e) { const i = (ON.sealSwing || []).indexOf(e.onSeal); if (i >= 0) ON.sealSwing.splice(i, 1); for (const h of e.heads) if (h?.alive) h.alive = false; },
    update(e, dt) {
      const necks = e.model.parts.necks;
      const open = e.stumps.filter(s => s && !s.sealed).length, headsAlive = e.heads.filter(h => h?.alive).length;
      bossBar(e, !e.invuln ? 'Het lijf ligt open: verzegel het (3)' : open ? 'Verzegel de stomp met het Zegel (3), anders groeit de kop terug' : `Toets de koppen met de Toetslamp (1) · ${headsAlive} over`);
      necks.forEach((n, i) => {
        const h = e.heads[i];
        if (h?.alive) {
          n.alive = true;
          n.head.getWorldPosition(v3);
          h.x = v3.x; h.z = v3.z; h.y = v3.y - 0.3;
          h.spitT = (h.spitT ?? 1 + i) - dt;
          if (e.aware && h.spitT <= 0) { h.spitT = 2.6 + Math.random(); fan(h, 1, 0, {color: 0x7fe0a4, dmg: 9, speed: 9, y: 0.3}); e.attackHeadT = 0.5; e.st.attackHead = i; }
        } else {
          n.alive = false;
          const s = e.stumps[i];
          if (s && !s.sealed) {
            s.t -= dt;
            if (Math.random() < dt * 12) { n.base.getWorldPosition(v3); FX.one({x: v3.x, y: v3.y, z: v3.z, vy: 1.5, vx: (Math.random() - 0.5), life: 0.8, s0: 0.2, color: 0x7fe0a4}); }
            if (s.t <= 0) { e.stumps[i] = null; e.heads[i] = spawnEnemy('hydraHead', e.x, e.z, {aware: true, extra: {hydra: e, idx: i}}); bark(e, 'Het lek groeit terug!'); }
          }
        }
      });
      e.attackHeadT = Math.max(0, (e.attackHeadT || 0) - dt); e.attackAnim = e.attackHeadT > 0 ? Math.sin(e.attackHeadT * 6) : 0;
      if (!e.aware) return;
      e.t3 -= dt;
      if (e.t3 <= 0) { summon(e, 'leaklet', 2, 4); e.t3 = 11; }
      if (distP(e) < e.def.r + 0.8 && !calm()) { e.touchT = (e.touchT || 0) - dt; if (e.touchT <= 0) { e.touchT = 1; hurtPlayer(8, e.x, e.z); } }
    }},
  hydraHead: {name: 'Hydrakop', model: {kind: 'none'}, color: 0x7fe0a4, hp: 45, speed: 0, weak: 'lamp', dmg: 0, attack: 'custom', aimY: 0.3, r: 0.75, h: 1.2, fly: true, heavy: true, noDrop: true, hiddenInBook: true, wake: 30,
    lesson: 'Een lek heeft vele koppen.',
    update(e) { return 'skip'; },
    onDeath(e) {
      const h = e.hydra; if (!h?.alive) return;
      h.stumps[e.idx] = {t: chamberState('security') === 'strong' ? 11 : 8, sealed: false};
      UI.pip('Een kop is eraf! Dicht de stomp met het Zegel (3) voordat hij teruggroeit.');
    }},
  // ---------------------------------------------------------------- Diepte 4
  fabulant: {name: 'De Fabulant', boss: true, model: {kind: 'fabulant'}, color: 0xc7a0ff, hp: 840, speed: 1.5, weak: 'lamp', dmg: 14,
    attack: 'custom', aimY: 2.2, r: 1.4, h: 4.2, heavy: true, fly: true, wake: 30, noDrop: true,
    lesson: 'Vertrouwen verdien je met bewijs: toetsen wat de assistent zegt, afwegen wie hij mist en begrenzen wat hij mag.',
    init(e) { e.phase = 1; e.t1 = 2; e.t2 = 6; e.burnT = 0; e.copies = []; e.scrollsMax = chamberState('quality') === 'strong' ? 5 : 8; e.regrowT = 0; setScrolls(e, e.scrollsMax); },
    onReveal(e) {
      if (e.phase !== 1) return;
      setScrolls(e, 0); e.burnT = 7; bark(e, 'Mijn bronnen! Die waren… vrij overtuigend!');
      FX.burst(e.x, 2.4, e.z, 60, {color: [0xf4ecd8, 0xffd36b], speed: 6, life: 1});
    },
    damageFilter(e, tool, mult) {
      if (e.phase === 1 && visibleScrolls(e) > 0) return 0;
      if (e.phase === 3 && sockets().some(s => !s.sealed)) return 0;
      return mult;
    },
    onHit(e, tool) {
      if (e.phase === 1 && visibleScrolls(e) > 0 && !e.hint1) { e.hint1 = true; UI.pip('Die rollen om hem heen zijn nepbronnen. Laat het licht openbarsten (R) als je dichtbij bent!'); }
      if (e.phase === 3 && sockets().some(s => !s.sealed) && !e.hint3) { e.hint3 = true; UI.pip('Zolang zijn ranken in de wanden zitten, kan hij overal bij. Verzegel de vier aansluitingen (3)!'); }
    },
    update(e, dt) {
      const ph = e.phase;
      // phase changes
      if (ph === 1 && e.hp <= e.maxHp * 2 / 3) startPhase(e, 2);
      else if (ph === 2 && e.hp <= e.maxHp / 3) startPhase(e, 3);
      const label = e.phase === 1 ? (visibleScrolls(e) ? 'Fase 1 · Toetsen: hij schuilt achter nepbronnen · onthul (R)' : 'Zijn bronnen branden: toets hem (1)!')
        : e.phase === 2 ? 'Fase 2 · Wegen: welke is echt? De Weegschaal (2) laat het zien'
          : (sockets().some(s => !s.sealed) ? `Fase 3 · Begrenzen: verzegel de aansluitingen (3) · ${sockets().filter(s => !s.sealed).length} over` : 'Hij kan nergens meer bij: verzegel hem (3)!');
      bossBar(e, label);
      e.st.spin = e.phase === 1 ? 0.8 : 0.2;
      e.st.exposed = (e.phase === 1 && !visibleScrolls(e)) || (e.phase === 3 && !sockets().some(s => !s.sealed));
      if (e.phase === 1 && e.burnT > 0) { e.burnT -= dt; if (e.burnT <= 0) e.regrowT = 0; }
      if (e.phase === 1 && e.burnT <= 0) { e.regrowT -= dt; if (e.regrowT <= 0 && visibleScrolls(e) < e.scrollsMax) { e.regrowT = 1.4; setScrolls(e, visibleScrolls(e) + 1); } }
      if (e.phase === 3) { updateTendrils(e); if (sockets().some(s => !s.sealed) && e.hp < e.maxHp / 3) e.hp = Math.min(e.maxHp / 3, e.hp + dt * 3); }
      if (!e.aware) return;
      e.t1 -= dt; e.t2 -= dt;
      if (e.t1 <= 0) { fan(e, e.phase === 3 ? 5 : 3, 0.25, {color: 0xffd36b, dmg: 9, speed: 9, homing: 1.2}); e.t1 = e.phase === 2 ? 3.2 : 2.6; if (Math.random() < 0.5) bark(e, FAB_LINES[Math.floor(Math.random() * FAB_LINES.length)]); }
      if (e.t2 <= 0) {
        e.t2 = e.phase === 1 ? 9 : 11;
        const few = chamberState('ethics') === 'strong';
        if (e.phase === 1) summon(e, 'halluc', 2, 3);
        if (e.phase === 2) { summon(e, 'bias', few ? 1 : 2, 3); summon(e, 'haste', few ? 1 : 2, 3); if (!e.copies.some(c => c.alive)) makeCopies(e); }
        if (e.phase === 3) { summon(e, 'whisper', few ? 2 : 3, 5); warn(e.x, e.z, 6, 1.2); setTimeout(() => { if (e.alive && distP(e) < 6 && !calm()) hurtPlayer(12, e.x, e.z); ringFx(e.x, 0.1, e.z, 6, 0xc7a0ff, 0.6, true); }, 1200); }
      }
      // keep some distance and drift around the arena
      e.speedMul = distP(e) < 5 ? -0.6 : 1;
    }},
  fabulantCopy: {name: 'De Fabulant?', model: {kind: 'fabulant', color: 0xc0c8d8}, color: 0xc7a0ff, hp: 30, speed: 1.6, weak: 'scale', dmg: 9,
    attack: 'custom', aimY: 2.2, r: 1.3, h: 4.2, fly: true, heavy: true, noDrop: true, hiddenInBook: true, wake: 30,
    lesson: 'Een overtuigend verhaal kan meerdere gezichten hebben.',
    damageFilter(e, tool, mult) { return tool === 'scale' ? 10 : 0; },
    onHit(e, tool) { if (tool !== 'scale' && !e.hint) { e.hint = true; UI.pip('Daar gaat je licht dwars doorheen. Is dit wel de echte? Weeg het af (2).'); } },
    onDeath(e) { UI.number(e.x, e.y + 3, e.z, 'Gewogen en te licht bevonden', '#c7a0ff', false); },
    update(e, dt) {
      e.t1 = (e.t1 ?? 2 + Math.random() * 2) - dt;
      if (e.aware && e.t1 <= 0) { e.t1 = 3.4; fan(e, 2, 0.3, {color: 0xd8ccff, dmg: 6, speed: 9}); }
      e.speedMul = distP(e) < 5 ? -0.6 : 1;
    }},
};

const FAB_LINES = ['Ik weet het antwoord op elke vraag!', 'Of iets wat erop lijkt.', 'Volgens mijn bronnen heb jij ongelijk.', 'Ik klink zeker, dus ik ben het ook.', 'Wie heeft er nu een mens nodig?', 'Ik heb het nagekeken. Bij mezelf.'];
function visibleScrolls(e) { return e.model.parts.scrolls.filter(s => s.visible).length; }
function setScrolls(e, n) { e.model.parts.scrolls.forEach((s, i) => { s.visible = i < n; }); }
function sockets() { return W.ents.filter(o => o.def?.kind === 'socket'); }
function makeCopies(e) {
  e.copies = [];
  for (const a of [Math.PI * 0.66, -Math.PI * 0.66]) {
    const c = spawnEnemy('fabulantCopy', e.x + Math.cos(a) * 5, e.z + Math.sin(a) * 5, {aware: true});
    if (c) { c.def.respawn = true; c.group = null; e.copies.push(c); FX.burst(c.x, 2, c.z, 30, {color: 0xc7a0ff, speed: 4, life: 0.8}); }
  }
}
function startPhase(e, n) {
  e.phase = n; e.t2 = 1.5;
  FX.burst(e.x, 2.4, e.z, 80, {color: [0xc7a0ff, 0xffd36b, 0xffffff], speed: 7, life: 1.2});
  SFX.play('thunder'); PL.shake = Math.max(PL.shake, 0.5);
  if (n === 2) { setScrolls(e, 0); e.def.weak = 'scale'; makeCopies(e); bark(e, 'Er is niet één waarheid. Er zijn er drie. En ze zijn allemaal mij.'); UI.pip(chamberState('ethics') === 'strong' ? 'Je weet nu wie hij overslaat. Weeg ze af: alleen de echte heeft gewicht (2).' : 'Drie Fabulanten! Alleen de echte heeft gewicht. Gebruik de Weegschaal (2).'); }
  if (n === 3) {
    for (const c of e.copies) if (c.alive) { c.alive = false; c.dieT = 0; }
    e.def.weak = 'seal';
    for (const s of sockets()) { s.sealed = false; s.hits = 0; s.setVisible(true); }
    bark(e, 'Geef me toegang. Tot alles. Dan help ik je echt.');
    UI.pip(chamberState('security') === 'strong' ? 'Hij grijpt naar alle systemen. Je weet hoe je dat begrenst: verzegel de aansluitingen!' : 'Hij grijpt met zijn ranken naar de archieven, de post, de betalingen! Verzegel de vier aansluitingen (3).');
  }
}
const tendrils = new Map();
function updateTendrils(e) {
  for (const s of sockets()) {
    let line = tendrils.get(s);
    if (!line) {
      line = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1, 6, 1, true), new THREE.MeshBasicMaterial({color: 0xc7a0ff, transparent: true, opacity: 0.8, toneMapped: false}));
      R.scene.add(line); tendrils.set(s, line);
    }
    line.visible = !s.sealed && e.alive;
    if (!line.visible) continue;
    const a = new THREE.Vector3(e.x, e.y + 2.4, e.z), b = new THREE.Vector3(s.x, 1.6, s.z), mid = a.clone().add(b).multiplyScalar(0.5);
    line.position.copy(mid); line.scale.set(1, a.distanceTo(b), 1);
    line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    line.material.opacity = 0.55 + Math.sin(R.time * 9 + s.x) * 0.25;
  }
}
export function clearTendrils() { for (const l of tendrils.values()) R.scene.remove(l); tendrils.clear(); }
void ent; void G; void damage; void barkT;

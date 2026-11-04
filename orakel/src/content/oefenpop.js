// De oefenpop: a harmless practice dummy for the oefenlokaal (content/story/tutorial.js).
// A stack of ordners with a cardboard head and a friendly face, on a wobbly post. It never moves,
// never attacks and never falls over for good: every blow refills it, and it wobbles a bit.
// Registered into BEASTS by content/index.js; the tutorial listens with onDummyHit().
// Light imports only, so the unit tests can load it in Node.
import {UI, P} from '../game/bus.js';
import {dampAngle} from '../core/util.js';

const LISTENERS = [];
// fn(tool, e): called for every blow that lands on an oefenpop ('lamp', 'scale', 'seal', or whatever an ability uses)
export function onDummyHit(fn) { LISTENERS.push(fn); return () => { const i = LISTENERS.indexOf(fn); if (i >= 0) LISTENERS.splice(i, 1); }; }

const QUIPS = ['Au! Niet echt, hoor.', 'Raak!', 'Oef!', 'Netjes!', 'Nog een keer?', 'Ik voel er niks van.', 'Keurig gemikt.', 'Dat telt!'];
const TOOL_QUIP = {lamp: 'Toetsstraal!', scale: 'Even wegen…', seal: 'Gestempeld!'};

function build(e) {
  const k = e.model.kit, root = e.model.root;
  // the foot stays put, everything above it wobbles around the base
  k.cyl(root, 0.42, 0.12, 0x6e4a2c, 0, 0.06, 0);
  k.cyl(root, 0.3, 0.06, 0x8a5e38, 0, 0.15, 0);
  const body = k.pivot(root, 0, 0.16, 0);
  k.box(body, 0.12, 0.62, 0.12, 0x9a7a52, 0, 0.31, 0);
  // the torso: three ordners in office colours, with white spines and a target on the middle one
  const colors = [0x2f6fb0, 0xc84a3a, 0x3a9a5a];
  colors.forEach((c, i) => {
    const y = 0.76 + i * 0.3, ry = (i - 1) * 0.07;
    k.box(body, 0.66, 0.28, 0.44, c, 0, y, 0, {ry});
    k.box(body, 0.06, 0.2, 0.02, 0xf4ecd8, -0.2, y, 0.225, {ry});
  });
  k.box(body, 0.22, 0.22, 0.02, 0xfff4e0, 0.08, 1.06, 0.232);
  k.box(body, 0.12, 0.12, 0.022, 0xd04030, 0.08, 1.06, 0.236, {basic: true});
  // arms of rolled-up paper, a little lopsided
  const armL = k.pivot(body, -0.4, 1.28, 0), armR = k.pivot(body, 0.4, 1.28, 0);
  k.box(armL, 0.12, 0.5, 0.12, 0xf0e6cc, 0, -0.22, 0, {rz: 0.35});
  k.box(armR, 0.12, 0.5, 0.12, 0xf0e6cc, 0, -0.22, 0, {rz: -0.35});
  // the head: a cardboard box with a drawn smile and rosy cheeks
  const head = k.pivot(body, 0, 1.42, 0);
  k.box(head, 0.48, 0.42, 0.44, 0xc8a070, 0, 0.21, 0);
  k.box(head, 0.5, 0.04, 0.46, 0xb08a58, 0, 0.42, 0);
  for (const sx of [-0.1, 0.1]) k.box(head, 0.07, 0.09, 0.02, 0x2a1a10, sx, 0.26, 0.225);
  k.box(head, 0.2, 0.04, 0.02, 0x2a1a10, 0, 0.13, 0.225);
  for (const sx of [-0.12, 0.12]) k.box(head, 0.05, 0.04, 0.02, 0x2a1a10, sx, 0.155, 0.225);
  for (const sx of [-0.17, 0.17]) k.box(head, 0.06, 0.04, 0.021, 0xf08a8a, sx, 0.19, 0.226);
  e.parts = {body, head, armL, armR};
  e.wob = {a: 0, v: 0, side: 1};
  e.model.height = 2.1;
  e.model.animate = (dt, st) => {
    // a damped spring: a blow kicks it, it sways back to rest
    const w = e.wob;
    w.v += (-w.a * 60 - w.v * 5) * dt; w.a += w.v * dt;
    body.rotation.x = w.a * 0.9;
    body.rotation.z = w.a * 0.35 * w.side;
    head.rotation.z = Math.sin(st.t * 1.3) * 0.04 - w.a * 0.4 * w.side;
    armL.rotation.z = Math.sin(st.t * 1.7) * 0.06 + w.a * 0.8;
    armR.rotation.z = -Math.sin(st.t * 1.9) * 0.06 - w.a * 0.8;
  };
}

export const OEFEN_DEFS = {
  oefenpop: {name: 'Oefenpop', model: {kind: 'none'}, color: 0xffd36b, hp: 9999, speed: 0, dmg: 0, attack: 'custom',
    aimY: 1.4, r: 0.5, h: 2.1, heavy: true, noDrop: true, hiddenInBook: true,
    init(e) { build(e); e.quipT = 0; },
    update(e, dt) {
      // never part of a fight: no combat music, always looking at you, always in its place
      e.aware = false; e.state = 'idle'; e.vx = e.vz = 0;
      e.quipT = Math.max(0, (e.quipT || 0) - dt);
      e.yaw = dampAngle(e.yaw, Math.atan2(P.x - e.x, P.z - e.z), 2.5, dt);
      return 'skipMove';
    },
    onHit(e, tool, dmg) {
      e.hp = e.maxHp;
      const w = e.wob;
      if (w) { w.v += tool === 'seal' ? 6 : tool === 'scale' ? 4 : 3; w.side = Math.random() < 0.5 ? -1 : 1; }
      if (!e.quipT) { e.quipT = 1.1; UI.number(e.x, e.y + 2.5, e.z, TOOL_QUIP[tool] && Math.random() < 0.6 ? TOOL_QUIP[tool] : QUIPS[Math.floor(Math.random() * QUIPS.length)], '#ffe2a6', false); }
      for (const fn of LISTENERS.slice()) { try { fn(tool, e, dmg); } catch (err) { console.warn('oefenpop', err); } }
    },
  },
};

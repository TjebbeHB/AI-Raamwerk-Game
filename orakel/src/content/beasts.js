// The monsters of the Gewelf. Each one is a risk from the framework, and weak to one tool.
import {P, UI, SFX} from '../game/bus.js';
import {spawnEnemy, damage, C} from '../game/combat.js';
import {FX} from '../engine/particles.js';

const near = (e, type, r) => C.enemies.filter(o => o !== e && o.alive && o.type === type && Math.hypot(o.x - e.x, o.z - e.z) < r);

export const BEAST_DEFS = {
  demo: {name: 'Demo-dwaallicht', model: {kind: 'wisp', color: 0xffd36b, tag: true}, color: 0xffd36b, hp: 22, speed: 3.2, weak: 'lamp', dmg: 8,
    attack: 'swoop', range: 4.2, attackRange: 4.5, windup: 0.6, lunge: 10, strikeT: 0.35, fly: true, aimY: 1.3, r: 0.42, h: 1.2, light: true,
    lesson: 'Een demo laat het mooiste geval zien. Toets beloftes met jullie eigen, representatieve testvragen.'},
  halluc: {name: 'Hallucinaatje', model: {kind: 'wisp', color: 0xfff1b8}, color: 0xfff1b8, hp: 16, speed: 2.6, weak: 'lamp', dmg: 7,
    attack: 'ranged', range: 9, attackRange: 10, keep: 6, windup: 0.7, rate: 1.8, fly: true, aimY: 1.3, r: 0.38, h: 1.2, light: true, shotColor: 0xffe08a,
    lesson: 'Een taalmodel kan overtuigend klinkende onzin maken. Laat bronnen zien en toets antwoorden op een vaste vragenset.'},
  haste: {name: 'Haastkobold', model: {kind: 'imp', color: 0xff8a5c, watch: true}, color: 0xff8a5c, hp: 26, speed: 4.8, weak: 'scale', dmg: 9,
    attack: 'melee', range: 1.3, windup: 0.38, rate: 1.1, aimY: 0.8, r: 0.42, h: 1.3,
    lesson: '‘Binnen zes weken live’ is geen reden om stappen over te slaan. Tijdsdruk vraagt juist om een bewuste afweging.'},
  leak: {name: 'Datalekslijm', model: {kind: 'slime', color: 0x7fe0a4, files: true}, color: 0x7fe0a4, hp: 30, speed: 2.3, weak: 'seal', dmg: 10,
    attack: 'leap', range: 3.2, attackRange: 3.4, windup: 0.7, lunge: 8, strikeT: 0.35, aimY: 0.5, r: 0.55, h: 1.0,
    lesson: 'Persoonsgegevens in prompts en logs lekken makkelijk weg. Bescherm ze met minimale gegevens, afspraken en toegangsrechten.',
    onDeath(e) {
      if (e.lastTool === 'seal') return;
      // not sealed: the leak spreads
      for (let k = 0; k < 2; k++) spawnEnemy('leaklet', e.x + (k ? 0.7 : -0.7), e.z, {group: e.group, aware: true});
      UI.pip('Het lek verspreidt zich. Met het Zegel (3) dicht je het in één keer.');
    }},
  leaklet: {name: 'Lekje', model: {kind: 'slime', color: 0x9ff0bc, size: 0.55}, color: 0x9ff0bc, hp: 10, speed: 3.4, weak: 'seal', dmg: 5,
    attack: 'leap', range: 2.5, attackRange: 2.6, windup: 0.5, lunge: 9, aimY: 0.3, r: 0.32, h: 0.6, light: true, hiddenInBook: true, noDrop: true,
    lesson: 'Een klein lek is ook een lek.'},
  bias: {name: 'Vooroordeelschim', model: {kind: 'shade', color: 0xb48cff}, color: 0xb48cff, hp: 36, speed: 2.4, weak: 'scale', dmg: 11,
    attack: 'melee', range: 1.6, windup: 0.55, rate: 1.5, aimY: 1.2, r: 0.5, h: 2.1,
    lesson: 'Een assistent kan groepen ongelijk behandelen zonder dat iemand het merkt. Test met verschillende formuleringen en laat mensen afwegen.',
    update(e, dt) {
      // it fades in and out of sight, unless the lamp has shown it
      const vis = e.exposed > 0 || e.aware && e.state === 'windup' ? 1 : 0.25 + 0.75 * Math.max(0, Math.sin(e.st.t * 0.9 + e.id));
      e.fade = vis;
      if (e.model.rim) e.model.rim.uniforms.uFade.value = vis;
      e.hidden = vis < 0.35;
    }},
  buck: {name: 'Doorschuiver', model: {kind: 'shade', color: 0xa0a0b0, core: 0x16161c, folder: true}, color: 0xa0a0b0, hp: 28, speed: 2.6, weak: 'scale', dmg: 8,
    attack: 'melee', range: 1.5, windup: 0.5, rate: 1.4, aimY: 1.2, r: 0.5, h: 2.1,
    lesson: 'Als iedereen naar een ander wijst, draagt niemand verantwoordelijkheid. Leg eigenaarschap per taak vast.',
    damageFilter(e, tool, mult, amount) {
      if (tool === 'scale' || tool === 'pass') return mult;
      const other = near(e, 'buck', 9)[0];
      if (!other) return mult;
      // ‘niet mijn afdeling’: the blow lands on a colleague instead
      setTimeout(() => damage(other, Math.round(amount * 0.4), 'pass'), 120);
      FX.burst(e.x, e.y + 1.4, e.z, 10, {color: 0xd04030, speed: 2, life: 0.5});
      UI.number(e.x, e.y + 2.4, e.z, 'Niet mijn afdeling!', '#ff9a8a', false);
      if (!e.def.hinted) { e.def.hinted = true; UI.pip('Ze schuiven het naar elkaar door! Raak ze allemaal tegelijk, met de Weegschaal (2).'); }
      return 0;
    }},
  inject: {name: 'Injectie-imp', model: {kind: 'imp', color: 0x8fd0ff, dark: 0x1a3a5a, letter: true}, color: 0x8fd0ff, hp: 22, speed: 3.2, weak: 'seal', dmg: 6,
    attack: 'ranged', range: 8, attackRange: 9, keep: 5, windup: 0.6, rate: 2.2, aimY: 0.8, r: 0.42, h: 1.3, shotColor: 0x8fd0ff,
    lesson: 'Verborgen instructies in documenten kunnen een assistent misleiden. Begrens rechten en behandel invoer als onbetrouwbaar.',
    onShotHit() { P.inverted = 2.2; UI.pip('Een verborgen instructie! Je besturing staat even op z’n kop.'); }},
  whisper: {name: 'Fluisteraar', model: {kind: 'imp', color: 0x5a6a9a, dark: 0x1a1a2a, letter: true}, color: 0x8a9ad8, hp: 12, speed: 4.4, weak: 'seal', dmg: 5,
    attack: 'melee', range: 1.1, windup: 0.3, rate: 0.9, aimY: 0.6, r: 0.34, h: 1.0, light: true, drop: 0.12,
    lesson: 'Een regel in de systeemprompt houdt fluisteraars niet tegen. Minimale rechten en begrensde tools wel.'},
  golem: {name: 'Papiergolem', model: {kind: 'golem', size: 1}, color: 0xf0e6cc, hp: 80, speed: 1.6, weak: 'lamp', dmg: 16,
    attack: 'melee', range: 2.2, attackRange: 2.4, windup: 0.95, rate: 2.2, aimY: 1.5, r: 0.85, h: 2.4, heavy: true, drop: 0.6,
    lesson: 'Een stapel ongetoetste documenten is een monster op zich. Toets wat erin staat voordat je erop bouwt.',
    onStrike(e) { FX.ring(e.x, 0.2, e.z, 0.5, 20, {color: 0xf0e6cc, additive: false, speed: 5, life: 0.4, s0: 0.2}); }},
  echo: {name: 'Ik-begrijp-u-echo', model: {kind: 'wisp', color: 0x8fb7ff}, color: 0x8fb7ff, hp: 20, speed: 3.0, weak: 'scale', dmg: 7,
    attack: 'swoop', range: 4, attackRange: 4.2, windup: 0.6, lunge: 9, fly: true, aimY: 1.3, r: 0.4, h: 1.2, light: true,
    lesson: 'Gevoelens veinzen is geen hulp. Een goede balie is eerlijk over wat hij kan en wijst de weg naar een mens.',
    onStrike(e) { UI.number(e.x, e.y + 2.1, e.z, 'Ik begrijp u.', '#bcd4ff', false); }},
  worm: {name: 'Wachtrijworm', model: {kind: 'worm', color: 0xc8b8ff}, color: 0xc8b8ff, hp: 70, speed: 2.0, weak: 'scale', dmg: 12,
    attack: 'melee', range: 1.6, windup: 0.6, rate: 1.6, aimY: 0.6, r: 0.6, h: 1.0, heavy: true, noYaw: true, drop: 0.6,
    lesson: 'Een piek los je niet op door alles in dezelfde rij te zetten. Routeer eenvoudige vragen langs een lichte route.',
    init(e) { e.trail = []; },
    update(e, dt) {
      e.trail.unshift({x: e.x, z: e.z});
      if (e.trail.length > 90) e.trail.length = 90;
      const segs = e.model.parts.segs;
      const yaw = Math.atan2(e.vx, e.vz);
      segs[0].rotation.y = yaw;
      for (let i = 1; i < segs.length; i++) {
        const t = e.trail[Math.min(e.trail.length - 1, i * 6)] || e;
        segs[i].position.x = t.x - e.x; segs[i].position.z = t.z - e.z;
        const p = e.trail[Math.min(e.trail.length - 1, i * 6 - 3)] || t;
        segs[i].rotation.y = Math.atan2(p.x - t.x, p.z - t.z);
      }
    }},
  token: {name: 'Tokenvreter', model: {kind: 'slime', color: 0xffb070, dark: 0x8a4a1a, size: 1.25}, color: 0xffb070, hp: 44, speed: 1.9, weak: 'seal', dmg: 12,
    attack: 'leap', range: 3, attackRange: 3.2, windup: 0.8, lunge: 7, aimY: 0.7, r: 0.7, h: 1.2, drop: 0.5,
    lesson: 'Elke vraag met de volledige gesprekshistorie naar het grootste model: dat vreet energie. Begrens context en kies de lichtste route.',
    update(e, dt) {
      e.sealedT = Math.max(0, (e.sealedT || 0) - dt);
      if (e.aware && !e.sealedT && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + dt * 3);
      const s = 0.8 + 0.4 * (e.hp / e.maxHp);
      e.model.root.scale.setScalar(s);
    },
    onHit(e, tool) { if (tool === 'seal') e.sealedT = 4; }},
  lockin: {name: 'Vastzitkist', model: {kind: 'golem', size: 0.6, color: 0xb08458, eye: 0xffd36b, stamp: true}, color: 0xb08458, hp: 45, speed: 3.4, weak: 'lamp', dmg: 10,
    attack: 'melee', range: 1.4, windup: 0.45, rate: 1.3, aimY: 0.7, r: 0.55, h: 1.4, wake: 3.2, drop: 0.5,
    lesson: 'Wie alles in één platform stopt, kan er niet meer uit. Maak data, prompts en evaluaties overdraagbaar en oefen een overstap.',
    onStrike(e) { if (Math.hypot(P.x - e.x, P.z - e.z) < 2.2) { P.slowT = 2; UI.number(P.x, P.y + 2.2, P.z, 'Vastgezet!', '#ffd36b', false); } }},
};

// keep track of which tool landed the last blow (the leak needs a seal to stay shut)
export function trackLastTool() {
  for (const def of Object.values(BEAST_DEFS)) {
    const prev = def.onHit;
    def.onHit = (e, tool, dmg) => { e.lastTool = tool; prev?.(e, tool, dmg); };
  }
}
void SFX;

// Floors are written as ASCII maps. One character is one 2 x 2 m tile.
// Fixed tiles:   #/X wall · . floor · , carpet · ; second floor style · _ chasm · = bridge
//                ~ water · o pillar · : dais (low platform) · t wall with a torch
// Fixed props:   b barrel · c crate · k bookcase · d table · s chair · a archive cabinet
//                p plant · u urn · r rubble · y paper stack · f bench · e machine · l candles
// Entities:      upper-case letters (and @ < >) take their settings from the floor's legend,
//                one array entry per occurrence in reading order (top to bottom, left to right).
// Pure module: no three.js, no DOM, so the content tests can parse every floor in Node.

export const T = {SOLID: 0, FLOOR: 1, CHASM: 2, BRIDGE: 3, WATER: 4, PILLAR: 5, DAIS: 6, DOOR: 7, HIDDEN: 8, ILLUSION: 9, GATE: 10, CARPET: 11, ALT: 12};
export const DIRS = {n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2};
const TILE_CHARS = {'#': T.SOLID, X: T.SOLID, ' ': T.SOLID, t: T.SOLID, '.': T.FLOOR, ',': T.CARPET, ';': T.ALT, _: T.CHASM, '=': T.BRIDGE, '~': T.WATER, o: T.PILLAR, ':': T.DAIS};
export const PROP_CHARS = {b: 'barrel', c: 'crate', k: 'bookcase', d: 'table', s: 'chair', a: 'cabinet', p: 'plant', u: 'urn', r: 'rubble', y: 'papers', f: 'bench', e: 'machine', l: 'candles'};
// entity letter -> [entity type, tile underneath]
export const ENTITY_CHARS = {
  '@': ['arrival', T.FLOOR], '<': ['stairs', T.FLOOR], '>': ['stairs', T.FLOOR],
  D: ['door', T.DOOR], G: ['gate', T.GATE], S: ['illusion', T.ILLUSION], H: ['hidden', T.HIDDEN],
  N: ['npc', T.FLOOR], E: ['enemy', T.FLOOR], C: ['chest', T.FLOOR], I: ['item', T.FLOOR], K: ['coffee', T.FLOOR],
  L: ['lever', T.FLOOR], P: ['plate', T.FLOOR], B: ['crate', T.FLOOR], Q: ['object', T.FLOOR], R: ['prop', T.FLOOR],
  M: ['sign', T.FLOOR], F: ['fire', T.FLOOR], T: ['trigger', T.FLOOR], V: ['vista', T.FLOOR],
};
// tiles a walker can stand on (doors and gates are walkable unless their entity blocks them)
export const WALKABLE = new Set([T.FLOOR, T.CARPET, T.ALT, T.BRIDGE, T.WATER, T.DAIS, T.DOOR, T.GATE]);

export function parseFloor(def) {
  const rows = def.map.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n');
  const W = Math.max(...rows.map(r => r.length)), H = rows.length;
  const errors = [];
  rows.forEach((r, z) => { if (r.length !== W) errors.push(`${def.id}: row ${z} is ${r.length} wide, expected ${W}`); });
  const tiles = new Uint8Array(W * H), props = [], entities = [], torches = [];
  const counters = {};
  const legend = def.legend || {};
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const ch = rows[z][x] ?? ' ', i = z * W + x;
    if (ch in TILE_CHARS) {
      tiles[i] = TILE_CHARS[ch];
      if (ch === 't') torches.push({x, z});
    } else if (ch in PROP_CHARS) {
      tiles[i] = T.FLOOR;
      props.push({kind: PROP_CHARS[ch], x, z});
    } else if (ch in ENTITY_CHARS) {
      const [type, under] = ENTITY_CHARS[ch];
      const n = counters[ch] = (counters[ch] ?? -1) + 1;
      const list = legend[ch];
      let data = Array.isArray(list) ? list[n] : undefined;
      if (data === undefined) errors.push(`${def.id}: '${ch}' #${n + 1} at ${x},${z} has no legend entry`);
      if (typeof data === 'string') data = {id: data};
      data = {...(data || {})};
      tiles[i] = data.on !== undefined ? TILE_CHARS[data.on] ?? under : under;
      entities.push({type, ch, x, z, ...data, ...(ch === '<' || ch === '>' ? {down: ch === '>'} : {})});
    } else {
      errors.push(`${def.id}: unknown character '${ch}' at ${x},${z}`);
      tiles[i] = T.SOLID;
    }
  }
  for (const [ch, list] of Object.entries(legend)) {
    if (Array.isArray(list) && (counters[ch] ?? -1) + 1 !== list.length) errors.push(`${def.id}: legend '${ch}' has ${list.length} entries but the map has ${(counters[ch] ?? -1) + 1}`);
  }
  // zones: rectangles [x0, z0, x1, z1] (inclusive); the first match wins
  const zones = (def.zones || []).map((zn, k) => ({...def.defaults, ...zn, tint: {...def.defaults?.tint, ...zn.tint}, index: k}));
  const base = {...def.defaults, tint: {...def.defaults?.tint}, name: def.name, id: '_', index: -1};
  const zoneOf = new Int16Array(W * H).fill(-1);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const k = zones.findIndex(zn => x >= zn.r[0] && x <= zn.r[2] && z >= zn.r[1] && z <= zn.r[3]);
    zoneOf[z * W + x] = k;
  }
  const zoneAt = (x, z) => { const k = x < 0 || z < 0 || x >= W || z >= H ? -1 : zoneOf[z * W + x]; return k < 0 ? base : zones[k]; };
  // heights
  const floorY = new Float32Array(W * H), ceilY = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, z = (i / W) | 0, zn = zoneAt(x, z), t = tiles[i];
    floorY[i] = t === T.DAIS ? 0.3 : t === T.WATER ? -0.45 : 0;
    ceilY[i] = (t === T.DOOR ? Math.min(zn.ceilH ?? 4, zn.doorH ?? 3.2) : zn.ceilH ?? 4);
  }
  const arrivals = {};
  for (const e of entities) if (e.type === 'arrival') arrivals[e.id] = {x: e.x, z: e.z, yaw: DIRS[e.dir || 'n'] ?? 0};
  return {id: def.id, def, W, H, tiles, props, entities, torches, zones, base, zoneOf, zoneAt, floorY, ceilY, arrivals, errors};
}

export const inside = (L, x, z) => x >= 0 && z >= 0 && x < L.W && z < L.H;
export const tileAt = (L, x, z) => (inside(L, x, z) ? L.tiles[z * L.W + x] : T.SOLID);
export const isOpen = t => t !== T.SOLID && t !== T.ILLUSION;

// Reachability for the content tests: which tiles can be reached from a start tile,
// given a set of door/gate ids that are open and whether hidden paths are revealed.
export function reachable(L, sx, sz, {open = () => true, revealed = true, blocked = () => false} = {}) {
  const seen = new Uint8Array(L.W * L.H), q = [[sx, sz]];
  const doorAt = new Map();
  for (const e of L.entities) if (e.type === 'door' || e.type === 'gate') doorAt.set(e.z * L.W + e.x, e);
  seen[sz * L.W + sx] = 1;
  while (q.length) {
    const [x, z] = q.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!inside(L, nx, nz)) continue;
      const i = nz * L.W + nx;
      if (seen[i]) continue;
      const t = L.tiles[i];
      let ok = WALKABLE.has(t) || (revealed && (t === T.HIDDEN || t === T.ILLUSION));
      if (t === T.PILLAR) ok = false;
      const d = doorAt.get(i);
      if (d && !open(d)) ok = false;
      if (ok && blocked(nx, nz)) ok = false;
      if (!ok) continue;
      seen[i] = 1;
      q.push([nx, nz]);
    }
  }
  return seen;
}

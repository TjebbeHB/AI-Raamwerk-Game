import {ENTITY_CHARS} from '../engine/level.js';

// A small builder for floor maps: carve rooms, stamp ASCII blocks, place entities with
// their settings. build() emits the map string and the legend arrays in reading order.
export class MapBuilder {
  constructor(w, h, fill = '#') {
    this.w = w; this.h = h;
    this.g = Array.from({length: h}, () => Array(w).fill(fill));
    this.data = new Map();          // "x,z" -> entity settings
  }
  inside(x, z) { return x >= 0 && z >= 0 && x < this.w && z < this.h; }
  put(x, z, ch, data) {
    if (!this.inside(x, z)) throw new Error(`put outside the map: ${x},${z}`);
    this.g[z][x] = ch;
    if (data !== undefined) this.data.set(`${x},${z}`, data); else this.data.delete(`${x},${z}`);
    return this;
  }
  get(x, z) { return this.inside(x, z) ? this.g[z][x] : '#'; }
  rect(x0, z0, x1, z1, ch = '.') { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.put(x, z, ch); return this; }
  // a room: floor inside, optional wall ring around it
  room(x0, z0, x1, z1, {floor = '.', wall = null} = {}) {
    if (wall) this.rect(x0 - 1, z0 - 1, x1 + 1, z1 + 1, wall);
    return this.rect(x0, z0, x1, z1, floor);
  }
  // stamp an ASCII block; letters listed in `legend` take their data in reading order inside the block
  stamp(x, z, block, legend = {}) {
    const rows = block.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n');
    const count = {};
    rows.forEach((row, dz) => [...row].forEach((ch, dx) => {
      if (ch === '?') return;                          // '?' leaves the tile as it was
      const data = legend[ch] ? legend[ch][count[ch] = (count[ch] ?? -1) + 1] : undefined;
      if (legend[ch] && data === undefined) throw new Error(`stamp at ${x},${z}: no legend data for '${ch}' #${count[ch] + 1}`);
      this.put(x + dx, z + dz, ch, data);
    }));
    for (const [ch, list] of Object.entries(legend)) if ((count[ch] ?? -1) + 1 !== list.length) throw new Error(`stamp at ${x},${z}: legend '${ch}' has ${list.length} entries, block has ${(count[ch] ?? -1) + 1}`);
    return this;
  }
  ent(x, z, ch, data = {}) { return this.put(x, z, ch, data); }
  build() {
    const legend = {};
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) {
      const k = `${x},${z}`, ch = this.g[z][x];
      if (!this.data.has(k) && !(ch in ENTITY_CHARS)) continue;
      (legend[ch] ||= []).push(this.data.get(k) ?? {});
    }
    return {map: '\n' + this.g.map(r => r.join('')).join('\n') + '\n', legend};
  }
  print() { return this.g.map(r => r.join('')).join('\n'); }
}

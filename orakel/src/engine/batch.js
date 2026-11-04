// Static geometry is collected in a Batch: one merged mesh per material, with
// per-vertex albedo tint (colour) and baked torch light (aBake). Props are built in a
// local "frame" (position + yaw) so their builders can think in their own coordinates.
import * as THREE from 'three';

const SHARED = {uBake: {value: Math.PI}, uTime: {value: 0}, uReveal: {value: new THREE.Vector4(0, 0, 0, 0)}};
export const SHARED_UNIFORMS = SHARED;

// Lambert with baked irradiance added to the indirect light. Dynamic point lights
// (the lantern, nearby torches, spells) still light it on top.
export function bakedMaterial(params = {}) {
  const m = new THREE.MeshLambertMaterial({vertexColors: true, ...params});
  m.onBeforeCompile = sh => {
    sh.uniforms.uBake = SHARED.uBake;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aBake;\nvarying vec3 vBake;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBake = aBake;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBake;\nuniform float uBake;')
      .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\nirradiance += vBake * uBake;');
  };
  m.customProgramCacheKey = () => 'baked-lambert';
  return m;
}

// Dynamic things (people, monsters, doors) sample the baked light where they stand.
// Opt-in {glow: true}: the geometry carries a float attribute aGlow (0..1) that lets single
// voxels shine in their own vertex colour (eye highlights, gold, hi-vis stripes), so a whole
// merged figure stays one draw call. Use it together with params.vertexColors.
export function probedMaterial(params = {}, probe, {glow = false} = {}) {
  const m = new THREE.MeshLambertMaterial(params);
  m.userData.probe = probe;
  m.onBeforeCompile = sh => {
    sh.uniforms.uProbe = probe;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uProbe;')
      .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\nirradiance += uProbe;');
    if (glow) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow;');
    }
  };
  m.customProgramCacheKey = () => (glow ? 'probed-lambert-glow' : 'probed-lambert');
  return m;
}

class Group {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
}

export class Batch {
  constructor() {
    this.groups = new Map();
    this.m = new THREE.Matrix4();
    this.nm = new THREE.Matrix3();
    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3();
  }
  group(key) { let g = this.groups.get(key); if (!g) { g = new Group(); this.groups.set(key, g); } return g; }
  // local frame for props
  frame(x = 0, y = 0, z = 0, yaw = 0) { this.m.makeRotationY(yaw).setPosition(x, y, z); this.nm.getNormalMatrix(this.m); return this; }
  world() { this.m.identity(); this.nm.identity(); return this; }

  vert(g, x, y, z, nx, ny, nz, u, v, c) {
    const p = this._v.set(x, y, z).applyMatrix4(this.m), n = this._n.set(nx, ny, nz).applyMatrix3(this.nm).normalize();
    g.pos.push(p.x, p.y, p.z); g.nor.push(n.x, n.y, n.z); g.uv.push(u, v);
    const cc = typeof c === 'function' ? c(p.x, p.y, p.z) : c;
    g.col.push(cc[0], cc[1], cc[2]);
    return g.n++;
  }
  // A quad subdivided into nu x nv cells (for smooth baked light). o = corner, du/dv = edge vectors.
  grid(key, o, du, dv, nu, nv, normal, uvAt, color) {
    const g = this.group(key), base = g.n;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const a = i / nu, b = j / nv;
      const x = o[0] + du[0] * a + dv[0] * b, y = o[1] + du[1] * a + dv[1] * b, z = o[2] + du[2] * a + dv[2] * b;
      const [u, v] = uvAt(x, y, z, a, b);
      this.vert(g, x, y, z, normal[0], normal[1], normal[2], u, v, color);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const k = base + j * (nu + 1) + i;
      g.idx.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1);   // front face = du x dv
    }
  }
  // Axis-aligned box in the current frame. w along x, h along y (from y0), d along z. faces: skip any of 'top','bottom', etc.
  box(key, cx, y0, cz, w, h, d, color, {uvScale = 1, skip = ''} = {}) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h, s = uvScale;
    const F = (name, o, du, dv, n, uw, uh) => {
      if (skip.includes(name)) return;
      this.grid(key, o, du, dv, 1, 1, n, (x, y, z, a, b) => [a * uw * s, b * uh * s], color);
    };
    F('top', [x0, y1, z1], [w, 0, 0], [0, 0, -d], [0, 1, 0], w, d);
    F('bottom', [x0, y0, z0], [w, 0, 0], [0, 0, d], [0, -1, 0], w, d);
    F('front', [x0, y0, z1], [w, 0, 0], [0, h, 0], [0, 0, 1], w, h);
    F('back', [x1, y0, z0], [-w, 0, 0], [0, h, 0], [0, 0, -1], w, h);
    F('right', [x1, y0, z1], [0, 0, -d], [0, h, 0], [1, 0, 0], d, h);
    F('left', [x0, y0, z0], [0, 0, d], [0, h, 0], [-1, 0, 0], d, h);
  }
  // n-sided prism (cylinder-ish), optionally tapered, bottom at y0.
  prism(key, cx, y0, cz, r0, r1, h, sides, color, {caps = true, uvScale = 1, rot = 0} = {}) {
    const g = this.group(key);
    for (let i = 0; i < sides; i++) {
      const a0 = rot + (i / sides) * Math.PI * 2, a1 = rot + ((i + 1) / sides) * Math.PI * 2, am = (a0 + a1) / 2;
      const nx = Math.cos(am), nz = Math.sin(am), slope = (r0 - r1) / h;
      const base = g.n, u0 = (i / sides) * 2 * Math.PI * r0 * uvScale / 2, u1 = ((i + 1) / sides) * 2 * Math.PI * r0 * uvScale / 2;
      this.vert(g, cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0, nx, slope, nz, u0, 0, color);
      this.vert(g, cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0, nx, slope, nz, u1, 0, color);
      this.vert(g, cx + Math.cos(a1) * r1, y0 + h, cz + Math.sin(a1) * r1, nx, slope, nz, u1, h * uvScale / 2, color);
      this.vert(g, cx + Math.cos(a0) * r1, y0 + h, cz + Math.sin(a0) * r1, nx, slope, nz, u0, h * uvScale / 2, color);
      g.idx.push(base, base + 3, base + 1, base + 1, base + 3, base + 2);
    }
    if (caps) for (const [y, r, up] of [[y0 + h, r1, 1], [y0, r0, -1]]) {
      if (r <= 0.001) continue;
      const c = this.vert(g, cx, y, cz, 0, up, 0, 0.5, 0.5, color);
      const first = g.n;
      for (let i = 0; i < sides; i++) { const a = rot + (i / sides) * Math.PI * 2; this.vert(g, cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, 0, up, 0, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5, color); }
      for (let i = 0; i < sides; i++) { const a = first + i, b = first + ((i + 1) % sides); if (up > 0) g.idx.push(c, b, a); else g.idx.push(c, a, b); }
    }
  }

  // bakeFn(x, y, z, nx, ny, nz) -> [r, g, b] irradiance; materials: key -> THREE.Material
  build(materials, bakeFn) {
    const meshes = [];
    for (const [key, g] of this.groups) {
      if (!g.n) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
      const bake = new Float32Array(g.n * 3);
      if (bakeFn) for (let i = 0; i < g.n; i++) {
        const v = bakeFn(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2], g.nor[i * 3], g.nor[i * 3 + 1], g.nor[i * 3 + 2]);
        bake[i * 3] = v[0]; bake[i * 3 + 1] = v[1]; bake[i * 3 + 2] = v[2];
      }
      geo.setAttribute('aBake', new THREE.BufferAttribute(bake, 3));
      geo.setIndex(g.n > 65535 ? new THREE.Uint32BufferAttribute(g.idx, 1) : new THREE.Uint16BufferAttribute(g.idx, 1));
      geo.computeBoundingSphere();
      const mat = materials[key] || materials.plain;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.userData.key = key;
      meshes.push(mesh);
    }
    return meshes;
  }
}

// The 3D set up stage: posable mannequins and simple props in a scene with a free camera.
// Like the 2D stage, its only job is to produce a clear picture of who is where and how
// the shot is framed. The image model does the drawing.
import * as THREE from 'three';
import { useRef, useEffect } from 'preact/hooks';
import { S, touch, commit } from './store.js';
import { Btn, Seg, Slider } from './ui.jsx';
import { Icon } from './icons.jsx';
import { uid, clamp, clone, rad, shade } from './util.js';

const R = (x = 0, y = 0, z = 0) => [x, y, z];
// Joint rotations in degrees. For limbs, negative x swings forward and positive x swings back.
export const POSES3 = {
  stand: { name: 'Stand', p: { armL: R(0, 0, 6), armR: R(0, 0, -6) } },
  walk: { name: 'Walk', p: { armL: R(28, 0, 6), foreL: R(-15), armR: R(-28, 0, -6), foreR: R(-25), legL: R(-28), shinL: R(12), legR: R(22), shinR: R(28) } },
  run: { name: 'Run', p: { spine: R(14), armL: R(48, 0, 6), foreL: R(-90), armR: R(-52, 0, -6), foreR: R(-90), legL: R(-58), shinL: R(72), legR: R(30), shinR: R(84) } },
  sit: { name: 'Sit', p: { lift: -0.44, armL: R(-22, 0, 6), foreL: R(-45), armR: R(-22, 0, -6), foreR: R(-45), legL: R(-90), shinL: R(90), legR: R(-90), shinR: R(90) } },
  crouch: { name: 'Crouch', p: { lift: -0.4, spine: R(28), armL: R(-45, 0, 8), foreL: R(-60), armR: R(-45, 0, -8), foreR: R(-60), legL: R(-112), shinL: R(132), legR: R(-100), shinR: R(128) } },
  kneel: { name: 'Kneel', p: { lift: -0.42, armL: R(0, 0, 6), armR: R(-30, 0, -6), foreR: R(-50), legL: R(-90), shinL: R(90), legR: R(4), shinR: R(92) } },
  climb: { name: 'Climb', p: { spine: R(10), head: R(-18), armL: R(-150, 0, 8), foreL: R(-30), armR: R(-62, 0, -6), foreR: R(-70), legL: R(-82), shinL: R(92), legR: R(10), shinR: R(16) } },
  reach: { name: 'Reach up', p: { head: R(-16), armL: R(0, 0, 6), armR: R(-172, 0, -8) } },
  point: { name: 'Point', p: { armL: R(0, 0, 6), armR: R(-90, 0, -4) } },
  wave: { name: 'Wave', p: { armL: R(0, 0, 6), armR: R(0, 0, -140), foreR: R(0, 0, 45) } },
  hips: { name: 'Hands on hips', p: { armL: R(10, 0, 38), foreL: R(-25, 0, -100), armR: R(10, 0, -38), foreR: R(-25, 0, 100) } },
  cheer: { name: 'Cheer', p: { head: R(-8), armL: R(0, 0, 150), armR: R(0, 0, -150) } },
  carry: { name: 'Carry', p: { armL: R(-42, 0, 4), foreL: R(-62), armR: R(-42, 0, -4), foreR: R(-62) } },
  think: { name: 'Think', p: { head: R(10), armL: R(-20, 0, 4), foreL: R(-80, 0, -30), armR: R(-42, 0, -6), foreR: R(-132) } },
  fight: { name: 'Fight', p: { spine: R(8, -22), armL: R(-72, 0, 10), foreL: R(-100), armR: R(-40, 0, -10), foreR: R(-112), legL: R(-28), shinL: R(28), legR: R(22), shinR: R(22) } },
  lie: { name: 'Lie down', p: { lift: -0.78, hips: R(-90), armL: R(0, 0, 14), armR: R(0, 0, -14) } },
};
export const PARTS = [['head', 'Head'], ['spine', 'Torso'], ['hips', 'Whole body'], ['armL', 'Left arm'], ['foreL', 'Left forearm'], ['armR', 'Right arm'], ['foreR', 'Right forearm'], ['legL', 'Left leg'], ['shinL', 'Left shin'], ['legR', 'Right leg'], ['shinR', 'Right shin']];
export const PROPS3 = {
  box: 'Crate', wall: 'Wall', stairs: 'Stairs', table: 'Table', chair: 'Chair', bed: 'Bed', door: 'Door', tree: 'Tree', rock: 'Rock',
  barrel: 'Barrel', ball: 'Ball', lamp: 'Street lamp', car: 'Car', boat: 'Boat', building: 'Building', lantern: 'Lantern',
};
const PROP_DEFAULT = { box: '#b98a54', wall: '#d9cdb8', stairs: '#b9b2a4', table: '#9b6a43', chair: '#9b6a43', bed: '#6f8fc9', door: '#8a5a3a', tree: '#4c9a55', rock: '#8d96a3', barrel: '#9b6a43', ball: '#d64545', lamp: '#4a4f5a', car: '#3f76c9', boat: '#c8553d', building: '#8d96a3', lantern: '#f2c94c' };
const TONES3 = {
  day: { bg: '#cfe3ee', ground: '#cfc9ba', hemi: 1.15, sun: 1.9, sunColor: '#fff4dd' },
  dusk: { bg: '#e2a27a', ground: '#9a8676', hemi: 0.8, sun: 1.7, sunColor: '#ffb070' },
  night: { bg: '#1b2038', ground: '#33374a', hemi: 0.45, sun: 1.1, sunColor: '#9db4ff' },
};

export function newD3() {
  return { objects: [], camera: { theta: 24, phi: 10, dist: 5.2, target: [0, 0.95, 0], fov: 38 }, light: { az: 40, el: 50 }, tone: 'day' };
}
export function newFigure3(charId, x = 0, z = 0) {
  return { id: uid('f3'), type: 'figure', charId, x, y: 0, z, rotY: 0, scale: 1, pose: clone(POSES3.stand.p) };
}

const mat = (color, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
function mesh(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
const box = (w, h, d, color, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z);
const cyl = (r1, r2, h, color, x, y, z) => mesh(new THREE.CylinderGeometry(r1, r2, h, 20), color, x, y, z);

function buildFigure(color) {
  const c = color || '#8d96a3', skin = '#ead9c6', dark = shade(c, -0.42);
  const root = new THREE.Group(), J = {};
  const joint = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); J[name] = g; return g; };
  const cap = (r, len, col, y) => mesh(new THREE.CapsuleGeometry(r, len, 6, 14), col, 0, y, 0);
  const hips = joint('hips', root, 0, 0.92, 0);
  hips.add(mesh(new THREE.SphereGeometry(0.15, 18, 14), dark, 0, 0, 0));
  const spine = joint('spine', hips, 0, 0.04, 0);
  spine.add(cap(0.155, 0.26, c, 0.25));
  const head = joint('head', spine, 0, 0.5, 0);
  head.add(cyl(0.05, 0.055, 0.1, skin, 0, 0.03, 0));
  head.add(mesh(new THREE.SphereGeometry(0.125, 22, 18), skin, 0, 0.19, 0));
  const hair = mesh(new THREE.SphereGeometry(0.132, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), dark, 0, 0.2, -0.012);
  hair.rotation.x = -0.35; head.add(hair);
  const nose = mesh(new THREE.ConeGeometry(0.026, 0.07, 10), shade(skin, -0.12), 0, 0.17, 0.135); nose.rotation.x = Math.PI / 2; head.add(nose);
  for (const sx of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.016, 8, 8), '#23232a', sx * 0.045, 0.21, 0.113));
  for (const [k, sx] of [['L', 1], ['R', -1]]) {
    const arm = joint('arm' + k, spine, sx * 0.21, 0.45, 0);
    arm.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), c, 0, 0, 0));
    arm.add(cap(0.055, 0.2, c, -0.14));
    const fore = joint('fore' + k, arm, 0, -0.28, 0);
    fore.add(cap(0.047, 0.19, skin, -0.125));
    fore.add(mesh(new THREE.SphereGeometry(0.06, 12, 10), skin, 0, -0.28, 0));
    const leg = joint('leg' + k, hips, sx * 0.095, -0.03, 0);
    leg.add(cap(0.078, 0.3, dark, -0.21));
    const shin = joint('shin' + k, leg, 0, -0.44, 0);
    shin.add(cap(0.064, 0.3, dark, -0.2));
    shin.add(box(0.11, 0.08, 0.25, '#23232a', 0, -0.44, 0.05));
  }
  root.userData.joints = J;
  return root;
}
function poseFigure(root, f) {
  const J = root.userData.joints, p = f.pose || {};
  for (const k of Object.keys(J)) { const r = p[k] || [0, 0, 0]; J[k].rotation.set(rad(r[0] || 0), rad(r[1] || 0), rad(r[2] || 0)); }
  J.hips.position.y = 0.92 + (p.lift || 0);
}

function buildProp(kind, color) {
  const g = new THREE.Group(), c = color, d = shade(color, -0.25);
  const add = (m) => g.add(m);
  if (kind === 'box') add(box(0.8, 0.8, 0.8, c, 0, 0.4, 0));
  else if (kind === 'wall') add(box(4, 2.7, 0.16, c, 0, 1.35, 0));
  else if (kind === 'stairs') for (let i = 0; i < 6; i++) add(box(1.4, 0.2 * (i + 1), 0.32, c, 0, 0.1 * (i + 1), -i * 0.32));
  else if (kind === 'table') { add(box(1.5, 0.07, 0.85, c, 0, 0.76, 0)); for (const [x, z] of [[-0.68, -0.36], [0.68, -0.36], [-0.68, 0.36], [0.68, 0.36]]) add(box(0.07, 0.74, 0.07, d, x, 0.37, z)); }
  else if (kind === 'chair') { add(box(0.46, 0.06, 0.46, c, 0, 0.46, 0)); add(box(0.46, 0.5, 0.06, c, 0, 0.74, -0.2)); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(box(0.05, 0.46, 0.05, d, x, 0.23, z)); }
  else if (kind === 'bed') { add(box(1, 0.3, 2, '#8a5a3a', 0, 0.2, 0)); add(box(0.96, 0.16, 1.96, c, 0, 0.43, 0)); add(box(1, 0.8, 0.08, '#8a5a3a', 0, 0.5, -1)); add(box(0.6, 0.12, 0.36, '#f2f0ea', 0, 0.56, -0.72)); }
  else if (kind === 'door') { add(box(0.95, 2.05, 0.06, c, 0, 1.025, 0)); add(box(0.1, 2.15, 0.14, d, -0.52, 1.075, 0)); add(box(0.1, 2.15, 0.14, d, 0.52, 1.075, 0)); add(box(1.14, 0.1, 0.14, d, 0, 2.15, 0)); add(mesh(new THREE.SphereGeometry(0.045, 10, 8), '#f2c94c', 0.36, 1, 0.06)); }
  else if (kind === 'tree') { add(cyl(0.14, 0.2, 1.6, '#8a5a3a', 0, 0.8, 0)); add(mesh(new THREE.IcosahedronGeometry(1.05, 1), c, 0, 2.3, 0)); }
  else if (kind === 'rock') { const m = mesh(new THREE.DodecahedronGeometry(0.6, 0), c, 0, 0.36, 0); m.scale.set(1.3, 0.75, 1); add(m); }
  else if (kind === 'barrel') add(cyl(0.34, 0.3, 0.9, c, 0, 0.45, 0));
  else if (kind === 'ball') add(mesh(new THREE.SphereGeometry(0.3, 22, 16), c, 0, 0.3, 0));
  else if (kind === 'lamp') { add(cyl(0.05, 0.07, 3.2, c, 0, 1.6, 0)); add(box(0.34, 0.3, 0.34, '#f2c94c', 0, 3.3, 0)); }
  else if (kind === 'car') { add(box(1.7, 0.55, 4, c, 0, 0.55, 0)); add(box(1.5, 0.5, 2, shade(c, 0.3), 0, 1.05, -0.2)); for (const [x, z] of [[-0.85, -1.25], [0.85, -1.25], [-0.85, 1.25], [0.85, 1.25]]) { const w = cyl(0.34, 0.34, 0.22, '#23232a', x, 0.34, z); w.rotation.z = Math.PI / 2; add(w); } }
  else if (kind === 'boat') { add(box(1.2, 0.4, 3, c, 0, 0.2, 0)); add(box(1.0, 0.08, 0.3, d, 0, 0.42, 0.4)); add(box(1.0, 0.08, 0.3, d, 0, 0.42, -0.6)); const bow = mesh(new THREE.ConeGeometry(0.6, 0.9, 4), c, 0, 0.2, 1.9); bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.y = 1; add(bow); }
  else if (kind === 'building') add(box(4, 9, 4, c, 0, 4.5, 0));
  else if (kind === 'lantern') { add(box(0.16, 0.22, 0.16, c, 0, 0.14, 0)); add(box(0.2, 0.04, 0.2, '#33363d', 0, 0.02, 0)); add(box(0.2, 0.04, 0.2, '#33363d', 0, 0.27, 0)); }
  return g;
}

let live = null;
export const has3D = () => !!live;
export async function snapshot3D() { return live ? live.snapshot() : null; }

class Scene3D {
  constructor(canvas, cb) {
    this.canvas = canvas; this.cb = cb; this.nodes = new Map();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#8a8578', 1.1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4dd', 1.9); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 60 });
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#cfc9ba', 1));
    this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true; this.scene.add(this.ground);
    this.grid = new THREE.GridHelper(20, 20, 0x000000, 0x000000); this.grid.material.opacity = 0.09; this.grid.material.transparent = true; this.grid.position.y = 0.002; this.scene.add(this.grid);
    this.selBox = new THREE.BoxHelper(new THREE.Object3D(), 0xf0b541); this.selBox.visible = false; this.scene.add(this.selBox);
    this.ray = new THREE.Raycaster();
    this.down = this.down.bind(this); this.wheel = this.wheel.bind(this);
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('wheel', this.wheel, { passive: false });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas.parentElement);
  }
  dispose() {
    this.canvas.removeEventListener('pointerdown', this.down); this.canvas.removeEventListener('wheel', this.wheel);
    this.ro.disconnect(); this.renderer.dispose();
  }
  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix();
    this.draw();
  }
  sync(d3, doc, selId) {
    this.d3 = d3; this.selId = selId;
    const seen = new Set();
    for (const o of d3.objects) {
      seen.add(o.id);
      const color = o.type === 'figure' ? doc.characters.find((c) => c.id === o.charId)?.color || null : o.color;
      const sig = o.type + (o.kind || '') + color;
      let n = this.nodes.get(o.id);
      if (!n || n.userData.sig !== sig) {
        if (n) this.scene.remove(n);
        n = o.type === 'figure' ? buildFigure(color) : buildProp(o.kind, color);
        n.userData.sig = sig; n.userData.id = o.id;
        this.nodes.set(o.id, n); this.scene.add(n);
      }
      n.position.set(o.x, o.y || 0, o.z); n.rotation.y = rad(o.rotY || 0); n.scale.setScalar(o.scale || 1);
      if (o.type === 'figure') poseFigure(n, o);
    }
    for (const [id, n] of this.nodes) if (!seen.has(id)) { this.scene.remove(n); this.nodes.delete(id); }
    const t = TONES3[d3.tone] || TONES3.day;
    this.scene.background = new THREE.Color(t.bg); this.ground.material.color.set(t.ground);
    this.hemi.intensity = t.hemi; this.sun.intensity = t.sun; this.sun.color.set(t.sunColor);
    const az = rad(d3.light.az), el = rad(d3.light.el);
    this.sun.position.set(Math.sin(az) * Math.cos(el) * 14, Math.sin(el) * 14, Math.cos(az) * Math.cos(el) * 14);
    const c = d3.camera, th = rad(c.theta), ph = rad(c.phi);
    this.camera.position.set(c.target[0] + c.dist * Math.cos(ph) * Math.sin(th), c.target[1] + c.dist * Math.sin(ph), c.target[2] + c.dist * Math.cos(ph) * Math.cos(th));
    this.camera.lookAt(c.target[0], c.target[1], c.target[2]);
    if (this.camera.fov !== c.fov) { this.camera.fov = c.fov; this.camera.updateProjectionMatrix(); }
    const sel = this.nodes.get(selId);
    this.selBox.visible = !!sel; if (sel) this.selBox.setFromObject(sel);
    this.draw();
  }
  draw() { if (this.d3) this.renderer.render(this.scene, this.camera); }
  snapshot() {
    const g = this.grid.visible, s = this.selBox.visible;
    this.grid.visible = false; this.selBox.visible = false;
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/jpeg', 0.9);
    this.grid.visible = g; this.selBox.visible = s; this.draw();
    return url;
  }
  ndc(e) { const r = this.canvas.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
  pick(e) {
    this.ray.setFromCamera(this.ndc(e), this.camera);
    const hit = this.ray.intersectObjects([...this.nodes.values()], true)[0];
    if (!hit) return null;
    let o = hit.object; while (o && !o.userData.id) o = o.parent;
    return o ? { id: o.userData.id, point: hit.point } : null;
  }
  down(e) {
    e.preventDefault();
    const d3 = this.d3, hit = this.pick(e), cam = d3.camera;
    const sx = e.clientX, sy = e.clientY; let moved = false, move;
    if (hit) {
      this.cb.select(hit.id);
      const o = d3.objects.find((x) => x.id === hit.id);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -hit.point.y), p = new THREE.Vector3();
      const ox = o.x - hit.point.x, oz = o.z - hit.point.z;
      move = (ev) => { this.ray.setFromCamera(this.ndc(ev), this.camera); if (this.ray.ray.intersectPlane(plane, p)) { o.x = clamp(p.x + ox, -40, 40); o.z = clamp(p.z + oz, -40, 40); } };
    } else if (e.shiftKey || e.button === 2) {
      const t0 = [...cam.target];
      move = (ev) => {
        const k = cam.dist * 0.0016, th = rad(cam.theta), dx = (ev.clientX - sx) * k, dy = (ev.clientY - sy) * k;
        cam.target = [t0[0] - Math.cos(th) * dx, clamp(t0[1] + dy, 0, 12), t0[2] + Math.sin(th) * dx];
      };
    } else {
      this.cb.select(null);
      const th0 = cam.theta, ph0 = cam.phi;
      move = (ev) => { cam.theta = th0 - (ev.clientX - sx) * 0.4; cam.phi = clamp(ph0 + (ev.clientY - sy) * 0.3, -12, 89); };
    }
    const onMove = (ev) => { if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return; moved = true; move(ev); this.cb.change(); };
    const up = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', up); if (moved) this.cb.commit(); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', up);
  }
  wheel(e) {
    e.preventDefault();
    const cam = this.d3.camera;
    cam.dist = clamp(cam.dist * Math.exp(e.deltaY * (e.ctrlKey ? 0.012 : 0.0022)), 0.6, 60);
    this.cb.change();
    clearTimeout(this.wt); this.wt = setTimeout(() => this.cb.commit(), 400);
  }
}

export function Stage3D({ d3, ws }) {
  const canvas = useRef(), sc = useRef();
  useEffect(() => {
    let s;
    try {
      s = new Scene3D(canvas.current, { select: (id) => { ws.sel3 = id; touch(); }, change: touch, commit });
    } catch (e) { console.error(e); ws.no3d = true; touch(); return; }
    sc.current = s; live = s; s.resize(); touch();
    return () => { if (live === s) live = null; s.dispose(); };
  }, []);
  useEffect(() => { if (sc.current) sc.current.sync(d3, S.doc, ws.sel3); });
  if (ws.no3d) return <div class="empty" style="color:#555">This browser could not start 3D graphics. The 2D stage still works.</div>;
  return <canvas ref={canvas} onContextMenu={(e) => e.preventDefault()} />;
}

function cameraPreset(d3, ws, k) {
  const c = d3.camera, f = d3.objects.find((o) => o.id === ws.sel3 && o.type === 'figure') || d3.objects.find((o) => o.type === 'figure');
  const fx = f ? f.x : 0, fz = f ? f.z : 0, s = f ? f.scale : 1, fy = f ? f.y || 0 : 0;
  const face = f ? f.rotY : 0;
  if (k === 'eye') Object.assign(c, { phi: 3, dist: 4.6, target: [fx, fy + 1.0 * s, fz], fov: 38 });
  if (k === 'low') Object.assign(c, { phi: -9, dist: 3.6, target: [fx, fy + 1.15 * s, fz], fov: 44 });
  if (k === 'high') Object.assign(c, { phi: 42, dist: 6, target: [fx, fy + 0.8 * s, fz], fov: 38 });
  if (k === 'top') Object.assign(c, { phi: 86, dist: 8, target: [fx, fy, fz], fov: 38 });
  if (k === 'close') Object.assign(c, { theta: face + 14, phi: 4, dist: 1.5 * s, target: [fx, fy + 1.55 * s, fz], fov: 30 });
  if (k === 'wide') Object.assign(c, { phi: 14, dist: 11, target: [0, 1, 0], fov: 38 });
  if (k === 'front') c.theta = face;
  if (k === 'side') c.theta = face + 90;
  if (k === 'back') c.theta = face + 180;
  commit();
}

const PROP_COLORS3 = ['#f2f0ea', '#d9cdb8', '#b9b2a4', '#8d96a3', '#33363d', '#9b6a43', '#d64545', '#e8833a', '#f2c94c', '#4c9a55', '#3f76c9', '#8257c4'];

export function Lib3D({ d3, ws }) {
  const doc = S.doc;
  const o = d3.objects.find((x) => x.id === ws.sel3);
  const add = (obj) => { d3.objects.push(obj); ws.sel3 = obj.id; commit(); };
  // First free spot on a small grid in front of the camera target, so new things never stack.
  const spot = (gap = 0.9) => {
    for (let ring = 0; ring < 8; ring++) for (const sx of ring ? [-1, 1] : [1]) for (let row = 0; row < 4; row++) {
      const x = sx * ring * gap, z = -row * gap;
      if (!d3.objects.some((q) => Math.hypot(q.x - x, q.z - z) < gap * 0.8)) return [x, z];
    }
    return [0, 0];
  };
  const part = ws.part || 'armR';
  const rot = o?.type === 'figure' ? o.pose[part] || [0, 0, 0] : null;
  const setRot = (i, v) => { const r = [...(o.pose[part] || [0, 0, 0])]; r[i] = v; o.pose[part] = r; touch(); };
  return (
    <div class="ws-lib">
      {o && <div class="sec">
        <div class="lab">Selected {o.type === 'figure' ? 'figure' : PROPS3[o.kind].toLowerCase()}<span class="grow" />
          <Btn kind="ghost sm" icon="copy" title="Duplicate" onClick={() => { const c = clone(o); c.id = uid('c3'); c.x += 0.7; add(c); }} />
          <Btn kind="ghost sm danger" icon="trash" title="Delete" onClick={() => { d3.objects = d3.objects.filter((x) => x !== o); ws.sel3 = null; commit(); }} />
        </div>
        {o.type === 'figure' && <>
          <div class="chips" style="margin-bottom:12px">
            {doc.characters.map((c) => <button class={`chip ${c.id === o.charId ? 'on' : ''}`} onClick={() => { o.charId = c.id; commit(); }}><span class="dot" style={`background:${c.color}`} />{c.name}</button>)}
            <button class={`chip ${!o.charId ? 'on' : ''}`} onClick={() => { o.charId = null; commit(); }}><span class="dot" style="background:#8d96a3" />Extra</button>
          </div>
          <div class="lab">Pose</div>
          <div class="grid3" style="margin-bottom:12px">
            {Object.entries(POSES3).map(([id, p]) => <button class="cell txt" onClick={() => { o.pose = clone(p.p); commit(); }}>{p.name}</button>)}
          </div>
        </>}
        {o.type === 'prop' && <div class="swatches">{PROP_COLORS3.map((c) => <button class={`swatch ${c === o.color ? 'on' : ''}`} style={`background:${c}`} onClick={() => { o.color = c; commit(); }} />)}</div>}
        <Slider label="Turn" min={-180} max={180} value={Math.round(o.rotY || 0)} fmt={(v) => v + '°'} onInput={(v) => { o.rotY = v; touch(); }} onChange={commit} />
        <Slider label="Size" min={0.2} max={4} step={0.01} value={o.scale} fmt={(v) => Math.round(v * 100) + '%'} onInput={(v) => { o.scale = v; touch(); }} onChange={commit} />
        <Slider label="Height" min={-1} max={6} step={0.01} value={o.y || 0} fmt={(v) => v.toFixed(1)} onInput={(v) => { o.y = v; touch(); }} onChange={commit} />
        {o.type === 'figure' && <>
          <div class="lab" style="margin-top:12px">Adjust a joint</div>
          <div class="chips" style="margin-bottom:10px">
            {PARTS.map(([k, n]) => <button class={`chip ${part === k ? 'on' : ''}`} onClick={() => { ws.part = k; touch(); }}>{n}</button>)}
          </div>
          <Slider label="Forward" min={-180} max={180} value={Math.round(-rot[0])} fmt={(v) => v + '°'} onInput={(v) => setRot(0, -v)} onChange={commit} />
          <Slider label="Twist" min={-180} max={180} value={Math.round(rot[1] || 0)} fmt={(v) => v + '°'} onInput={(v) => setRot(1, v)} onChange={commit} />
          <Slider label="Sideways" min={-180} max={180} value={Math.round(rot[2] || 0)} fmt={(v) => v + '°'} onInput={(v) => setRot(2, v)} onChange={commit} />
        </>}
      </div>}
      <div class="sec">
        <div class="lab">Add a figure</div>
        <div class="chips">
          {doc.characters.map((c) => <button class="chip" onClick={() => { const [x, z] = spot(); add(newFigure3(c.id, x, z)); }}><span class="dot" style={`background:${c.color}`} />{c.name}</button>)}
          <button class="chip dashed" onClick={() => { const [x, z] = spot(); add(newFigure3(null, x, z)); }}><Icon name="plus" size={12} />Extra</button>
        </div>
      </div>
      <div class="sec">
        <div class="lab">Props</div>
        <div class="grid3">
          {Object.entries(PROPS3).map(([k, n]) => <button class="cell txt" onClick={() => { const big = k === 'wall' || k === 'building'; const [x, z] = big ? [0, k === 'wall' ? -2.5 : -6] : spot(1.3); add({ id: uid('p3'), type: 'prop', kind: k, x, y: 0, z, rotY: 0, scale: 1, color: PROP_DEFAULT[k] }); }}>{n}</button>)}
        </div>
      </div>
      <div class="sec">
        <div class="lab">Camera</div>
        <div class="chips" style="margin-bottom:10px">
          {[['eye', 'Eye level'], ['low', 'Low angle'], ['high', 'High angle'], ['top', 'Top down'], ['close', 'Close-up'], ['wide', 'Wide'], ['front', 'From front'], ['side', 'From side'], ['back', 'From behind']].map(([k, n]) => <button class="chip" onClick={() => cameraPreset(d3, ws, k)}>{n}</button>)}
        </div>
        <Slider label="Lens" min={18} max={80} value={d3.camera.fov} fmt={(v) => v + '°'} onInput={(v) => { d3.camera.fov = v; touch(); }} onChange={commit} />
        <p class="hint" style="margin:0">Drag empty space to orbit. Scroll or pinch to zoom. Hold Shift and drag to slide the view. Drag a figure or prop to move it along the ground.</p>
      </div>
      <div class="sec">
        <div class="lab">Light</div>
        <Seg class="block quiet" value={d3.tone} options={[['day', 'Day'], ['dusk', 'Dusk'], ['night', 'Night']]} onChange={(v) => { d3.tone = v; commit(); }} />
        <div style="height:10px" />
        <Slider label="Direction" min={-180} max={180} value={d3.light.az} fmt={(v) => v + '°'} onInput={(v) => { d3.light.az = v; touch(); }} onChange={commit} />
        <Slider label="Height" min={8} max={88} value={d3.light.el} fmt={(v) => v + '°'} onInput={(v) => { d3.light.el = v; touch(); }} onChange={commit} />
      </div>
    </div>
  );
}

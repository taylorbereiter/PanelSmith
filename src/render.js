// Turns a page into a flat list of drawing primitives. The same list is drawn as SVG on
// screen (pageview.jsx) and onto a canvas for export (exporter.js), so what you see is
// what you get.
import { PAGE, layoutPage } from './layout.js';
import { S } from './store.js';
import { clamp } from './util.js';

export const FONT = '"Comic Neue", "Comic Sans MS", "Chalkboard SE", sans-serif';
export const SFX_FONT = '"Bangers", "Impact", sans-serif';
const INK = '#16161a';

let mctx;
export function measure(text, size, weight = 700, family = FONT) {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  mctx.font = `${weight} ${size}px ${family}`;
  return mctx.measureText(text).width;
}
function wrapAt(words, size, maxW) {
  const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && measure(t, size) > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
/** Wrap text, then narrow the block as far as the line count allows so the lines come out balanced. */
export function wrapBalanced(text, size, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  let lines = wrapAt(words, size, maxW);
  if (lines.length > 1) {
    let lo = Math.max(...words.map((w) => measure(w, size))), hi = maxW;
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2;
      if (wrapAt(words, size, mid).length <= lines.length) hi = mid; else lo = mid;
    }
    lines = wrapAt(words, size, hi);
  }
  return { lines, width: Math.max(1, ...lines.map((l) => measure(l, size))) };
}

const SLOTS = [[0.3, 0.17], [0.7, 0.3], [0.3, 0.5], [0.7, 0.66], [0.32, 0.82]];

/** Where a speaker's head is in the panel (0..1), if the 2D set up has a figure for them. */
function speakerHead(doc, panel, who) {
  const ch = doc.characters.find((c) => c.name.toUpperCase() === who);
  const d2 = panel.setup?.mode === '2d' ? panel.setup.d2 : null;
  if (!ch || !d2) return null;
  const f = d2.objects.find((o) => o.type === 'figure' && o.charId === ch.id);
  if (!f) return null;
  const v = d2.view || { cx: 500, cy: d2.h / 2, zoom: 1 };
  const hx = f.x, hy = f.y - 164 * f.scale;
  return { x: 0.5 + ((hx - v.cx) * v.zoom) / 1000, y: 0.5 + ((hy - v.cy) * v.zoom) / d2.h };
}

/** Geometry for one bubble: drawing primitives plus the numbers the editor needs for handles. */
export function bubbleGeom(doc, panel, i, rect) {
  const line = panel.lines[i], b = panel.bubbles[i] || {};
  const type = line.type;
  const text = doc.caps && type !== 'sfx' ? line.text.toUpperCase() : line.text;
  const prims = [];
  const kindIdx = panel.lines.slice(0, i).filter((l) => (l.type === 'caption') === (type === 'caption') && (l.type === 'sfx') === (type === 'sfx')).length;

  if (type === 'sfx') {
    const size = clamp(rect.w * 0.17, 54, 130) * (b.s || 1);
    const x = rect.x + (b.x ?? 0.5) * rect.w, y = rect.y + (b.y ?? clamp(0.62 + kindIdx * 0.16, 0, 0.9)) * rect.h;
    const w = measure(text.toUpperCase(), size, 400, SFX_FONT);
    prims.push({ t: 'text', x, y: y + size * 0.36, text: text.toUpperCase(), family: SFX_FONT, size, weight: 400, fill: '#ffd23f', stroke: INK, sw: size * 0.09, anchor: 'middle', rot: -6, cx: x, cy: y });
    return { prims, type, cx: x, cy: y, rx: w / 2 + 8, ry: size * 0.55, noTail: true, textW: w };
  }

  const fs = (rect.w < 380 ? 20 : 22) * (b.s || 1);
  const isCap = type === 'caption';
  const maxW = b.w || (isCap ? clamp(rect.w * 0.62, 170, 430) : clamp(rect.w * 0.44, 150, 300));
  const { lines, width } = wrapBalanced(text, fs, maxW);
  const lh = fs * 1.16, th = lines.length * lh;
  let rx, ry;
  if (isCap) { rx = width / 2 + 16; ry = th / 2 + 11; }
  else { rx = (width / 2) * 1.3 + 16; ry = (th / 2) * 1.38 + 13; if (type === 'thought') { rx += 6; ry += 6; } }

  let nx, ny;
  if (b.x != null) { nx = b.x; ny = b.y; }
  else if (isCap) {
    if (kindIdx % 2 === 0) { nx = (rx + 14) / rect.w; ny = (ry + 14) / rect.h + Math.floor(kindIdx / 2) * 0.2; }
    else { nx = 1 - (rx + 14) / rect.w; ny = 1 - (ry + 14) / rect.h; }
  } else {
    [nx, ny] = SLOTS[kindIdx % SLOTS.length];
    const head = speakerHead(doc, panel, line.who);
    if (head) { nx = clamp(head.x + (head.x > 0.5 ? -0.18 : 0.18), 0.2, 0.8); ny = clamp(head.y - 0.3, 0.12, 0.7) + kindIdx * 0.06; }
  }
  let cx = rect.x + nx * rect.w, cy = rect.y + ny * rect.h;
  if (b.x == null) {
    if (rect.w > 2 * rx + 16) cx = clamp(cx, rect.x + rx + 8, rect.x + rect.w - rx - 8);
    if (rect.h > 2 * ry + 16) cy = clamp(cy, rect.y + ry + 8, rect.y + rect.h - ry - 8);
  }

  let tail = null;
  if (!isCap) {
    if (b.tx != null) tail = { x: rect.x + b.tx * rect.w, y: rect.y + b.ty * rect.h };
    else {
      const head = speakerHead(doc, panel, line.who);
      if (head) {
        const hx = rect.x + head.x * rect.w, hy = rect.y + head.y * rect.h;
        const dx = hx - cx, dy = hy - cy, d = Math.hypot(dx, dy) || 1;
        const reach = Math.max(0, d - 46);
        tail = { x: cx + (dx / d) * reach, y: cy + (dy / d) * reach };
      } else {
        const toC = rect.x + rect.w / 2 - cx;
        tail = { x: cx + clamp(toC * 0.35, -70, 70), y: Math.min(cy + ry + Math.max(38, rect.h * 0.1), rect.y + rect.h - 10) };
      }
    }
    const ex = (tail.x - cx) / rx, ey = (tail.y - cy) / ry;
    if (ex * ex + ey * ey < 1.15) tail = b.tx != null ? tail : null;
  }

  const pt = (a, k = 1) => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  const f2 = (n) => n.toFixed(1);
  const poly = (pts) => 'M' + pts.map((p) => f2(p[0]) + ' ' + f2(p[1])).join('L') + 'Z';
  const tAng = tail ? Math.atan2((tail.y - cy) / ry, (tail.x - cx) / rx) : 0;
  const inside = tail && ((tail.x - cx) / rx) ** 2 + ((tail.y - cy) / ry) ** 2 < 1;

  if (isCap) {
    prims.push({ t: 'path', d: `M${f2(cx - rx)} ${f2(cy - ry)}h${f2(2 * rx)}v${f2(2 * ry)}h${f2(-2 * rx)}Z`, fill: '#fff6cf', stroke: INK, sw: 3.5 });
  } else if (type === 'thought') {
    const per = Math.PI * (rx + ry), n = Math.max(9, Math.round(per / 46));
    let d = '';
    for (let k = 0; k <= n; k++) {
      const [x, y] = pt((k / n) * Math.PI * 2 - Math.PI / 2);
      if (k === 0) d += `M${f2(x)} ${f2(y)}`;
      else { const [px, py] = pt(((k - 1) / n) * Math.PI * 2 - Math.PI / 2); const r = Math.hypot(x - px, y - py) * 0.62; d += `A${f2(r)} ${f2(r)} 0 0 1 ${f2(x)} ${f2(y)}`; }
    }
    prims.push({ t: 'path', d: d + 'Z', fill: '#fff', stroke: INK, sw: 3.5 });
    if (tail && !inside) {
      const [ex, ey] = pt(tAng, 1.12);
      [[0.18, 11], [0.55, 7.5], [0.92, 5]].forEach(([t, r]) => {
        const x = ex + (tail.x - ex) * t, y = ey + (tail.y - ey) * t;
        prims.push({ t: 'path', d: `M${f2(x - r)} ${f2(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`, fill: '#fff', stroke: INK, sw: 3 });
      });
    }
  } else if (type === 'shout') {
    const per = Math.PI * (rx + ry), n = Math.max(11, Math.round(per / 40));
    const pts = [];
    let tipAt = -1, best = 9;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const jit = 1.3 + 0.16 * Math.sin(k * 12.9898 + i * 3.1);
      if (tail && !inside) { const da = Math.abs(Math.atan2(Math.sin(a - tAng), Math.cos(a - tAng))); if (da < best) { best = da; tipAt = pts.length; } }
      pts.push(pt(a, jit));
      pts.push(pt(a + Math.PI / n, 1.04));
    }
    if (tipAt >= 0) pts[tipAt] = [tail.x, tail.y];
    prims.push({ t: 'path', d: poly(pts), fill: '#fff', stroke: INK, sw: 4, join: 'miter' });
  } else {
    const pts = [], N = 84;
    if (tail && !inside) {
      const half = clamp(15 / ((rx + ry) / 2), 0.1, 0.5);
      for (let k = 0; k <= N; k++) pts.push(pt(tAng + half + ((Math.PI * 2 - 2 * half) * k) / N));
      pts.push([tail.x, tail.y]);
    } else for (let k = 0; k < N; k++) pts.push(pt((k / N) * Math.PI * 2));
    prims.push({ t: 'path', d: poly(pts), fill: '#fff', stroke: INK, sw: 3.5, dash: type === 'whisper' ? [10, 8] : null });
  }
  lines.forEach((ln, k) => {
    prims.push({ t: 'text', x: cx, y: cy - th / 2 + lh * k + fs * 0.9, text: ln, family: FONT, size: fs, weight: 700, fill: INK, anchor: 'middle' });
  });
  return { prims, type, cx, cy, rx, ry, tail: inside ? null : tail, noTail: isCap, textW: maxW };
}

/** Rectangle an image must be drawn at to cover `r`, given the image size and the panel's fit. */
export function coverRect(r, iw, ih, fit = {}) {
  const z = fit.zoom || 1;
  const s = Math.max(r.w / iw, r.h / ih) * z;
  const dw = iw * s, dh = ih * s;
  return { x: r.x + (r.w - dw) * (fit.x ?? 0.5), y: r.y + (r.h - dh) * (fit.y ?? 0.5), w: dw, h: dh };
}

/** Primitives for one panel placed at `rect`. */
export function panelPrims(doc, panel, rect, { number = null, forExport = false, bubbles = true } = {}) {
  const prims = [];
  const art = panel.artAsset || panel.setupAsset;
  prims.push({ t: 'rect', ...rect, fill: art || forExport ? '#fff' : '#ebe7dd' });
  if (art) prims.push({ t: 'image', asset: art, clip: rect, fit: panel.artAsset ? panel.fit : null, draft: !panel.artAsset });
  else if (!forExport) {
    prims.push({ t: 'text', x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 + (panel.lines.length ? rect.h * 0.22 : 0), text: number ? `Panel ${number}` : 'Panel', family: 'system-ui, sans-serif', size: 26, weight: 600, fill: '#a9a294', anchor: 'middle', ui: true });
  }
  prims.push({ t: 'rect', ...rect, fill: 'none', stroke: INK, sw: 5 });
  const geoms = [];
  if (bubbles) panel.lines.forEach((_, i) => { const g = bubbleGeom(doc, panel, i, rect); geoms.push(g); prims.push({ t: 'group', id: panel.bubbles[i]?.id, prims: g.prims }); });
  return { prims, geoms };
}

export function pagePrims(doc, page, opts = {}) {
  const lay = layoutPage(page);
  const prims = [{ t: 'rect', x: 0, y: 0, w: PAGE.w, h: PAGE.h, fill: '#fff' }];
  const panels = [];
  page.panels.forEach((p, i) => {
    const rect = lay.rects.find((r) => r.id === p.id);
    const out = panelPrims(doc, p, rect, { ...opts, number: i + 1 });
    panels.push({ panel: p, rect, ...out });
  });
  return { prims, panels, layout: lay };
}

// Natural image sizes, needed to crop art to a panel. Filled in lazily.
const sizes = {};
export function imageSize(assetId, onReady) {
  if (sizes[assetId]) return sizes[assetId] === 'loading' ? null : sizes[assetId];
  const src = S.assets[assetId];
  if (!src) return null;
  sizes[assetId] = 'loading';
  const im = new Image();
  im.onload = () => { sizes[assetId] = { w: im.naturalWidth, h: im.naturalHeight, im }; onReady && onReady(); };
  im.src = src;
  return null;
}
export const imageSizeAsync = (assetId) => new Promise((res) => { const s = imageSize(assetId, () => res(sizes[assetId])); if (s) res(s); else if (!S.assets[assetId]) res(null); });

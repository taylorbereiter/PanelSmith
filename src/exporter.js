// Export: draws the same primitives the editor shows onto a canvas, then saves PNG, PDF,
// a vertical strip, or a project file that holds the whole comic.
import { jsPDF } from 'jspdf';
import { S, usedAssets, createProject, toast, flush } from './store.js';
import { pagePrims, panelPrims, coverRect } from './render.js';
import { PAGE, layoutPage } from './layout.js';
import { download, loadImage, pickFile, uid } from './util.js';

const safeName = (s) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'comic';

async function preload(prims, cache) {
  for (const p of prims) {
    if (p.t === 'group') await preload(p.prims, cache);
    else if (p.t === 'image' && !cache[p.asset] && S.assets[p.asset]) cache[p.asset] = await loadImage(S.assets[p.asset]).catch(() => null);
  }
}
function draw(ctx, prims, cache) {
  for (const p of prims) {
    if (p.t === 'group') draw(ctx, p.prims, cache);
    else if (p.t === 'rect') {
      if (p.fill && p.fill !== 'none') { ctx.fillStyle = p.fill; ctx.fillRect(p.x, p.y, p.w, p.h); }
      if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw; ctx.lineJoin = 'miter'; ctx.strokeRect(p.x, p.y, p.w, p.h); }
    } else if (p.t === 'path') {
      const path = new Path2D(p.d);
      ctx.lineJoin = p.join || 'round'; ctx.setLineDash(p.dash || []);
      if (p.fill && p.fill !== 'none') { ctx.fillStyle = p.fill; ctx.fill(path); }
      if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw; ctx.stroke(path); }
      ctx.setLineDash([]);
    } else if (p.t === 'text') {
      if (p.ui) continue;
      ctx.save();
      if (p.rot) { ctx.translate(p.cx, p.cy); ctx.rotate((p.rot * Math.PI) / 180); ctx.translate(-p.cx, -p.cy); }
      ctx.font = `${p.weight} ${p.size}px ${p.family}`;
      ctx.textAlign = p.anchor === 'middle' ? 'center' : 'left'; ctx.textBaseline = 'alphabetic';
      if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw; ctx.lineJoin = 'round'; ctx.strokeText(p.text, p.x, p.y); }
      ctx.fillStyle = p.fill; ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    } else if (p.t === 'image') {
      const im = cache[p.asset]; if (!im) continue;
      const r = coverRect(p.clip, im.naturalWidth, im.naturalHeight, p.fit || {});
      ctx.save(); ctx.beginPath(); ctx.rect(p.clip.x, p.clip.y, p.clip.w, p.clip.h); ctx.clip();
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  }
}

export async function renderPageCanvas(page, scale = 2, cache = {}) {
  await document.fonts.ready;
  const { prims, panels } = pagePrims(S.doc, page, { forExport: true });
  const all = [...prims, ...panels.flatMap((p) => p.prims)];
  await preload(all, cache);
  const c = document.createElement('canvas');
  c.width = PAGE.w * scale; c.height = PAGE.h * scale;
  const ctx = c.getContext('2d'); ctx.scale(scale, scale);
  draw(ctx, all, cache);
  return c;
}
const toBlob = (c, type = 'image/png', q) => new Promise((res) => c.toBlob(res, type, q));

export async function exportPagePng(idx) {
  const c = await renderPageCanvas(S.doc.pages[idx], 2);
  download(`${safeName(S.doc.title)}-page-${idx + 1}.png`, await toBlob(c));
  toast(`Saved page ${idx + 1} as PNG`);
}

export async function exportPdf() {
  const wIn = 6.625, hIn = (wIn * PAGE.h) / PAGE.w;
  const pdf = new jsPDF({ unit: 'in', format: [wIn, hIn], compress: true });
  const cache = {};
  for (let i = 0; i < S.doc.pages.length; i++) {
    const c = await renderPageCanvas(S.doc.pages[i], 2, cache);
    if (i) pdf.addPage([wIn, hIn]);
    pdf.addImage(c.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, wIn, hIn, undefined, 'FAST');
  }
  pdf.setProperties({ title: S.doc.title });
  download(`${safeName(S.doc.title)}.pdf`, pdf.output('blob'));
  toast(`Saved ${S.doc.pages.length} pages as PDF`);
}

/** One tall image with every panel stacked full width, for reading by scrolling. */
export async function exportStrip() {
  await document.fonts.ready;
  const Wd = 1100, M = 44, G = 44;
  const all = []; let y = M;
  for (const page of S.doc.pages) {
    const lay = layoutPage(page);
    for (const panel of page.panels) {
      const r0 = lay.rects.find((r) => r.id === panel.id);
      const w = Wd - 2 * M, h = Math.min(w / (r0.w / r0.h), w * 1.5);
      all.push(...panelPrims(S.doc, panel, { x: M, y, w, h }, { forExport: true }).prims);
      y += h + G;
    }
  }
  const H = y - G + M;
  if (!all.length) throw new Error('There are no panels to export yet.');
  const cache = {}; await preload(all, cache);
  const scale = Math.min(1.5, 30000 / H);
  const c = document.createElement('canvas'); c.width = Math.round(Wd * scale); c.height = Math.round(H * scale);
  const ctx = c.getContext('2d'); ctx.scale(scale, scale);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, Wd, H);
  draw(ctx, all, cache);
  download(`${safeName(S.doc.title)}-scroll.png`, await toBlob(c));
  toast('Saved the vertical strip');
}

export async function exportProject() {
  await flush();
  const assets = {};
  for (const id of usedAssets()) if (S.assets[id]) assets[id] = S.assets[id];
  const blob = new Blob([JSON.stringify({ format: 'panelsmith', version: 1, doc: S.doc, assets })], { type: 'application/json' });
  download(`${safeName(S.doc.title)}.comic.json`, blob);
  toast('Saved the project file');
}
export async function importProject() {
  const f = await pickFile('.json,application/json'); if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.format !== 'panelsmith' || !data.doc?.script) throw new Error('not a project file');
    data.doc.id = uid('proj');
    await createProject(data.doc, data.assets || {});
    toast(`Opened “${data.doc.title}”`);
  } catch (e) { toast('That file is not a comic project file.', 'error'); }
}

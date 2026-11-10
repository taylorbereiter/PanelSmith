// Application state. One mutable document, a snapshot-based undo history, and autosave.
// Components call `touch()` after a transient change (for example during a drag) and
// `commit()` when a change is complete and should become an undo step.
import * as db from './db.js';
import { uid, clone } from './util.js';
import { syncDoc } from './script.js';
import { demoDoc } from './demo.js';

export const S = {
  doc: null,
  assets: {},          // asset id -> data URL
  projects: [],
  ui: { view: 'editor', pageIdx: 0, panelId: null, bubbleId: null, modal: null, toast: null, busy: {}, wsTab: 'setup' },
};
const subs = new Set();
let history = [], future = [], last = '';
let dirtyAssets = new Set();
let saveTimer = null;

export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export function touch() { subs.forEach((f) => f()); }

export function commit() {
  const now = JSON.stringify(S.doc);
  if (now === last) return touch();
  history.push(last); if (history.length > 120) history.shift();
  future = []; last = now;
  scheduleSave(); touch();
}
export const canUndo = () => history.length > 0;
export const canRedo = () => future.length > 0;
export function undo() {
  if (!history.length) return;
  future.push(last); last = history.pop(); S.doc = JSON.parse(last);
  fixSelection(); scheduleSave(); touch();
}
export function redo() {
  if (!future.length) return;
  history.push(last); last = future.pop(); S.doc = JSON.parse(last);
  fixSelection(); scheduleSave(); touch();
}
function fixSelection() {
  S.ui.pageIdx = Math.min(S.ui.pageIdx, S.doc.pages.length - 1);
  if (S.ui.panelId && !findPanel(S.ui.panelId)) { S.ui.panelId = null; S.ui.bubbleId = null; if (S.ui.view === 'panel') S.ui.view = 'editor'; }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
}
export async function flush() {
  clearTimeout(saveTimer);
  if (!S.doc) return;
  try {
    const entries = [...dirtyAssets].map((k) => [k, S.assets[k]]);
    dirtyAssets = new Set();
    if (entries.length) await db.saveAssets(S.doc.id, entries);
    await db.saveProject(S.doc);
  } catch (e) {
    console.error(e);
    toast('Could not save to this browser. Use Export, Save project file to keep your work.', 'error');
  }
}

export function putAsset(dataUrl) {
  const id = uid('as');
  S.assets[id] = dataUrl; dirtyAssets.add(id);
  return id;
}
export const asset = (id) => (id ? S.assets[id] : null);

export function findPanel(id) {
  for (let pi = 0; pi < S.doc.pages.length; pi++) {
    const i = S.doc.pages[pi].panels.findIndex((p) => p.id === id);
    if (i >= 0) return { panel: S.doc.pages[pi].panels[i], page: S.doc.pages[pi], pageIdx: pi, idx: i };
  }
  return null;
}
export const currentPanel = () => (S.ui.panelId ? findPanel(S.ui.panelId)?.panel : null);

let toastTimer;
export function toast(msg, kind = 'info') {
  S.ui.toast = { msg, kind };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.ui.toast = null; touch(); }, kind === 'error' ? 7000 : 2600);
  touch();
}

export function newDoc(title = 'Untitled comic') {
  return syncDoc({
    id: uid('proj'), version: 1, title,
    style: { preset: 'ink', custom: '', refAsset: null },
    caps: true,
    characters: [],
    script: 'PAGE 1\n\nPANEL 1 (wide)\nDescribe what we see in this panel.\nCAPTION: Write a caption or a line of dialogue here.\n\nPANEL 2\n\nPANEL 3\n',
    pages: [],
  });
}

async function openDoc(doc, assets) {
  S.doc = syncDoc(doc); S.assets = assets || {};
  history = []; future = []; last = JSON.stringify(S.doc);
  S.ui.pageIdx = 0; S.ui.panelId = S.doc.pages[0]?.panels[0]?.id || null; S.ui.bubbleId = null; S.ui.view = 'editor';
  localStorage.setItem('cc.lastProject', S.doc.id);
  S.projects = await db.listProjects().catch(() => []);
  touch();
}
export async function boot() {
  let projects = [];
  try { projects = await db.listProjects(); } catch (e) { console.warn(e); }
  const lastId = localStorage.getItem('cc.lastProject');
  const pick = projects.find((p) => p.id === lastId) || projects[0];
  if (pick) {
    const rec = await db.loadProject(pick.id);
    await openDoc(rec.doc, await db.loadAssets(pick.id));
  } else {
    await openDoc(demoDoc(), {});
    dirtyAssets = new Set(Object.keys(S.assets));
    await flush();
    S.projects = await db.listProjects().catch(() => []);
    touch();
  }
}
export async function switchProject(id) {
  await flush();
  const rec = await db.loadProject(id);
  if (rec) await openDoc(rec.doc, await db.loadAssets(id));
}
export async function createProject(doc, assets = {}) {
  await flush();
  await openDoc(doc, assets);
  dirtyAssets = new Set(Object.keys(S.assets));
  await flush();
  S.projects = await db.listProjects();
  touch();
}
export async function removeProject(id) {
  await db.deleteProject(id);
  S.projects = await db.listProjects();
  if (S.doc.id === id) {
    if (S.projects[0]) await switchProject(S.projects[0].id);
    else await createProject(newDoc());
  } else touch();
}
export async function duplicateProject() {
  const doc = clone(S.doc); doc.id = uid('proj'); doc.title += ' copy';
  await createProject(doc, { ...S.assets });
}
/** Asset ids that the document still refers to. */
export function usedAssets(doc = S.doc) {
  const used = new Set();
  if (doc.style.refAsset) used.add(doc.style.refAsset);
  doc.characters.forEach((c) => c.refAsset && used.add(c.refAsset));
  doc.pages.forEach((pg) => pg.panels.forEach((p) => {
    [p.setupAsset, p.artAsset, ...(p.options || []).map((o) => o.asset)].forEach((a) => a && used.add(a));
  }));
  return used;
}
window.addEventListener('beforeunload', () => { flush(); });

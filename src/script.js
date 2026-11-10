// The script is the source of truth for what is on each page. It is plain text:
//
//   PAGE 1
//   PANEL 1 (wide)
//   The lighthouse at dusk.
//   CAPTION: The light had not gone out in ninety years.
//   MARA: Grandpa?
//   MARA (thought): He never leaves the lamp.
//   SFX: KRAKOOM
//
// parseScript turns that text into pages and panels. syncDoc then merges the result into
// the document so that art, set ups and bubble positions stay attached to their panels
// while the writer keeps typing.
import { uid, CHARACTER_COLORS } from './util.js';

export const SIZES = ['half', 'wide', 'third', 'big', 'splash'];
const SIZE_WORDS = { wide: 'wide', full: 'wide', big: 'big', large: 'big', tall: 'big', splash: 'splash', third: 'third', small: 'third', half: 'half' };
const PAGE_RE = /^page\b(\s+[\w-]+)?\s*[:.]?\s*$/i;
const PANEL_RE = /^panel\b\s*\d*\s*(.*)$/i;
const LINE_RE = /^([A-Z][A-Z0-9 '’.\-]{0,28}?)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/;
const NON_CHARACTERS = new Set(['CAPTION', 'SFX', 'NARRATOR', 'NARRATION', 'NOTE', 'TITLE']);

function lineType(who, mod) {
  const m = (mod || '').toLowerCase();
  if (who === 'CAPTION' || who === 'NARRATOR' || who === 'NARRATION' || who === 'TITLE') return 'caption';
  if (who === 'SFX') return 'sfx';
  if (/thought|think/.test(m)) return 'thought';
  if (/shout|yell|scream|loud/.test(m)) return 'shout';
  if (/whisper|quiet|soft/.test(m)) return 'whisper';
  return 'speech';
}

export function parseScript(text) {
  const pages = [];
  let page = null, panel = null;
  const rows = text.split('\n');
  const newPage = (i) => { page = { line: i, panels: [] }; pages.push(page); panel = null; };
  const newPanel = (i, size = 'half') => {
    if (!page) newPage(i);
    panel = { line: i, endLine: i, size, description: '', lines: [] };
    page.panels.push(panel);
  };
  rows.forEach((raw, i) => {
    const s = raw.trim();
    if (!s) return;
    if (PAGE_RE.test(s)) return newPage(i);
    const pm = s.match(PANEL_RE);
    if (pm) {
      let rest = pm[1].replace(/^[\s·•\-–—:,.(]+/, '');
      let size = 'half';
      const hint = rest.match(/^([a-z]+)\)?[\s·•\-–—:,.)]*/i);
      if (hint && SIZE_WORDS[hint[1].toLowerCase()]) { size = SIZE_WORDS[hint[1].toLowerCase()]; rest = rest.slice(hint[0].length); }
      newPanel(i, size);
      if (rest.trim()) panel.description = rest.trim();
      return;
    }
    const lm = s.match(LINE_RE);
    if (lm && lm[3].trim()) {
      if (!panel) newPanel(i);
      const who = lm[1].trim();
      panel.lines.push({ type: lineType(who, lm[2]), who, text: lm[3].trim() });
      panel.endLine = i;
      return;
    }
    if (!panel) { if (!page) return; newPanel(i); }
    panel.description += (panel.description ? ' ' : '') + s;
    panel.endLine = i;
  });
  if (!pages.length) pages.push({ line: 0, panels: [] });
  return pages;
}

export function emptySetup() {
  return { mode: '2d', d2: null, d3: null };
}
export function newPanelDoc() {
  return {
    id: uid('pn'), size: 'half', description: '', lines: [], bubbles: [],
    setup: emptySetup(), setupAsset: null, artAsset: null, options: [],
    fit: { x: 0.5, y: 0.5, zoom: 1 }, notes: '', cast: {},
  };
}

/** Merge parsed script structure into doc.pages, keeping existing panels where they still exist. */
export function syncDoc(doc) {
  const parsed = parseScript(doc.script);
  const old = [];
  doc.pages.forEach((pg, pi) => pg.panels.forEach((pn, i) => old.push({ pn, pi, i, used: false })));
  const sig = (p) => p.description.trim().toLowerCase();
  const sigCount = {};
  old.forEach((o) => { const k = sig(o.pn); if (k) sigCount[k] = (sigCount[k] || 0) + 1; });

  const assign = parsed.map((pg) => pg.panels.map(() => null));
  // Pass 1: a panel whose description is unchanged keeps its identity even if it moved.
  let cursor = 0;
  parsed.forEach((pg, pi) => pg.panels.forEach((pp, i) => {
    const k = sig(pp);
    if (!k) return;
    for (let j = cursor; j < old.length; j++) {
      if (!old[j].used && sig(old[j].pn) === k) { old[j].used = true; assign[pi][i] = old[j].pn; cursor = j + 1; return; }
    }
  }));
  // Pass 2: otherwise a panel in the same position is the same panel being edited.
  parsed.forEach((pg, pi) => pg.panels.forEach((pp, i) => {
    if (assign[pi][i]) return;
    const o = old.find((o) => !o.used && o.pi === pi && o.i === i);
    if (o) { o.used = true; assign[pi][i] = o.pn; }
  }));

  doc.pages = parsed.map((pg, pi) => {
    const prev = doc.pages[pi];
    const page = { id: prev ? prev.id : uid('pg'), rowW: prev?.rowW || null, colW: prev?.colW || null, line: pg.line, panels: [] };
    pg.panels.forEach((pp, i) => {
      const pn = assign[pi][i] || newPanelDoc();
      pn.size = pp.size; pn.description = pp.description;
      pn.line = pp.line; pn.endLine = pp.endLine;
      pn.bubbles = pp.lines.map((ln, bi) => {
        const b = pn.bubbles[bi];
        const sameKind = b && (pn.lines[bi]?.type === ln.type);
        return sameKind ? b : { id: uid('bb'), auto: true, autoTail: true };
      });
      pn.lines = pp.lines;
      page.panels.push(pn);
    });
    return page;
  });

  // Anyone who speaks becomes a character with a sheet.
  const known = new Set(doc.characters.map((c) => c.name.toUpperCase()));
  for (const pg of parsed) for (const pp of pg.panels) for (const ln of pp.lines) {
    if (NON_CHARACTERS.has(ln.who) || known.has(ln.who)) continue;
    known.add(ln.who);
    doc.characters.push({
      id: uid('ch'), name: ln.who.charAt(0) + ln.who.slice(1).toLowerCase(),
      color: CHARACTER_COLORS[doc.characters.length % CHARACTER_COLORS.length], description: '', refAsset: null,
    });
  }
  return doc;
}

/** Characters that appear in a panel: speakers, named in the description, placed in the set up, or pinned by hand. */
export function panelCast(doc, panel) {
  const text = (panel.description + ' ' + (panel.notes || '')).toLowerCase();
  const inSetup = new Set();
  for (const o of panel.setup?.d2?.objects || []) if (o.type === 'figure' && o.charId) inSetup.add(o.charId);
  for (const o of panel.setup?.d3?.objects || []) if (o.type === 'figure' && o.charId) inSetup.add(o.charId);
  return doc.characters.filter((c) => {
    if (panel.cast && c.id in panel.cast) return panel.cast[c.id];
    const n = c.name.toLowerCase();
    if (inSetup.has(c.id)) return true;
    if (panel.lines.some((l) => l.who.toLowerCase() === n)) return true;
    return n.length > 1 && new RegExp('\\b' + n.replace(/[^\w ]/g, '') + '\\b').test(text);
  });
}

/** Rewrite the size hint on a panel's heading line in the script. */
export function setPanelSize(doc, panel, size) {
  const rows = doc.script.split('\n');
  const n = (rows[panel.line].match(/^\s*panel\s*(\d*)/i) || [])[1] || '';
  const m = rows[panel.line].trim().match(PANEL_RE);
  if (!m) return;
  let rest = m[1].replace(/^[\s·•\-–—:,.(]+/, '');
  const hint = rest.match(/^([a-z]+)\)?[\s·•\-–—:,.)]*/i);
  if (hint && SIZE_WORDS[hint[1].toLowerCase()]) rest = rest.slice(hint[0].length);
  rows[panel.line] = `PANEL ${n}`.trim() + (size === 'half' ? '' : ` (${size})`) + (rest.trim() ? ' ' + rest.trim() : '');
  doc.script = rows.join('\n');
}

/** Delete a panel: its heading and everything under it leave the script, and its art goes with it. */
export function removePanel(doc, panelId) {
  const page = doc.pages.find((pg) => pg.panels.some((pn) => pn.id === panelId));
  if (!page) return false;
  const idx = page.panels.findIndex((pn) => pn.id === panelId);
  const rows = doc.script.split('\n');
  const start = page.panels[idx].line;
  // The panel's text runs until the next PANEL or PAGE heading, or the end of the script.
  let end = rows.length;
  for (let i = start + 1; i < rows.length; i++) {
    const s = rows[i].trim();
    if (PAGE_RE.test(s) || PANEL_RE.test(s)) { end = i; break; }
  }
  rows.splice(start, end - start);
  // Drop the panel from the document first so the panels after it keep their own art when positions shift.
  page.panels.splice(idx, 1);
  doc.script = renumber(rows.join('\n'));
  syncDoc(doc);
  return true;
}

/** Renumber PAGE and PANEL headings so they always count up from 1. */
export function renumber(script) {
  let pg = 0, pn = 0;
  return script.split('\n').map((raw) => {
    const s = raw.trim();
    if (PAGE_RE.test(s)) { pg++; pn = 0; return `PAGE ${pg}`; }
    if (PANEL_RE.test(s)) { pn++; return raw.replace(/^(\s*)panel\b\s*\d*/i, `$1PANEL ${pn}`); }
    return raw;
  }).join('\n');
}

// The panel workspace: set up a panel on the 2D or 3D stage, then stylize it with image generation.
import { useEffect, useState, useRef, useLayoutEffect } from 'preact/hooks';
import { S, touch, commit, asset, putAsset, findPanel, toast } from './store.js';
import { layoutPage } from './layout.js';
import { panelCast } from './script.js';
import { Stage2D, newD2, W, snapshot2D, addFigure, addProp, applyPose, flipFigure, reorder, removeSel, duplicateSel, setCamera, PEN_COLORS } from './stage2d.jsx';
import { Stage3D, Lib3D, newD3, snapshot3D, has3D } from './stage3d.jsx';
import { Figure, POSES, newFigure, figureBounds } from './figure2d.jsx';
import { PROPS, BACKGROUNDS, TONE_NAMES, Background } from './library2d.jsx';
import { STYLES, buildRequest, generate, hasKey, getSettings, saveSettings } from './ai.js';
import { bubbleGeom } from './render.js';
import { Prim } from './pageview.jsx';
import { Btn, Seg, Slider } from './ui.jsx';
import { Icon } from './icons.jsx';
import { CHARACTER_COLORS, fileToDataUrl, pickFile, shrinkImage } from './util.js';

const ws = () => (S.ui.ws ||= { tool: 'select', sel: null, penColor: '#23232a', penWidth: 8, shapeColor: '#b9b2a4', sel3: null, showLettering: true });

function panelAspect(found) {
  const r = layoutPage(found.page).rects.find((r) => r.id === found.panel.id);
  return { aspect: r.w / r.h, rect: r };
}
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };
const d2Empty = (d2) => !d2 || (!d2.objects.length && d2.bg.kind === 'blank' && !d2.light);

/** Bring a panel's set up picture up to date. Returns true if there is a set up to send. */
export async function updateSetupSnapshot(panel) {
  const s = panel.setup;
  if (s.mode === '2d') {
    if (d2Empty(s.d2)) { panel.setupAsset = null; panel.setupSig = null; return false; }
    const sig = hash(JSON.stringify(s.d2) + JSON.stringify(S.doc.characters.map((c) => c.color)));
    if (sig !== panel.setupSig || !asset(panel.setupAsset)) { panel.setupAsset = putAsset(await snapshot2D(s.d2, S.doc)); panel.setupSig = sig; }
    return true;
  }
  if (!s.d3 || !s.d3.objects.length) { panel.setupAsset = null; panel.setupSig = null; return false; }
  const sig = hash(JSON.stringify(s.d3) + '3d');
  if (has3D() && (sig !== panel.setupSig || !asset(panel.setupAsset))) {
    const shot = await snapshot3D();
    if (shot) { panel.setupAsset = putAsset(shot); panel.setupSig = sig; }
  }
  return !!asset(panel.setupAsset);
}

export function closeWorkspace() {
  const p = S.ui.panelId && findPanel(S.ui.panelId)?.panel;
  if (p) updateSetupSnapshot(p).then(commit).catch(console.error);
  if (S.ui.ws) { S.ui.ws.sel = null; S.ui.ws.sel3 = null; S.ui.ws.tool = 'select'; }
}

/** Make set up pictures for any panels that have a 2D set up but no picture yet. */
export async function refreshSnapshots() {
  let changed = false;
  for (const pg of S.doc.pages) for (const p of pg.panels) {
    if (p.setup?.mode === '2d' && !d2Empty(p.setup.d2) && !asset(p.setupAsset)) { await updateSetupSnapshot(p); changed = true; }
  }
  if (changed) commit();
}

// ---------- left panel: library and selection ----------
function PoseThumb({ id, color }) {
  const f = newFigure(0, 0, null, id); const b = figureBounds(f);
  const s = Math.max(b.x2 - b.x, b.y2 - b.y) + 20, cx = (b.x + b.x2) / 2, cy = (b.y + b.y2) / 2;
  return <svg viewBox={`${cx - s / 2} ${cy - s / 2} ${s} ${s}`}><Figure f={f} color={color} /></svg>;
}
function Swatches({ value, colors, onPick }) {
  return <div class="swatches">{colors.map((c) => <button class={`swatch ${c === value ? 'on' : ''}`} style={`background:${c}`} onClick={() => onPick(c)} />)}
    <input type="color" value={value} onInput={(e) => onPick(e.target.value, true)} onChange={commit} style="width:24px;height:24px;padding:0;border:0;background:none;cursor:pointer" title="Any color" /></div>;
}
const PROP_COLORS = ['#f2f0ea', '#b9b2a4', '#8d96a3', '#33363d', '#9b6a43', '#d64545', '#e8833a', '#f2c94c', '#4c9a55', '#3f76c9', '#8257c4'];

function Selected2D({ d2 }) {
  const w = ws(), doc = S.doc;
  if (w.sel === 'light' && d2.light) return (
    <div class="sec">
      <div class="lab">Light<span class="grow" /><Btn kind="ghost sm" icon="trash" title="Remove" onClick={() => removeSel(d2, w)} /></div>
      <Slider label="Reach" min={80} max={700} value={d2.light.r || 240} onInput={(v) => { d2.light.r = v; touch(); }} onChange={commit} />
      <p class="hint" style="margin:0">Drag the sun to where the light comes from. It is drawn as a glow in the set up and described to the image model.</p>
    </div>
  );
  const o = d2.objects.find((o) => o.id === w.sel);
  if (!o) return null;
  const tools = (
    <div class="row" style="margin-top:10px">
      <Btn kind="sm" icon="up" title="Bring forward" onClick={() => reorder(d2, o.id, 1)} />
      <Btn kind="sm" icon="down" title="Send backward" onClick={() => reorder(d2, o.id, -1)} />
      <Btn kind="sm" icon="copy" title="Duplicate" onClick={() => duplicateSel(d2, w)} />
      <Btn kind="sm danger" icon="trash" title="Delete" onClick={() => removeSel(d2, w)} />
    </div>
  );
  if (o.type === 'figure') {
    const ch = doc.characters.find((c) => c.id === o.charId);
    return (
      <div class="sec">
        <div class="lab">Selected figure</div>
        <div class="chips" style="margin-bottom:12px">
          {doc.characters.map((c) => <button class={`chip ${c.id === o.charId ? 'on' : ''}`} onClick={() => { o.charId = c.id; commit(); }}><span class="dot" style={`background:${c.color}`} />{c.name}</button>)}
          <button class={`chip ${!o.charId ? 'on' : ''}`} onClick={() => { o.charId = null; commit(); }}><span class="dot" style="background:#8d96a3" />Extra</button>
        </div>
        <div class="lab">Pose</div>
        <div class="grid4" style="margin-bottom:12px">
          {Object.entries(POSES).map(([id, p]) => <button class="cell" title={p.name} onClick={() => applyPose(o, id)}><PoseThumb id={id} color={ch?.color} /></button>)}
        </div>
        <div class="lab">Facing</div>
        <Seg class="block quiet" value={o.facing} options={[['front', 'Front'], ['left', 'Left'], ['right', 'Right'], ['back', 'Back']]} onChange={(v) => { o.facing = v; commit(); }} />
        <div style="height:12px" />
        <Slider label="Size" min={0.2} max={4} step={0.01} value={o.scale} fmt={(v) => Math.round(v * 100) + '%'} onInput={(v) => { o.scale = v; touch(); }} onChange={commit} />
        <div class="row"><Btn kind="sm" icon="flip" onClick={() => flipFigure(o)}>Mirror</Btn></div>
        {tools}
        <p class="hint" style="margin:10px 0 0">Drag the yellow dots to pose. Hands and feet pull the whole limb.</p>
      </div>
    );
  }
  if (o.type === 'label') return (
    <div class="sec">
      <div class="lab">Note</div>
      <input class="input" value={o.text} onInput={(e) => { o.text = e.target.value || ' '; touch(); }} onChange={commit} />
      <p class="hint" style="margin:8px 0 0">Notes are not drawn in the set up picture. They are passed to the image model as directions for that part of the frame.</p>
      {tools}
    </div>
  );
  return (
    <div class="sec">
      <div class="lab">Selected {o.type === 'prop' ? PROPS[o.kind].name.toLowerCase() : o.type === 'stroke' ? 'pencil line' : 'shape'}</div>
      <Swatches value={o.color} colors={PROP_COLORS} onPick={(c, live) => { o.color = c; live ? touch() : commit(); }} />
      {o.type === 'prop' && <Slider label="Size" min={0.15} max={5} step={0.01} value={o.scale} fmt={(v) => Math.round(v * 100) + '%'} onInput={(v) => { o.scale = v; touch(); }} onChange={commit} />}
      {(o.type === 'prop' || (o.type === 'shape' && o.kind !== 'line')) && <Slider label="Turn" min={-180} max={180} value={Math.round(o.rot || 0)} fmt={(v) => v + '°'} onInput={(v) => { o.rot = v; touch(); }} onChange={commit} />}
      {(o.type === 'stroke' || o.kind === 'line') && <Slider label="Thickness" min={2} max={60} value={o.width} onInput={(v) => { o.width = v; touch(); }} onChange={commit} />}
      {o.type === 'prop' && <div class="row"><Btn kind="sm" icon="flip" onClick={() => { o.flip = !o.flip; commit(); }}>Mirror</Btn></div>}
      {tools}
    </div>
  );
}

function Lib2D({ d2 }) {
  const w = ws(), doc = S.doc;
  return (
    <div class="ws-lib">
      <Selected2D d2={d2} />
      <div class="sec">
        <div class="lab">Add a figure</div>
        <div class="chips">
          {doc.characters.map((c) => <button class="chip" onClick={() => addFigure(d2, w, c.id)}><span class="dot" style={`background:${c.color}`} />{c.name}</button>)}
          <button class="chip dashed" onClick={() => addFigure(d2, w, null)}><Icon name="plus" size={12} />Extra</button>
        </div>
      </div>
      <div class="sec">
        <div class="lab">Props</div>
        <div class="grid4">
          {Object.entries(PROPS).map(([k, p]) => { const s = Math.max(p.w, p.h) + 30; return <button class="cell" title={p.name} onClick={() => addProp(d2, w, k)}><svg viewBox={`${-s / 2} ${-s / 2} ${s} ${s}`}>{p.draw(p.color)}</svg></button>; })}
        </div>
      </div>
      <div class="sec">
        <div class="lab">Background</div>
        <div class="grid3" style="margin-bottom:10px">
          {Object.entries(BACKGROUNDS).map(([k, name]) => (
            <button class={`cell ${d2.bg.kind === k ? 'on' : ''}`} title={name} style="aspect-ratio:4/3" onClick={() => { d2.bg.kind = k; commit(); }}>
              <svg viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid slice"><Background kind={k} tone={d2.bg.tone} W={1000} H={750} gid={'th' + k} /></svg>
            </button>
          ))}
        </div>
        <Seg class="block quiet" value={d2.bg.tone} options={Object.entries(TONE_NAMES)} onChange={(v) => { d2.bg.tone = v; commit(); }} />
      </div>
      <div class="sec">
        <div class="lab">Camera</div>
        <div class="chips">
          {[['wide', 'Wide'], ['full', 'Full figure'], ['medium', 'Medium'], ['close', 'Close-up']].map(([k, n]) => <button class="chip" onClick={() => setCamera(d2, w, k)}>{n}</button>)}
        </div>
        <p class="hint" style="margin:8px 0 0">Two-finger scroll moves the view and pinch zooms. You can also drag empty space.</p>
      </div>
    </div>
  );
}

// ---------- right panel: stylize ----------
async function runStylize(panelId, useSetup, aspect) {
  const ui = S.ui;
  const p = findPanel(panelId)?.panel; if (!p) return;
  ui.busy[panelId] = useSetup ? 'setup' : 'script'; ui.aiError = null; touch();
  try {
    if (useSetup) await updateSetupSnapshot(p);
    const { prompt, images } = buildRequest(S.doc, p, { useSetup });
    const cfg = getSettings();
    const urls = await generate({ prompt, images, aspect, count: cfg.count, quality: cfg.quality });
    const target = findPanel(panelId)?.panel;
    if (!urls.length) throw new Error('OpenAI returned no images.');
    if (target) {
      const opts = urls.map((u) => ({ asset: putAsset(u), from: useSetup ? 'setup' : 'script' }));
      target.options = [...opts, ...(target.options || [])].slice(0, 12);
      target.artAsset = opts[0].asset; target.fit = { x: 0.5, y: 0.5, zoom: 1 };
      if (!S.doc.style.refAsset) S.doc.style.refAsset = null;
      toast(`${urls.length} ${urls.length === 1 ? 'option' : 'options'} ready`);
    }
  } catch (e) { console.error(e); ui.aiError = e.message; }
  delete ui.busy[panelId];
  commit();
}

function StylizePanel({ found, aspect }) {
  const doc = S.doc, ui = S.ui, { panel } = found;
  const [showPrompt, setShowPrompt] = useState(false);
  const cfg = getSettings();
  const busy = ui.busy[panel.id];
  const setupImg = asset(panel.setupAsset);
  const hasSetup = panel.setup.mode === '2d' ? !d2Empty(panel.setup.d2) : !!panel.setup.d3?.objects.length;
  const req = buildRequest(doc, panel, { useSetup: hasSetup });
  const art = asset(panel.artAsset);
  const set = (k, v) => { saveSettings({ ...cfg, [k]: v }); touch(); };
  return (
    <div class="ws-right">
      <div class="sec">
        <div class="lab">Stylize</div>
        <div class="ba">
          <div class="im">{setupImg ? <img src={setupImg} /> : <span>No set up yet</span>}<span class="badge">Set up</span></div>
          <Icon name="chevRight" size={18} style="color:var(--acc)" />
          <div class="im">{art ? <img src={art} /> : <span>{busy ? <span class="spin" /> : 'Not stylized yet'}</span>}<span class="badge">Result</span></div>
        </div>
      </div>
      <div class="sec">
        <div class="lab">Style for this comic</div>
        <div class="chips">
          {Object.entries(STYLES).filter(([k]) => k !== 'custom').map(([k, s]) => <button class={`chip ${doc.style.preset === k ? 'on' : ''}`} onClick={() => { doc.style.preset = k; commit(); }}>{s.name}</button>)}
          <button class={`chip ${doc.style.preset === 'custom' ? 'on' : ''}`} onClick={() => { ui.modal = 'style'; touch(); }}>Custom…</button>
        </div>
      </div>
      {hasSetup && <div class="sec">
        <div class="lab">How closely to follow your set up</div>
        <div class="slider" style="margin-bottom:2px"><input type="range" min="0" max="1" step="0.01" value={panel.fidelity ?? 0.7} onInput={(e) => { panel.fidelity = parseFloat(e.target.value); touch(); }} onChange={commit} /></div>
        <div style="display:flex;justify-content:space-between" class="hint"><span>Loose</span><span>Exact</span></div>
      </div>}
      <div class="sec">
        <div class="lab">Extra direction for this panel</div>
        <textarea class="textarea" style="min-height:54px" placeholder="Mood, weather, expression, anything the script line leaves out." value={panel.notes || ''} onInput={(e) => { panel.notes = e.target.value; touch(); }} onChange={commit} />
      </div>
      <div class="sec">
        <div class="lab">Sent with the request</div>
        <div class="sent">
          {req.images.map((im) => <div><img src={im.src} />{im.label}</div>)}
          {panelCast(doc, panel).filter((c) => !asset(c.refAsset)).map((c) => <div><span class="noimg"><Icon name="users" size={14} /></span>{c.name}: {c.description ? 'description only, no reference image' : 'no description or reference yet'}</div>)}
          <div><span class="noimg"><Icon name="type" size={14} /></span>Panel description and style
            <button class="chip" style="margin-left:auto" onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? 'Hide' : 'Show'} prompt</button></div>
        </div>
        {showPrompt && <div class="prompt-box" style="margin-top:10px">{req.prompt}</div>}
      </div>
      <div class="sec">
        <div class="row" style="margin-bottom:10px">
          <div style="flex:1"><div class="lab">Options</div><Seg class="block quiet" value={cfg.count} options={[[1, '1'], [2, '2'], [4, '4']]} onChange={(v) => set('count', v)} /></div>
          <div style="flex:1.6"><div class="lab">Quality</div><Seg class="block quiet" value={cfg.quality} options={[['low', 'Draft'], ['medium', 'Good'], ['high', 'Best']]} onChange={(v) => set('quality', v)} /></div>
        </div>
        {!hasKey() && <div class="notice" style="margin-bottom:10px">Add your OpenAI API key to generate art. It stays in this browser.
          <div style="margin-top:8px"><Btn kind="sm" icon="key" onClick={() => { ui.modal = 'settings'; touch(); }}>Add API key</Btn></div></div>}
        {ui.aiError && <div class="notice err" style="margin-bottom:10px">{ui.aiError}</div>}
        <Btn kind="pri lg block" icon="wand" busy={busy === 'setup'} disabled={!hasKey() || !hasSetup || !!busy} onClick={() => runStylize(panel.id, true, aspect)}>
          {busy === 'setup' ? 'Stylizing…' : 'Stylize this panel'}
        </Btn>
        <div style="height:8px" />
        <Btn kind="block" icon="type" busy={busy === 'script'} disabled={!hasKey() || !!busy} onClick={() => runStylize(panel.id, false, aspect)}>
          {busy === 'script' ? 'Generating…' : 'Generate from the script only'}
        </Btn>
        {!hasSetup && <p class="hint" style="margin:8px 0 0">Add figures or a background in Set up to control the composition, or generate straight from the script.</p>}
      </div>
      <div class="sec">
        <div class="lab">Results</div>
        {panel.options?.length ? <div class="opts">
          {panel.options.map((o) => (
            <div class={`opt ${o.asset === panel.artAsset ? 'on' : ''}`} onClick={() => { panel.artAsset = o.asset; commit(); }}>
              <img src={asset(o.asset)} />
              <button class="del" title="Remove" onClick={(e) => { e.stopPropagation(); panel.options = panel.options.filter((x) => x !== o); if (panel.artAsset === o.asset) panel.artAsset = panel.options[0]?.asset || null; commit(); }}><Icon name="x" size={13} /></button>
            </div>
          ))}
        </div> : <p class="hint" style="margin:0">Your generated options will appear here. Pick the one you like and it goes into the panel.</p>}
        <div class="row" style="margin-top:10px;flex-wrap:wrap">
          <Btn kind="sm" icon="upload" onClick={async () => {
            const f = await pickFile('image/*'); if (!f) return;
            const a = putAsset(await shrinkImage(await fileToDataUrl(f), 2048));
            panel.options = [{ asset: a, from: 'upload' }, ...(panel.options || [])]; panel.artAsset = a; commit();
          }}>Use my own image</Btn>
          {setupImg && <Btn kind="sm" icon="layers" onClick={() => { const a = panel.setupAsset; if (!panel.options?.some((o) => o.asset === a)) panel.options = [{ asset: a, from: 'setup-raw' }, ...(panel.options || [])]; panel.artAsset = a; commit(); }}>Use set up as art</Btn>}
        </div>
        {art && <div style="margin-top:8px"><Btn kind={`sm ${doc.style.refAsset === panel.artAsset ? 'on' : ''}`} icon="palette" onClick={() => { doc.style.refAsset = doc.style.refAsset === panel.artAsset ? null : panel.artAsset; commit(); }}>
          {doc.style.refAsset === panel.artAsset ? 'This is the style reference' : 'Use as style reference for the comic'}</Btn></div>}
      </div>
    </div>
  );
}

function ResultView({ found, rect }) {
  const { panel } = found, w = ws();
  const src = asset(panel.artAsset) || asset(panel.setupAsset);
  const r = { x: 0, y: 0, w: rect.w, h: rect.h };
  return (
    <svg viewBox={`0 0 ${rect.w} ${rect.h}`}>
      <rect width={rect.w} height={rect.h} fill="#ebe7dd" />
      {src ? <image href={src} width={rect.w} height={rect.h} preserveAspectRatio="xMidYMid slice" />
        : <text x={rect.w / 2} y={rect.h / 2} text-anchor="middle" font-size="20" font-family="system-ui,sans-serif" fill="#a9a294">Nothing to show yet</text>}
      {w.showLettering && panel.lines.map((_, i) => bubbleGeom(S.doc, panel, i, r).prims.map((p, k) => <Prim p={p} k={'rv' + i + k} />))}
    </svg>
  );
}

/** Size the stage to the largest box of the panel's proportions that fits the space available. */
function useFit(aspect) {
  const ref = useRef();
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => { const w = el.clientWidth - 48, h = el.clientHeight - 28; setBox((b) => (b.w === w && b.h === h ? b : { w, h })); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const w = Math.max(50, Math.min(box.w, box.h * aspect));
  return [ref, `width:${w}px;height:${w / aspect}px`];
}

export function Workspace() {
  const ui = S.ui, w = ws();
  const found = ui.panelId ? findPanel(ui.panelId) : null;
  useEffect(() => {
    const k = (e) => {
      const t = e.target;
      if (t.tagName === 'INPUT' && t.type !== 'range' || t.tagName === 'TEXTAREA' || ui.modal) return;
      const p = findPanel(ui.panelId)?.panel; if (!p || ui.wsTab !== 'setup') return;
      if (p.setup.mode === '3d') {
        if ((e.key === 'Delete' || e.key === 'Backspace') && w.sel3 && p.setup.d3) { e.preventDefault(); p.setup.d3.objects = p.setup.d3.objects.filter((o) => o.id !== w.sel3); w.sel3 = null; commit(); }
        return;
      }
      if (!p.setup.d2) return;
      const d2 = p.setup.d2, o = d2.objects.find((o) => o.id === w.sel);
      if ((e.key === 'Delete' || e.key === 'Backspace') && w.sel) { e.preventDefault(); removeSel(d2, w); }
      else if (e.key === 'Escape') { w.sel = null; w.tool = 'select'; touch(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && o) { e.preventDefault(); duplicateSel(d2, w); }
      else if (e.key.startsWith('Arrow') && o) {
        e.preventDefault();
        const s = e.shiftKey ? 20 : 4, dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0;
        if (o.type === 'stroke') { o.dx = (o.dx || 0) + dx; o.dy = (o.dy || 0) + dy; } else { o.x += dx; o.y += dy; if (o.kind === 'line') { o.x2 += dx; o.y2 += dy; } }
        commit();
      } else if (!e.metaKey && !e.ctrlKey) {
        const map = { v: 'select', p: 'pencil', r: 'rect', o: 'ellipse', l: 'line', n: 'label' };
        if (map[e.key]) { w.tool = map[e.key]; touch(); }
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const pa = found ? panelAspect(found) : { aspect: 1, rect: { w: 1, h: 1 } };
  const [fitRef, frameStyle] = useFit(pa.aspect);
  if (!found) { ui.view = 'editor'; return null; }
  const { panel, pageIdx, idx } = found;
  const { aspect, rect } = pa;
  const H = Math.round(W / aspect);
  const s = panel.setup;
  if (s.mode === '2d') {
    if (!s.d2) s.d2 = newD2(H);
    else if (Math.abs(s.d2.h - H) > 2) { s.d2.view.cy += (H - s.d2.h) / 2; s.d2.h = H; }
  } else if (!s.d3) s.d3 = newD3();

  const setTab = async (t) => {
    if (t === ui.wsTab) return;
    if (ui.wsTab === 'setup') { await updateSetupSnapshot(panel); commit(); }
    ui.wsTab = t; touch();
  };
  const setMode = async (m) => { if (m === s.mode) return; await updateSetupSnapshot(panel).catch(() => {}); s.mode = m; panel.setupSig = null; w.sel = null; commit(); };
  const done = () => { closeWorkspace(); ui.view = 'editor'; touch(); };
  const tools = [['select', 'Move', 'cursor'], ['pencil', 'Pencil', 'pencil'], ['rect', 'Box', 'square'], ['ellipse', 'Oval', 'circle'], ['line', 'Line', 'line'], ['label', 'Note', 'type'], ['light', 'Light', 'sun']];
  return (
    <>
      <div class="top" style="height:46px;background:var(--s2)">
        <Btn kind="ghost sm" icon="chevLeft" onClick={done}>Page {pageIdx + 1}</Btn>
        <b>Panel {idx + 1}</b>
        <span class="grow" />
        <Seg value={ui.wsTab} options={[['setup', '1 · Set up', 'layers'], ['stylize', '2 · Stylize', 'wand']]} onChange={setTab} />
        <span class="grow" />
        <Btn kind="pri sm" icon="check" onClick={done}>Done</Btn>
      </div>
      <div class="scriptbar"><b>PANEL {idx + 1}</b>&nbsp; {panel.description || 'No description yet.'}{panel.lines.map((l) => <>&nbsp; <b>{l.who}:</b> {l.text}</>)}</div>
      <div class="ws">
        {ui.wsTab === 'setup' && (s.mode === '2d' ? <Lib2D d2={s.d2} /> : <Lib3D d3={s.d3} ws={w} />)}
        <div class="ws-center">
          <div class="ws-tools">
            {ui.wsTab === 'setup' ? <>
              <Seg value={s.mode} options={[['2d', '2D', 'layers'], ['3d', '3D', 'cube']]} onChange={setMode} />
              {s.mode === '2d' && <div class="toolbar">
                {tools.map(([id, name, icon]) => <button class={`tool ${w.tool === id ? 'on' : ''}`} title={name} onClick={() => { w.tool = id; touch(); }}><Icon name={icon} size={15} />{name}</button>)}
              </div>}
              {s.mode === '2d' && <div class="toolbar">
                <button class="tool" title="Zoom out" onClick={() => { s.d2.view.zoom = Math.max(0.3, s.d2.view.zoom / 1.25); commit(); }}>−</button>
                <button class="tool" title="Reset the view" onClick={() => { s.d2.view = { cx: W / 2, cy: s.d2.h / 2, zoom: 1 }; commit(); }}>{Math.round(s.d2.view.zoom * 100)}%</button>
                <button class="tool" title="Zoom in" onClick={() => { s.d2.view.zoom = Math.min(6, s.d2.view.zoom * 1.25); commit(); }}>+</button>
              </div>}
              <div class="toolbar"><button class={`tool ${w.showLettering ? 'on' : ''}`} title="Show where the lettering will sit" onClick={() => { w.showLettering = !w.showLettering; touch(); }}><Icon name="type" size={15} />Lettering</button></div>
              {s.mode === '2d' && (w.tool === 'pencil' || w.tool === 'line') && <div class="toolbar" style="gap:6px;padding:4px 10px">
                {PEN_COLORS.map((c) => <button class={`swatch ${w.penColor === c ? 'on' : ''}`} style={`background:${c}`} onClick={() => { w.penColor = c; touch(); }} />)}
                <input type="range" min="2" max="40" value={w.penWidth} style="width:70px;flex:none" onInput={(e) => { w.penWidth = +e.target.value; touch(); }} />
              </div>}
              {s.mode === '2d' && (w.tool === 'rect' || w.tool === 'ellipse') && <div class="toolbar" style="gap:6px;padding:4px 10px">
                {PROP_COLORS.slice(0, 8).map((c) => <button class={`swatch ${w.shapeColor === c ? 'on' : ''}`} style={`background:${c}`} onClick={() => { w.shapeColor = c; touch(); }} />)}
              </div>}
            </> : <div class="toolbar"><button class={`tool ${w.showLettering ? 'on' : ''}`} onClick={() => { w.showLettering = !w.showLettering; touch(); }}><Icon name="type" size={15} />Show lettering</button></div>}
          </div>
          <div class="ws-stage" ref={fitRef}>
            <div class="stage-frame" style={frameStyle}>
              {ui.wsTab === 'stylize' ? <ResultView found={found} rect={rect} />
                : s.mode === '2d' ? <Stage2D d2={s.d2} ws={w} /> : <Stage3D d3={s.d3} ws={w} aspect={aspect} />}
              {ui.wsTab === 'setup' && w.showLettering && <svg class="letter-overlay" viewBox={`0 0 ${rect.w} ${rect.h}`}>
                {panel.lines.map((_, i) => bubbleGeom(S.doc, panel, i, { x: 0, y: 0, w: rect.w, h: rect.h }).prims.map((p, k) => <Prim p={p} k={'lo' + i + k} />))}
              </svg>}
            </div>
          </div>
        </div>
        <StylizePanel found={found} aspect={aspect} />
      </div>
    </>
  );
}

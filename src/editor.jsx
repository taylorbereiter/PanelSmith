// The main editor: script on the left, the page in the middle, panel details on the right.
import { useRef, useEffect, useState } from 'preact/hooks';
import { S, touch, commit, asset, findPanel, toast } from './store.js';
import { syncDoc, setPanelSize, renumber, panelCast } from './script.js';
import { PageView, PageStatic } from './pageview.jsx';
import { Btn, Seg, Slider, Modal } from './ui.jsx';
import { Icon } from './icons.jsx';

const HELP = `PAGE 1

PANEL 1 (wide)
What we see in the panel.
CAPTION: Narration in a box.
MARA: Spoken dialogue.
MARA (thought): A thought cloud.
MARA (shout): A spiky shout!
MARA (whisper): A dashed whisper.
SFX: KRAKOOM

Panel sizes: (wide) fills a row.
(big) is a taller full row.
(third) fits three in a row.
(splash) is a full page.
No hint means half a row.`;

let commitTimer;
function ScriptPane() {
  const doc = S.doc, ui = S.ui;
  const ta = useRef(), scroll = useRef();
  const [help, setHelp] = useState(false);
  const rows = doc.script.split('\n');
  const sel = ui.panelId ? findPanel(ui.panelId) : null;

  // Group lines into blocks so the selected panel can be highlighted as one card.
  const blocks = [];
  const starts = new Map();
  doc.pages.forEach((pg) => pg.panels.forEach((p) => starts.set(p.line, p)));
  let cur = { lines: [], panel: null };
  rows.forEach((text, i) => {
    const t = text.trim();
    const isPage = /^page\b(\s+[\w-]+)?\s*[:.]?\s*$/i.test(t);
    if (starts.has(i) || isPage) { if (cur.lines.length) blocks.push(cur); cur = { lines: [], panel: isPage ? null : starts.get(i) }; }
    else if (cur.panel && i > cur.panel.endLine) { blocks.push(cur); cur = { lines: [], panel: null }; }
    cur.lines.push({ i, text, cls: isPage ? 'page' : /^panel\b/i.test(t) ? 'panel' : '' });
  });
  if (cur.lines.length) blocks.push(cur);

  const onInput = (e) => {
    doc.script = e.target.value;
    syncDoc(doc);
    syncSelection();
    touch();
    clearTimeout(commitTimer);
    commitTimer = setTimeout(commit, 700);
  };
  const syncSelection = () => {
    const el = ta.current; if (!el) return;
    const line = el.value.slice(0, el.selectionStart).split('\n').length - 1;
    for (let pi = 0; pi < doc.pages.length; pi++) {
      const next = doc.pages[pi + 1];
      if (line >= doc.pages[pi].line && (!next || line < next.line)) {
        ui.pageIdx = pi;
        const p = doc.pages[pi].panels.find((p) => line >= p.line && line <= p.endLine);
        if (p && p.id !== ui.panelId) { ui.panelId = p.id; ui.bubbleId = null; }
      }
    }
  };
  const insert = (what) => {
    const el = ta.current;
    let at;
    if (what === 'page') at = rows.length;
    else if (sel) at = sel.panel.endLine + 1;
    else { const pg = doc.pages[ui.pageIdx], next = doc.pages[ui.pageIdx + 1]; at = next ? next.line : rows.length; }
    while (at > 0 && !rows[at - 1].trim()) at--;
    const add = what === 'page' ? ['', 'PAGE', '', 'PANEL', ''] : ['', 'PANEL', ''];
    rows.splice(at, 0, ...add);
    doc.script = renumber(rows.join('\n'));
    syncDoc(doc);
    const caretLine = at + add.length - 1;
    const pos = doc.script.split('\n').slice(0, caretLine).join('\n').length + 1;
    if (what === 'page') ui.pageIdx = doc.pages.length - 1;
    commit();
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos); syncSelection(); touch(); });
  };

  // Keep the selected panel's script block in view when it was selected from the page.
  useEffect(() => {
    if (document.activeElement === ta.current) return;
    const el = scroll.current?.querySelector('.blk.on');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [ui.panelId]);

  return (
    <div class="script">
      <div class="script-head">
        <div class="lab">Script</div>
        <button class="pbtn" onClick={() => insert('panel')}><Icon name="plus" size={13} />Panel</button>
        <button class="pbtn" onClick={() => insert('page')}><Icon name="plus" size={13} />Page</button>
        <button class="pbtn" title="How to write the script" onClick={() => setHelp(true)}><Icon name="help" size={14} /></button>
      </div>
      <div class="script-scroll" ref={scroll}>
        <div class="script-inner">
          <div class="script-back" aria-hidden="true">
            {blocks.map((b) => (
              <div class={`blk ${b.panel && b.panel.id === ui.panelId ? 'on' : ''}`}>
                {b.lines.map((l) => {
                  const m = !l.cls && l.text.match(/^(\s*[A-Z][A-Z0-9 '’.\-]{0,28}?\s*(?:\([^)]*\))?\s*:)(.*)$/);
                  return <div class={`sl ${l.cls}`}>{m ? <><span class="who">{m[1]}</span>{m[2]}</> : l.text || '​'}</div>;
                })}
              </div>
            ))}
          </div>
          <textarea class="script-ta" ref={ta} value={doc.script} spellcheck={false}
            onInput={onInput} onClick={() => { syncSelection(); touch(); }} onKeyUp={(e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key.startsWith('Page')) { syncSelection(); touch(); } }} />
        </div>
      </div>
      {help && <Modal title="Writing the script" onClose={() => setHelp(false)}>
        <p class="hint" style="margin-top:0">Type the script as plain text. The page on the right updates as you write, and art stays attached to its panel while you edit.</p>
        <div class="prompt-box script-help" style="max-height:none">{HELP}</div>
      </Modal>}
    </div>
  );
}

export const SIZE_LABELS = { half: 'Half', wide: 'Wide', third: 'Third', big: 'Big', splash: 'Splash' };
const TYPE_LABELS = { speech: 'Speech', thought: 'Thought', shout: 'Shout', whisper: 'Whisper', caption: 'Caption', sfx: 'SFX' };

function Inspector({ openPanel }) {
  const doc = S.doc, ui = S.ui;
  const found = ui.panelId ? findPanel(ui.panelId) : null;
  if (!found || found.pageIdx !== ui.pageIdx) {
    return <div class="insp"><div class="empty"><Icon name="grid" size={28} style="margin:0 auto 10px;opacity:.5" />Select a panel on the page to work on its art.<br /><br />Double-click a panel to open it.</div></div>;
  }
  const { panel, idx } = found;
  const cast = panelCast(doc, panel);
  const art = asset(panel.artAsset), setup = asset(panel.setupAsset);
  const bi = panel.bubbles.findIndex((b) => b.id === ui.bubbleId);
  return (
    <div class="insp">
      <div class="sec">
        <div class="lab">Panel {idx + 1} art</div>
        <div class="art-card">
          {art || setup ? <><img src={art || setup} /><span class="badge">{art ? 'Stylized' : 'Set up'}</span></>
            : <div class="ph">No art yet.<br />Set up the scene, then stylize it.</div>}
        </div>
        <div class="row">
          <Btn kind="pri" icon="layers" onClick={() => openPanel(panel.id, 'setup')}>{panel.setup?.d2 || panel.setup?.d3 ? 'Edit set up' : 'Set up'}</Btn>
          <Btn icon="wand" onClick={() => openPanel(panel.id, 'stylize')}>Stylize</Btn>
        </div>
      </div>
      {art && <div class="sec">
        <div class="lab">Crop</div>
        <Slider label="Zoom" min={1} max={3} step={0.01} value={panel.fit.zoom} fmt={(v) => v.toFixed(1) + 'x'} onInput={(v) => { panel.fit.zoom = v; touch(); }} onChange={commit} />
        <Slider label="Left / right" min={0} max={1} step={0.01} value={panel.fit.x} fmt={(v) => Math.round(v * 100)} onInput={(v) => { panel.fit.x = v; touch(); }} onChange={commit} />
        <Slider label="Up / down" min={0} max={1} step={0.01} value={panel.fit.y} fmt={(v) => Math.round(v * 100)} onInput={(v) => { panel.fit.y = v; touch(); }} onChange={commit} />
      </div>}
      <div class="sec">
        <div class="lab">Size on the page</div>
        <Seg class="block quiet" value={panel.size} options={Object.entries(SIZE_LABELS)} onChange={(v) => { setPanelSize(doc, panel, v); syncDoc(doc); found.page.rowW = null; found.page.colW = null; commit(); }} />
        <p class="hint" style="margin:8px 0 0">Drag the gaps between panels to resize rows and columns.</p>
      </div>
      <div class="sec">
        <div class="lab">Characters in this panel</div>
        <div class="chips">
          {doc.characters.map((c) => {
            const on = cast.includes(c);
            return <button class={`chip ${on ? 'on' : ''}`} onClick={() => { panel.cast = { ...panel.cast, [c.id]: !on }; commit(); }}><span class="dot" style={`background:${c.color}`} />{c.name}</button>;
          })}
          {!doc.characters.length && <span class="hint">Characters appear here once someone speaks in the script.</span>}
        </div>
      </div>
      <div class="sec">
        <div class="lab">Lettering</div>
        {panel.lines.length ? <div class="blist">
          {panel.lines.map((l, i) => (
            <div class={`bitem ${i === bi ? 'on' : ''}`} onClick={() => { ui.bubbleId = panel.bubbles[i].id; touch(); }}>
              <b>{TYPE_LABELS[l.type]}</b><span>{l.text}</span>
            </div>
          ))}
        </div> : <p class="hint" style="margin:0">Add a line such as <span class="kbd">MARA: Hello</span> under this panel in the script.</p>}
        {bi >= 0 && <div style="margin-top:10px">
          <Slider label="Size" min={0.6} max={2} step={0.02} value={panel.bubbles[bi].s || 1} fmt={(v) => Math.round(v * 100) + '%'} onInput={(v) => { panel.bubbles[bi].s = v; touch(); }} onChange={commit} />
          <Btn kind="sm" icon="refresh" onClick={() => { const b = panel.bubbles[bi]; panel.bubbles[bi] = { id: b.id, auto: true, autoTail: true }; commit(); }}>Reset position</Btn>
        </div>}
        {panel.lines.length > 0 && bi < 0 && <p class="hint" style="margin:8px 0 0">Drag a bubble on the page to move it. Select it to move its tail or change its width.</p>}
      </div>
    </div>
  );
}

export function Editor({ openPanel }) {
  const doc = S.doc, ui = S.ui;
  const page = doc.pages[ui.pageIdx] || doc.pages[0];
  const go = (i) => { ui.pageIdx = i; ui.panelId = doc.pages[i].panels[0]?.id || null; ui.bubbleId = null; touch(); };
  return (
    <div class="main">
      <ScriptPane />
      <div class="stage">
        <div class="thumbs">
          {doc.pages.map((pg, i) => (
            <div class={`thumb ${i === ui.pageIdx ? 'on' : ''}`} onClick={() => go(i)}><PageStatic page={pg} idp={'t' + i} /><span>{i + 1}</span></div>
          ))}
        </div>
        <div class="page-area">
          <div class="page-fit"><PageView page={page} onOpenPanel={(id) => openPanel(id, 'setup')} /></div>
          <div class="page-bar">
            <Btn kind="ghost sm" icon="chevLeft" disabled={ui.pageIdx === 0} onClick={() => go(ui.pageIdx - 1)} />
            Page {ui.pageIdx + 1} of {doc.pages.length}
            <Btn kind="ghost sm" icon="chevRight" disabled={ui.pageIdx >= doc.pages.length - 1} onClick={() => go(ui.pageIdx + 1)} />
          </div>
        </div>
      </div>
      <Inspector openPanel={openPanel} />
    </div>
  );
}

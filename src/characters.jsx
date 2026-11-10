// Character sheets. Each character has a color (used for their mannequin), a written
// description, and an optional reference image that is sent with every panel they are in.
import { S, touch, commit, asset, putAsset, toast } from './store.js';
import { generate, characterSheetPrompt, hasKey } from './ai.js';
import { Btn } from './ui.jsx';
import { Icon } from './icons.jsx';
import { uid, CHARACTER_COLORS, fileToDataUrl, pickFile, shrinkImage } from './util.js';

async function makeSheet(c) {
  const ui = S.ui;
  ui.busy[c.id] = true; touch();
  try {
    const [url] = await generate({ prompt: characterSheetPrompt(S.doc, c), aspect: 1.5, count: 1 });
    if (!url) throw new Error('OpenAI returned no image.');
    const target = S.doc.characters.find((x) => x.id === c.id);
    if (target) target.refAsset = putAsset(url);
    toast(`Reference sheet for ${c.name} is ready`);
  } catch (e) { toast(e.message, 'error'); }
  delete ui.busy[c.id];
  commit();
}

export function Characters() {
  const doc = S.doc, ui = S.ui;
  const add = () => { doc.characters.push({ id: uid('ch'), name: 'New character', color: CHARACTER_COLORS[doc.characters.length % CHARACTER_COLORS.length], description: '', refAsset: null }); commit(); };
  const remove = (c) => {
    doc.characters = doc.characters.filter((x) => x !== c);
    doc.pages.forEach((pg) => pg.panels.forEach((p) => { for (const k of ['d2', 'd3']) p.setup?.[k]?.objects.forEach((o) => { if (o.charId === c.id) o.charId = null; }); }));
    commit();
  };
  return (
    <div class="chars">
      <div class="row" style="max-width:1200px">
        <div style="flex:1"><h1>Characters</h1>
          <p class="hint" style="margin:0;max-width:680px">A character's description and reference image go to the image model with every panel they appear in. That is what keeps them looking like the same person from panel to panel. Anyone who speaks in the script is added here automatically.</p></div>
        <Btn kind="pri" icon="plus" style="flex:none" onClick={add}>Add character</Btn>
      </div>
      <div class="char-grid">
        {doc.characters.map((c) => {
          const ref = asset(c.refAsset);
          return (
            <div class="char-card">
              <div class="char-ref">
                {ref ? <img src={ref} /> : <><Icon name="image" size={26} style="opacity:.4" /><span class="hint" style="text-align:center">No reference image</span></>}
                <div class="over">
                  <Btn kind="sm" icon="upload" title="Upload a reference image" style="flex:1" onClick={async () => { const f = await pickFile('image/*'); if (!f) return; c.refAsset = putAsset(await shrinkImage(await fileToDataUrl(f), 1536)); commit(); }} />
                  {ref && <Btn kind="sm" icon="x" title="Remove the reference image" style="flex:1" onClick={() => { c.refAsset = null; commit(); }} />}
                </div>
              </div>
              <div class="char-body">
                <div class="row" style="margin-bottom:10px">
                  <input class="input" style="font-weight:650;font-size:14px" value={c.name} onInput={(e) => { c.name = e.target.value; touch(); }} onChange={commit} />
                  <Btn kind="ghost sm danger" icon="trash" title="Delete character" style="flex:none" onClick={() => remove(c)} />
                </div>
                <div class="swatches">
                  {CHARACTER_COLORS.map((col) => <button class={`swatch ${col === c.color ? 'on' : ''}`} style={`background:${col}`} onClick={() => { c.color = col; commit(); }} />)}
                </div>
                <textarea class="textarea" style="min-height:88px" placeholder="Age, build, face, hair, what they wear, anything distinctive." value={c.description} onInput={(e) => { c.description = e.target.value; touch(); }} onChange={commit} />
                <div style="height:8px" />
                <Btn kind="sm" icon="wand" busy={!!ui.busy[c.id]} disabled={!hasKey()} title={hasKey() ? '' : 'Add your OpenAI API key in Settings first'} onClick={() => makeSheet(c)}>
                  {ui.busy[c.id] ? 'Drawing…' : ref ? 'Redraw reference sheet' : 'Draw a reference sheet'}
                </Btn>
              </div>
            </div>
          );
        })}
      </div>
      {!doc.characters.length && <div class="empty">No characters yet. Add one, or write a line of dialogue in the script.</div>}
    </div>
  );
}

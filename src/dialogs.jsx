// Settings (OpenAI connection) and comic style dialogs.
import { useState } from 'preact/hooks';
import { S, touch, commit, asset } from './store.js';
import { getSettings, saveSettings, testKey, STYLES } from './ai.js';
import { Modal, Btn } from './ui.jsx';

const MODELS = ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2.6-sunburst', 'gpt-image-2.6-flare', 'gpt-image-2', 'gpt-image-1.5'];

export function SettingsModal({ onClose }) {
  const [cfg, setCfg] = useState(getSettings());
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState(null);
  const [models, setModels] = useState(MODELS);
  const [adv, setAdv] = useState(cfg.baseUrl !== 'https://api.openai.com/v1');
  const upd = (k, v) => { const n = { ...cfg, [k]: v }; setCfg(n); saveSettings(n); touch(); };
  const test = async () => {
    setStatus({ busy: true });
    try {
      const ids = await testKey(cfg);
      if (ids.length) setModels([...new Set([...ids, ...MODELS])]);
      setStatus({ ok: `Connected. ${ids.length ? ids.length + ' image models are available to this key.' : 'The key works.'}` });
    } catch (e) { setStatus({ err: e.message }); }
  };
  return (
    <Modal title="Settings" onClose={onClose} footer={<Btn kind="pri" onClick={onClose}>Done</Btn>}>
      <div class="lab">OpenAI image generation</div>
      <p class="hint" style="margin-top:0">Stylize uses OpenAI's Images API with your own API key. Create a key at platform.openai.com under API keys. The key is saved only in this browser and is sent only to OpenAI. It is never included in project files or exports.</p>
      <label class="field"><span>API key</span>
        <div class="row">
          <input class="input" type={show ? 'text' : 'password'} placeholder="sk-..." value={cfg.key} autocomplete="off" spellcheck={false} onInput={(e) => upd('key', e.target.value)} />
          <Btn style="flex:none" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</Btn>
          <Btn style="flex:none" busy={status?.busy} disabled={!cfg.key.trim()} onClick={test}>Test</Btn>
        </div>
      </label>
      {status?.ok && <div class="notice" style="margin-bottom:12px;border-color:rgba(95,191,138,.5);color:#a9e6c5;background:rgba(95,191,138,.08)">{status.ok}</div>}
      {status?.err && <div class="notice err" style="margin-bottom:12px">{status.err}</div>}
      <label class="field"><span>Image model</span>
        <input class="input" list="cc-models" value={cfg.model} spellcheck={false} onInput={(e) => upd('model', e.target.value.trim())} />
        <datalist id="cc-models">{models.map((m) => <option value={m} />)}</datalist>
      </label>
      {adv ? <label class="field"><span>API base URL</span><input class="input" value={cfg.baseUrl} spellcheck={false} onInput={(e) => upd('baseUrl', e.target.value.trim())} /></label>
        : <button class="chip" onClick={() => setAdv(true)}>Advanced</button>}
    </Modal>
  );
}

export function StyleModal({ onClose }) {
  const doc = S.doc;
  const ref = asset(doc.style.refAsset);
  return (
    <Modal title="Comic style" onClose={() => { commit(); onClose(); }} footer={<Btn kind="pri" onClick={() => { commit(); onClose(); }}>Done</Btn>}>
      <div class="lab">Art style</div>
      <div class="chips" style="margin-bottom:10px">
        {Object.entries(STYLES).map(([k, s]) => <button class={`chip ${doc.style.preset === k ? 'on' : ''}`} onClick={() => { doc.style.preset = k; commit(); }}>{s.name}</button>)}
      </div>
      {doc.style.preset !== 'custom' && <p class="hint" style="margin-top:0">{STYLES[doc.style.preset].text}.</p>}
      <label class="field"><span>{doc.style.preset === 'custom' ? 'Describe the style in your own words' : 'Add your own notes to this style (optional)'}</span>
        <textarea class="textarea" placeholder="For example: muted sea greens and warm lamp light, thick uneven outlines, grainy texture." value={doc.style.custom} onInput={(e) => { doc.style.custom = e.target.value; touch(); }} />
      </label>
      <div class="lab">Style reference</div>
      {ref ? <div class="row" style="align-items:flex-start;margin-bottom:14px">
        <img src={ref} style="width:120px;border-radius:8px;border:1px solid var(--line2)" />
        <div><p class="hint" style="margin:0 0 8px">This finished panel is sent with every request so new panels match its look.</p><Btn kind="sm" icon="x" onClick={() => { doc.style.refAsset = null; commit(); }}>Stop using it</Btn></div>
      </div> : <p class="hint" style="margin:0 0 14px">Once you have a stylized panel you love, open it and choose “Use as style reference for the comic”. Later panels will match it.</p>}
      <div class="lab">Lettering</div>
      <label class="row" style="cursor:pointer"><input type="checkbox" checked={doc.caps} onChange={(e) => { doc.caps = e.target.checked; commit(); }} /> Letter dialogue in capitals, the way most comics do</label>
    </Modal>
  );
}

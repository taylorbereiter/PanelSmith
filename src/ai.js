// Talks to the OpenAI Images API directly from the browser, using the user's own API key.
// The key is kept in this browser's localStorage and is sent only to the API host.
import { S, asset } from './store.js';
import { panelCast } from './script.js';
import { colorName, dataUrlToBlob, shrinkImage } from './util.js';

export const STYLES = {
  ink: { name: 'Flat ink and color', text: 'clean black ink line art with flat cel-shaded color, modern comic book style, confident outlines, a limited and cohesive palette' },
  manga: { name: 'Manga', text: 'black and white manga, crisp ink lines, screentone shading, strong contrast' },
  watercolor: { name: 'Watercolor', text: 'loose ink line art with soft watercolor washes, visible paper texture, gentle color bleeds' },
  noir: { name: 'Noir', text: 'high-contrast noir comic art, heavy black shadows, stark lighting, a single muted accent color' },
  vintage: { name: 'Vintage print', text: 'vintage four-color comic book printing, visible halftone dots, bold inks, slightly faded paper tones' },
  storybook: { name: 'Storybook', text: 'soft painterly picture book illustration, gouache texture, warm rounded shapes' },
  custom: { name: 'Custom', text: '' },
};
export const styleText = (doc) => (doc.style.preset === 'custom' ? doc.style.custom.trim() || STYLES.ink.text : STYLES[doc.style.preset]?.text || STYLES.ink.text)
  + (doc.style.preset !== 'custom' && doc.style.custom.trim() ? '. ' + doc.style.custom.trim() : '');

const DEFAULTS = { key: '', model: 'gpt-image-2.5-sunburst', quality: 'medium', count: 2, baseUrl: 'https://api.openai.com/v1' };
export function getSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('cc.ai') || '{}') }; } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s) { localStorage.setItem('cc.ai', JSON.stringify(s)); }
export const hasKey = () => !!getSettings().key.trim();

const region = (x, y) => {
  const v = y < 0.36 ? 'upper' : y > 0.64 ? 'lower' : 'middle', h = x < 0.36 ? 'left' : x > 0.64 ? 'right' : 'center';
  return v === 'middle' && h === 'center' ? 'center' : `${v} ${h}`;
};

/** Describe the set up in words, so the model knows which mannequin is which character. */
function describeSetup(doc, panel) {
  const out = [];
  const s = panel.setup;
  const name = (id) => doc.characters.find((c) => c.id === id);
  if (s.mode === '2d' && s.d2) {
    const d = s.d2, v = d.view;
    const norm = (x, y) => [0.5 + ((x - v.cx) * v.zoom) / 1000, 0.5 + ((y - v.cy) * v.zoom) / d.h];
    for (const o of d.objects) {
      if (o.type === 'figure') {
        const c = name(o.charId), [x, y] = norm(o.x, o.y - 80 * o.scale);
        out.push(c ? `The ${colorName(c.color)} mannequin at the ${region(x, y)} is ${c.name.toUpperCase()}.` : `The gray mannequin at the ${region(x, y)} is an unnamed background person.`);
      } else if (o.type === 'label') { const [x, y] = norm(o.x, o.y); out.push(`Note for the ${region(x, y)} of the frame: ${o.text}.`); }
    }
    if (d.light) { const [x, y] = norm(d.light.x, d.light.y); out.push(`The main light source is at the ${region(x, y)} of the frame (shown as a soft yellow glow).`); }
    if (d.bg.kind !== 'blank') out.push(`Time of day: ${d.bg.tone}.`);
  } else if (s.mode === '3d' && s.d3) {
    for (const o of s.d3.objects) if (o.type === 'figure') {
      const c = name(o.charId);
      out.push(c ? `The ${colorName(c.color)} mannequin is ${c.name.toUpperCase()}.` : 'A gray mannequin is an unnamed background person.');
    }
    out.push(`Time of day: ${s.d3.tone || 'day'}. Match the camera angle, lens and lighting direction of the layout.`);
  }
  return [...new Set(out)];
}

/**
 * Build the request for a panel: the prompt text plus the ordered list of reference images.
 * `useSetup` sends the set up picture as the composition guide; without it the panel is
 * generated from the script alone.
 */
export function buildRequest(doc, panel, { useSetup = true } = {}) {
  const cast = panelCast(doc, panel);
  const images = [];
  const L = [];
  const setup = useSetup ? asset(panel.setupAsset) : null;
  L.push('Draw one comic book panel as a single finished illustration.');
  L.push(`Scene: ${panel.description.trim() || 'See the layout.'}`);
  L.push(`Art style: ${styleText(doc)}.`);
  if (setup) {
    images.push({ label: 'Your set up', src: setup });
    const f = panel.fidelity ?? 0.7;
    L.push('Image 1 is a rough layout built from mannequins and simple shapes. It shows the composition only.');
    L.push(f > 0.66
      ? 'Follow the layout closely: keep every figure in the same position, size, pose and facing direction, keep each prop where it is, and keep the same camera angle and framing.'
      : f > 0.33
        ? 'Follow the layout for where figures and props are, their poses and the camera angle, but you may adjust details to make the drawing read well.'
        : 'Use the layout as a loose guide for staging. You may reinterpret poses and framing to make a stronger image.');
    L.push('Replace the mannequins with fully drawn characters and the simple shapes with a detailed, believable setting. Nothing from the layout should look like a mannequin or a placeholder in the result.');
    L.push(...describeSetup(doc, panel));
  }
  for (const c of cast) {
    let line = `${c.name.toUpperCase()}: ${(c.description.trim() || 'no description given').replace(/[.\s]+$/, '')}.`;
    const ref = asset(c.refAsset);
    if (ref) { images.push({ label: `${c.name} reference`, src: ref }); line += ` Image ${images.length} is the reference sheet for ${c.name.toUpperCase()}. Match the face, hair, build and clothing exactly.`; }
    L.push(line);
  }
  const styleRef = asset(doc.style.refAsset);
  if (styleRef && styleRef !== asset(panel.artAsset)) {
    images.push({ label: 'Style reference', src: styleRef });
    L.push(`Image ${images.length} is a finished panel from the same comic. Match its line quality, coloring and rendering. Do not copy its content.`);
  }
  const talk = panel.lines.filter((l) => l.type !== 'sfx' && l.type !== 'caption');
  if (talk.length) L.push('For mood and expression only, the dialogue in this panel is: ' + talk.map((l) => `${l.who} ${l.type === 'thought' ? 'thinks' : l.type === 'shout' ? 'shouts' : 'says'} "${l.text}"`).join('; ') + '.');
  if (panel.notes?.trim()) L.push(`Extra direction: ${panel.notes.trim()}`);
  L.push('Do not draw any text, letters, speech bubbles, captions, sound effects, signatures, panel borders or frames. Leave some calm space near the top for lettering to be added later. Fill the whole image edge to edge.');
  return { prompt: L.join('\n'), images };
}

const STANDARD = [[1024, 1024], [1536, 1024], [1024, 1536]];
export function sizeFor(aspect, flexible) {
  if (!flexible) return STANDARD.reduce((a, b) => (Math.abs(b[0] / b[1] - aspect) < Math.abs(a[0] / a[1] - aspect) ? b : a)).join('x');
  const a = Math.max(1 / 3, Math.min(3, aspect));
  const r16 = (v) => Math.max(512, Math.round(v / 16) * 16);
  return a >= 1 ? `${1536}x${r16(1536 / a)}` : `${r16(1536 * a)}x${1536}`;
}

function friendly(status, body) {
  const msg = body?.error?.message || '', code = body?.error?.code || '';
  if (status === 401) return 'OpenAI did not accept the API key. Check it in Settings.';
  if (code === 'credit_balance_exhausted' || code === 'insufficient_quota' || /quota|billing|credit/i.test(msg)) return 'Your OpenAI API credits have run out for now. They refill at the start of the next billing cycle, or you can add credits in the OpenAI dashboard. (' + msg + ')';
  if (status === 429) return 'OpenAI is rate limiting requests. Wait a moment and try again. ' + msg;
  if (/verif/i.test(msg)) return 'OpenAI needs your API organization to be verified before it will generate images. ' + msg;
  if (/safety|moderation|content policy/i.test(msg)) return 'OpenAI declined this request under its content policy. Try rewording the panel description. ' + msg;
  return msg || `The request failed (HTTP ${status}).`;
}

async function post(path, body, cfg) {
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(cfg.baseUrl.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cfg.key.trim(), ...(isForm ? {} : { 'Content-Type': 'application/json' }) },
      body: isForm ? body : JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('Could not reach OpenAI. Check your internet connection. (' + e.message + ')');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) { const err = new Error(friendly(res.status, json)); err.status = res.status; err.raw = json?.error?.message || ''; throw err; }
  return json;
}

/** Generate images. With reference images this uses the edits endpoint, otherwise generations. */
export async function generate({ prompt, images = [], aspect = 1, count, quality }) {
  const cfg = getSettings();
  if (!cfg.key.trim()) throw new Error('Add your OpenAI API key in Settings first.');
  const n = count || cfg.count, q = quality || cfg.quality;
  const attempt = async (flexible) => {
    const size = sizeFor(aspect, flexible);
    if (images.length) {
      const fd = new FormData();
      fd.append('model', cfg.model); fd.append('prompt', prompt); fd.append('size', size);
      fd.append('quality', q); fd.append('n', String(n)); fd.append('output_format', 'jpeg');
      for (let i = 0; i < images.length; i++) {
        const small = await shrinkImage(images[i].src, 1536);
        fd.append('image[]', await dataUrlToBlob(small), `image-${i + 1}.jpg`);
      }
      return post('/images/edits', fd, cfg);
    }
    return post('/images/generations', { model: cfg.model, prompt, size, quality: q, n, output_format: 'jpeg' }, cfg);
  };
  let json;
  try { json = await attempt(!/gpt-image-1/.test(cfg.model)); }
  catch (e) { if (e.status === 400 && /size/i.test(e.raw)) json = await attempt(false); else throw e; }
  const fmt = json.output_format || 'jpeg';
  return (json.data || []).filter((d) => d.b64_json).map((d) => `data:image/${fmt};base64,${d.b64_json}`);
}

export async function testKey(cfg) {
  let res;
  try { res = await fetch(cfg.baseUrl.replace(/\/$/, '') + '/models', { headers: { Authorization: 'Bearer ' + cfg.key.trim() } }); }
  catch (e) { throw new Error('Could not reach OpenAI. (' + e.message + ')'); }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(friendly(res.status, json));
  const ids = (json.data || []).map((m) => m.id).filter((id) => /image/.test(id)).sort();
  return ids;
}

export function characterSheetPrompt(doc, c) {
  return [
    `Character reference sheet for a comic book character named ${c.name}.`,
    `Appearance: ${(c.description.trim() || 'design an appealing, distinctive character').replace(/[.\s]+$/, '')}.`,
    'Show the same character three times, side by side, full body, in a neutral standing pose: front view, three-quarter view and side view. Keep the face, hair, proportions and clothing identical in all three.',
    `Art style: ${styleText(doc)}.`,
    'Plain white background. No text, labels or borders.',
  ].join('\n');
}

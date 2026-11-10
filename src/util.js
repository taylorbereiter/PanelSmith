// Small shared helpers.
export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 10);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const round = (v, p = 2) => { const m = 10 ** p; return Math.round(v * m) / m; };

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
/** Mix a hex color toward white (t > 0) or black (t < 0). */
export function shade(hex, t) {
  const c = hexToRgb(hex);
  const target = t >= 0 ? 255 : 0;
  return rgbToHex(c.map((v) => lerp(v, target, Math.abs(t))));
}

const NAMED = [
  ['red', '#d64545'], ['orange', '#e8833a'], ['yellow', '#e9c13d'], ['green', '#4c9a55'], ['teal', '#2f8f83'],
  ['blue', '#3f76c9'], ['purple', '#8257c4'], ['pink', '#d86a9c'], ['brown', '#8a5a3a'], ['gray', '#7d8590'],
  ['black', '#2a2a2e'], ['white', '#f2f0ea'],
];
/** Nearest plain-language color name, used to tell the image model which mannequin is which character. */
export function colorName(hex) {
  const c = hexToRgb(hex);
  let best = 'gray', bd = Infinity;
  for (const [name, h] of NAMED) {
    const n = hexToRgb(h);
    const d = (c[0] - n[0]) ** 2 + (c[1] - n[1]) ** 2 + (c[2] - n[2]) ** 2;
    if (d < bd) { bd = d; best = name; }
  }
  return best;
}
export const CHARACTER_COLORS = ['#2f8f83', '#d64545', '#3f76c9', '#e8833a', '#8257c4', '#4c9a55', '#d86a9c', '#8a5a3a', '#e9c13d', '#7d8590'];

export function download(filename, blobOrUrl) {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => rej(new Error('Could not load image'));
    im.src = src;
  });
}
export function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}
export async function dataUrlToBlob(dataUrl) { return (await fetch(dataUrl)).blob(); }
/** Re-encode an image so its longest side is at most `max` pixels. */
export async function shrinkImage(dataUrl, max = 1536, type = 'image/jpeg', q = 0.9) {
  const im = await loadImage(dataUrl);
  const s = Math.min(1, max / Math.max(im.width, im.height));
  const c = document.createElement('canvas');
  c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL(type, q);
}
export function pickFile(accept) {
  return new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.onchange = () => res(i.files[0] || null);
    i.click();
  });
}

// Props and backgrounds for the 2D stage. Everything is simple vector art: the point of a
// set up is to say what is where, and the image model adds the detail.
import { shade } from './util.js';

const K = '#23232a';
const st = { stroke: K, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };

// Each prop draws itself centered on the origin inside a w x h box.
export const PROPS = {
  lantern: { name: 'Lantern', w: 60, h: 96, color: '#f2c94c', draw: (c) => <g {...st}><path d="M-14 -22Q0 -52 14 -22" fill="none" /><rect x="-22" y="-22" width="44" height="12" fill={shade(c, -0.5)} /><rect x="-18" y="-10" width="36" height="44" fill={c} /><rect x="-24" y="34" width="48" height="10" fill={shade(c, -0.5)} /></g> },
  cup: { name: 'Cup', w: 70, h: 60, color: '#f2f0ea', draw: (c) => <g {...st}><path d="M-24 -18h40v30a12 12 0 0 1-12 12h-16a12 12 0 0 1-12-12z" fill={c} /><path d="M16 -10h8a8 8 0 0 1 0 18h-8" fill="none" /></g> },
  chair: { name: 'Chair', w: 120, h: 190, color: '#9b6a43', draw: (c) => <g {...st}><rect x="-50" y="-92" width="18" height="184" fill={shade(c, -0.2)} /><rect x="-50" y="-92" width="88" height="60" fill={c} /><rect x="-50" y="0" width="100" height="20" fill={c} /><rect x="32" y="20" width="18" height="72" fill={shade(c, -0.2)} /></g> },
  table: { name: 'Table', w: 240, h: 130, color: '#9b6a43', draw: (c) => <g {...st}><rect x="-104" y="-44" width="20" height="108" fill={shade(c, -0.2)} /><rect x="84" y="-44" width="20" height="108" fill={shade(c, -0.2)} /><rect x="-120" y="-64" width="240" height="22" fill={c} /></g> },
  door: { name: 'Door', w: 150, h: 320, color: '#8a5a3a', draw: (c) => <g {...st}><rect x="-75" y="-160" width="150" height="320" fill={shade(c, -0.3)} /><rect x="-62" y="-148" width="124" height="308" fill={c} /><circle cx="42" cy="10" r="8" fill="#f2c94c" /></g> },
  window: { name: 'Window', w: 180, h: 200, color: '#a9d3ea', draw: (c) => <g {...st}><rect x="-90" y="-100" width="180" height="200" fill="#f2f0ea" /><rect x="-76" y="-86" width="152" height="172" fill={c} /><path d="M0 -86V86M-76 0H76" /></g> },
  bed: { name: 'Bed', w: 320, h: 150, color: '#6f8fc9', draw: (c) => <g {...st}><rect x="-160" y="-70" width="22" height="140" fill="#8a5a3a" /><rect x="138" y="-20" width="22" height="90" fill="#8a5a3a" /><rect x="-138" y="-4" width="276" height="50" fill={c} /><rect x="-134" y="-30" width="78" height="30" rx="12" fill="#f2f0ea" /></g> },
  lamp: { name: 'Street lamp', w: 90, h: 400, color: '#f2c94c', draw: (c) => <g {...st}><rect x="-7" y="-150" width="14" height="350" fill="#4a4f5a" /><path d="M-34 -150h68l-14 -44h-40z" fill={c} /><rect x="-26" y="186" width="52" height="14" fill="#4a4f5a" /></g> },
  tree: { name: 'Tree', w: 240, h: 380, color: '#4c9a55', draw: (c) => <g {...st}><path d="M-18 190V40h36v150z" fill="#8a5a3a" /><circle cx="-50" cy="-30" r="70" fill={shade(c, -0.15)} /><circle cx="52" cy="-20" r="68" fill={shade(c, -0.15)} /><circle cx="0" cy="-100" r="84" fill={c} /></g> },
  pine: { name: 'Pine', w: 190, h: 380, color: '#3d7d53', draw: (c) => <g {...st}><rect x="-13" y="130" width="26" height="60" fill="#8a5a3a" /><path d="M0 -190l70 130h-34l58 100h-38l40 90H-96l40-90h-38l58-100h-34z" fill={c} /></g> },
  bush: { name: 'Bush', w: 200, h: 110, color: '#4c9a55', draw: (c) => <g {...st}><path d="M-96 54a40 40 0 0 1 20-70 50 50 0 0 1 86-20 44 44 0 0 1 66 30 34 34 0 0 1 16 60z" fill={c} /></g> },
  rock: { name: 'Rock', w: 180, h: 110, color: '#8d96a3', draw: (c) => <g {...st}><path d="M-90 54l22-70 50-38 60 14 46 54 2 40z" fill={c} /><path d="M-18 -54l12 46 54 12" fill="none" /></g> },
  boat: { name: 'Boat', w: 300, h: 220, color: '#c8553d', draw: (c) => <g {...st}><path d="M0 -108V30" /><path d="M8 -100l90 110H8z" fill="#f2f0ea" /><path d="M-150 34h300l-44 70h-212z" fill={c} /></g> },
  car: { name: 'Car', w: 360, h: 150, color: '#3f76c9', draw: (c) => <g {...st}><path d="M-180 40v-44l60-10 40-56h120l50 56 70 12v42z" fill={c} /><path d="M-70 -58h56v44h-88zM2 -58h62l36 44H2z" fill="#cfe6f2" /><circle cx="-104" cy="44" r="30" fill="#33363d" /><circle cx="104" cy="44" r="30" fill="#33363d" /></g> },
  house: { name: 'House', w: 340, h: 320, color: '#d9c7a3', draw: (c) => <g {...st}><rect x="-140" y="-30" width="280" height="190" fill={c} /><path d="M-170 -30L0 -160 170 -30z" fill="#b5533c" /><rect x="-30" y="60" width="60" height="100" fill="#8a5a3a" /><rect x="-110" y="10" width="56" height="50" fill="#cfe6f2" /><rect x="54" y="10" width="56" height="50" fill="#cfe6f2" /></g> },
  building: { name: 'Building', w: 220, h: 480, color: '#8d96a3', draw: (c) => <g {...st}><rect x="-110" y="-240" width="220" height="480" fill={c} />{[-180, -100, -20, 60, 140].map((y) => [-70, 10].map((x) => <rect x={x} y={y} width="60" height="46" fill="#f4e4a6" />))}</g> },
  mountain: { name: 'Mountain', w: 520, h: 300, color: '#7d8aa3', draw: (c) => <g {...st}><path d="M-260 150L-40 -150 60 -20 110 -70 260 150z" fill={c} /><path d="M-84 -90l44-60 40 52-34 14-22-12z" fill="#f2f0ea" /></g> },
  cloud: { name: 'Cloud', w: 260, h: 110, color: '#f2f0ea', draw: (c) => <g {...st}><path d="M-110 50a36 36 0 0 1 4-72 50 50 0 0 1 92-22 44 44 0 0 1 80 24 36 36 0 0 1 30 70z" fill={c} /></g> },
  sun: { name: 'Sun or moon', w: 130, h: 130, color: '#f6d365', draw: (c) => <g {...st}><circle r="60" fill={c} /></g> },
  box: { name: 'Crate', w: 150, h: 150, color: '#b98a54', draw: (c) => <g {...st}><rect x="-75" y="-75" width="150" height="150" fill={c} /><path d="M-75 -75L75 75M75 -75L-75 75" /></g> },
  barrel: { name: 'Barrel', w: 120, h: 170, color: '#9b6a43', draw: (c) => <g {...st}><path d="M-48 -85h96q24 85 0 170h-96q-24-85 0-170z" fill={c} /><path d="M-58 -34H58M-58 34H58" /></g> },
  book: { name: 'Book', w: 90, h: 70, color: '#b5533c', draw: (c) => <g {...st}><path d="M-45 -30l45 8 45-8v56l-45 8-45-8z" fill="#f2f0ea" /><path d="M0 -22v56" /><path d="M-45 -30v56M45 -30v56" stroke={c} stroke-width="7" /></g> },
  phone: { name: 'Phone', w: 50, h: 90, color: '#33363d', draw: (c) => <g {...st}><rect x="-22" y="-44" width="44" height="88" rx="8" fill={c} /><rect x="-15" y="-34" width="30" height="60" fill="#a9d3ea" stroke="none" /></g> },
  sword: { name: 'Sword', w: 50, h: 260, color: '#c9d1da', draw: (c) => <g {...st}><path d="M-10 60V-110l10-20 10 20V60z" fill={c} /><rect x="-30" y="60" width="60" height="12" fill="#f2c94c" /><rect x="-7" y="72" width="14" height="50" fill="#8a5a3a" /></g> },
  bag: { name: 'Bag', w: 110, h: 120, color: '#b98a54', draw: (c) => <g {...st}><path d="M-22 -24a22 26 0 0 1 44 0" fill="none" /><path d="M-48 -24h96l8 82h-112z" fill={c} /></g> },
  sign: { name: 'Sign', w: 170, h: 230, color: '#f2f0ea', draw: (c) => <g {...st}><rect x="-8" y="-20" width="16" height="135" fill="#8a5a3a" /><rect x="-84" y="-114" width="168" height="96" fill={c} /></g> },
  stairs: { name: 'Steps', w: 360, h: 240, color: '#b9b2a4', draw: (c) => <g {...st}><path d="M-180 120v-60h90v-60h90v-60h90v-60h90v240z" fill={c} /></g> },
  fire: { name: 'Fire', w: 120, h: 150, color: '#f08a3c', draw: (c) => <g {...st}><path d="M0 -74c10 34 50 44 50 92a50 50 0 0 1-100 0c0-26 16-36 22-56 8 14 14 16 18 18-4-22 2-38 10-54z" fill={c} /><path d="M0 0c6 14 22 20 22 38a22 22 0 0 1-44 0c0-18 16-22 22-38z" fill="#f6d365" stroke="none" /></g> },
};

const TONES = {
  day: { sky: '#bfe1f3', sky2: '#e9f5fb', ground: '#a8c686', floor: '#c9a877', wall: '#e9dcc3', far: '#8fb0c9', sea: '#4f8fbf', ink: '#6f6a5f', star: null },
  dusk: { sky: '#6b5b93', sky2: '#f2a65a', ground: '#6d7a5a', floor: '#8a6a4f', wall: '#b79a86', far: '#4a4470', sea: '#2f4f7a', ink: '#3b3550', star: null },
  night: { sky: '#1d2340', sky2: '#2e3660', ground: '#2e3b3a', floor: '#3d3550', wall: '#3a3550', far: '#151a30', sea: '#16264a', ink: '#12162a', star: '#f4f1d0' },
};
export const TONE_NAMES = { day: 'Day', dusk: 'Dusk', night: 'Night' };
export const BACKGROUNDS = { blank: 'Blank', room: 'Room', hall: 'Hallway', stairs: 'Stairs', field: 'Field', sea: 'Sea', city: 'City', forest: 'Forest', street: 'Street', sky: 'Sky' };

/** Draws a background that covers well beyond the stage so zooming out never shows an edge. */
export function Background({ kind, tone = 'day', W, H, gid = 'bg' }) {
  const t = TONES[tone] || TONES.day;
  const X = -W * 2, FW = W * 5, Y = -H * 2, FH = H * 5;
  const hz = H * 0.62;
  const sky = <><defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={t.sky} /><stop offset="1" stop-color={t.sky2} /></linearGradient></defs>
    <rect x={X} y={Y} width={FW} height={-Y} fill={t.sky} /><rect x={X} y={0} width={FW} height={hz} fill={`url(#${gid})`} />
    {t.star && [...Array(26)].map((_, i) => <circle cx={((i * 197) % 1000) / 1000 * W} cy={((i * 331) % 1000) / 1000 * hz * 0.8} r={2 + (i % 3)} fill={t.star} />)}</>;
  const s = { stroke: t.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' };
  if (kind === 'blank') return <rect x={X} y={Y} width={FW} height={FH} fill="#f3efe6" />;
  if (kind === 'sky') return <>{sky}<rect x={X} y={hz} width={FW} height={FH} fill={t.sky2} /></>;
  if (kind === 'room') return <><rect x={X} y={Y} width={FW} height={FH} fill={t.wall} /><rect x={X} y={H * 0.72} width={FW} height={FH} fill={t.floor} {...s} /><rect x={X} y={H * 0.72 - 26} width={FW} height={26} fill={shade(t.wall, -0.18)} {...s} /></>;
  if (kind === 'hall') return <><rect x={X} y={Y} width={FW} height={FH} fill={t.wall} /><path d={`M${X} ${H * 1.4}L${W * 0.34} ${H * 0.62}H${W * 0.66}L${X + FW} ${H * 1.4}V${Y + FH}H${X}Z`} fill={t.floor} {...s} /><rect x={W * 0.34} y={H * 0.14} width={W * 0.32} height={H * 0.48} fill={shade(t.wall, -0.22)} {...s} /><path d={`M${X} ${-H * 0.6}L${W * 0.34} ${H * 0.14}M${X + FW} ${-H * 0.6}L${W * 0.66} ${H * 0.14}`} {...s} fill="none" /></>;
  if (kind === 'stairs') {
    const n = 7, sw = W / 5, sh = H / 6.5;
    let d = `M${X} ${Y + FH}V${H * 0.96}H${-sw}`;
    for (let i = 0; i < n; i++) d += `H${-sw + sw * (i + 1)}V${H * 0.96 - sh * (i + 1)}`;
    return <><rect x={X} y={Y} width={FW} height={FH} fill={t.wall} /><path d={d + `H${X + FW}V${Y + FH}Z`} fill={shade(t.floor, 0.12)} {...s} /><path d={`M${-sw} ${H * 0.62}L${-sw + sw * n} ${H * 0.62 - sh * n}`} stroke={t.ink} stroke-width="9" stroke-linecap="round" /></>;
  }
  if (kind === 'field') return <>{sky}<path d={`M${X} ${hz}Q${W * 0.3} ${hz - 60} ${W * 0.6} ${hz - 10}T${X + FW} ${hz}V${Y + FH}H${X}Z`} fill={t.ground} {...s} /></>;
  if (kind === 'sea') return <>{sky}<rect x={X} y={hz} width={FW} height={FH} fill={t.sea} {...s} />{[0.1, 0.24, 0.42].map((k, i) => <path d={`M${W * (0.1 + i * 0.25)} ${hz + H * k}q30 -16 60 0t60 0t60 0`} fill="none" stroke={shade(t.sea, 0.35)} stroke-width="5" stroke-linecap="round" />)}</>;
  if (kind === 'city') return <>{sky}{[[0, 0.3, 0.14], [0.13, 0.42, 0.1], [0.24, 0.22, 0.16], [0.41, 0.36, 0.12], [0.54, 0.16, 0.15], [0.7, 0.4, 0.12], [0.83, 0.28, 0.2]].map(([x, top, w], i) => <g><rect x={W * x} y={H * top} width={W * w} height={hz - H * top + 4} fill={i % 2 ? t.far : shade(t.far, -0.15)} {...s} />{[...Array(4)].map((_, r) => <rect x={W * x + 14} y={H * top + 18 + r * 46} width={W * w - 28} height={16} fill={tone === 'day' ? shade(t.far, 0.4) : '#f4e4a6'} opacity={(i + r) % 3 ? 0.9 : 0.35} />)}</g>)}<rect x={X} y={hz} width={FW} height={FH} fill={shade(t.floor, -0.25)} {...s} /></>;
  if (kind === 'forest') return <>{sky}{[0.04, 0.2, 0.36, 0.55, 0.72, 0.9].map((x, i) => <g><rect x={W * x - 14} y={hz - H * 0.2} width={28} height={H * 0.24} fill={shade(t.floor, -0.3)} {...s} /><path d={`M${W * x} ${hz - H * (0.62 + (i % 2) * 0.08)}l${W * 0.09} ${H * 0.44}h${-W * 0.18}z`} fill={shade(t.ground, i % 2 ? -0.25 : -0.4)} {...s} /></g>)}<rect x={X} y={hz} width={FW} height={FH} fill={t.ground} {...s} /></>;
  if (kind === 'street') return <>{sky}<rect x={X} y={H * 0.2} width={FW} height={hz - H * 0.2} fill={t.far} {...s} /><rect x={X} y={hz} width={FW} height={H * 0.1} fill={shade(t.floor, 0.2)} {...s} /><rect x={X} y={hz + H * 0.1} width={FW} height={FH} fill={shade(t.ink, 0.25)} {...s} />{[...Array(9)].map((_, i) => <rect x={-W + i * W * 0.36} y={hz + H * 0.24} width={W * 0.18} height={10} fill="#f2f0ea" />)}</>;
  return null;
}

// The 2D set up stage: place and pose figures, add props, block in shapes, sketch with a pencil.
import { render } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { S, touch, commit } from './store.js';
import { Figure, joints, figureBounds, HANDLES, dragHandle, newFigure, POSES } from './figure2d.jsx';
import { PROPS, Background } from './library2d.jsx';
import { drag, svgPoint } from './ui.jsx';
import { uid, clamp, clone, loadImage } from './util.js';

export const W = 1000;
export const PEN_COLORS = ['#23232a', '#d64545', '#3f76c9', '#4c9a55', '#e9c13d', '#f2f0ea'];

export function newD2(h) {
  return { h, bg: { kind: 'blank', tone: 'day' }, view: { cx: W / 2, cy: h / 2, zoom: 1 }, light: null, objects: [] };
}
export const viewTransform = (d2) => `translate(${W / 2} ${d2.h / 2}) scale(${d2.view.zoom}) translate(${-d2.view.cx} ${-d2.view.cy})`;

function strokePath(pts) {
  if (pts.length < 2) return `M${pts[0][0]} ${pts[0][1]}l0.1 0`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q${pts[i][0]} ${pts[i][1]} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const l = pts[pts.length - 1];
  return d + `L${l[0]} ${l[1]}`;
}

function Obj({ o, doc }) {
  if (o.type === 'figure') return <Figure f={o} color={doc.characters.find((c) => c.id === o.charId)?.color} />;
  if (o.type === 'prop') {
    const def = PROPS[o.kind]; if (!def) return null;
    return <g transform={`translate(${o.x} ${o.y}) rotate(${o.rot || 0}) scale(${o.scale * (o.flip ? -1 : 1)} ${o.scale})`}>{def.draw(o.color || def.color)}</g>;
  }
  if (o.type === 'shape') {
    const st = { fill: o.color, stroke: '#23232a', 'stroke-width': 4 };
    if (o.kind === 'line') return <line x1={o.x} y1={o.y} x2={o.x2} y2={o.y2} stroke={o.color} stroke-width={o.width || 10} stroke-linecap="round" />;
    return <g transform={`translate(${o.x} ${o.y}) rotate(${o.rot || 0})`}>{o.kind === 'rect' ? <rect x={-o.w / 2} y={-o.h / 2} width={o.w} height={o.h} {...st} /> : <ellipse rx={o.w / 2} ry={o.h / 2} {...st} />}</g>;
  }
  if (o.type === 'stroke') return <path d={strokePath(o.pts)} transform={`translate(${o.dx || 0} ${o.dy || 0})`} fill="none" stroke={o.color} stroke-width={o.width} stroke-linecap="round" stroke-linejoin="round" />;
  return null;
}

/** Everything that belongs in the set up picture. `clean` leaves out notes and other editor-only marks. */
export function Stage2DContent({ d2, doc, clean, gid = 'bg' }) {
  return (
    <g>
      <Background kind={d2.bg.kind} tone={d2.bg.tone} W={W} H={d2.h} gid={gid} />
      {d2.light && <><defs><radialGradient id={gid + 'glow'}><stop offset="0" stop-color="#ffe9a3" stop-opacity=".75" /><stop offset="1" stop-color="#ffe9a3" stop-opacity="0" /></radialGradient></defs>
        <circle cx={d2.light.x} cy={d2.light.y} r={d2.light.r || 240} fill={`url(#${gid}glow)`} pointer-events="none" /></>}
      {d2.objects.map((o) => (o.type === 'label'
        ? !clean && <g><rect x={o.x - 8} y={o.y - 24} width={o.text.length * 12.5 + 18} height={34} rx={6} fill="#fff8d6" stroke="#23232a" stroke-width="2.5" /><text x={o.x} y={o.y} font-size="22" font-family="system-ui,sans-serif" fill="#23232a">{o.text}</text></g>
        : <Obj o={o} doc={doc} />))}
    </g>
  );
}

function bounds(o) {
  if (o.type === 'figure') return figureBounds(o);
  if (o.type === 'prop') { const d = PROPS[o.kind]; const w = d.w * o.scale / 2 + 8, h = d.h * o.scale / 2 + 8; return { x: o.x - w, y: o.y - h, x2: o.x + w, y2: o.y + h, rot: o.rot || 0, cx: o.x, cy: o.y }; }
  if (o.type === 'shape' && o.kind === 'line') return { x: Math.min(o.x, o.x2) - 10, y: Math.min(o.y, o.y2) - 10, x2: Math.max(o.x, o.x2) + 10, y2: Math.max(o.y, o.y2) + 10 };
  if (o.type === 'shape') return { x: o.x - o.w / 2 - 6, y: o.y - o.h / 2 - 6, x2: o.x + o.w / 2 + 6, y2: o.y + o.h / 2 + 6, rot: o.rot || 0, cx: o.x, cy: o.y };
  if (o.type === 'stroke') { const xs = o.pts.map((p) => p[0]), ys = o.pts.map((p) => p[1]); const dx = o.dx || 0, dy = o.dy || 0; return { x: Math.min(...xs) + dx - 10, y: Math.min(...ys) + dy - 10, x2: Math.max(...xs) + dx + 10, y2: Math.max(...ys) + dy + 10 }; }
  if (o.type === 'label') return { x: o.x - 10, y: o.y - 26, x2: o.x + o.text.length * 12.5 + 12, y2: o.y + 12 };
  return { x: 0, y: 0, x2: 0, y2: 0 };
}
function moveBy(o, dx, dy) {
  if (o.type === 'stroke') { o.dx = (o.dx || 0) + dx; o.dy = (o.dy || 0) + dy; return; }
  o.x += dx; o.y += dy;
  if (o.type === 'shape' && o.kind === 'line') { o.x2 += dx; o.y2 += dy; }
}

export function Stage2D({ d2, ws }) {
  const doc = S.doc;
  const world = useRef(), svg = useRef();
  const sel = d2.objects.find((o) => o.id === ws.sel) || (ws.sel === 'light' && d2.light ? { type: 'light' } : null);
  const pt = (e) => svgPoint(world.current, e);
  const hs = 9 / d2.view.zoom; // handle size stays constant on screen

  const startMove = (e, o) => {
    if (ws.tool !== 'select') return;
    e.stopPropagation();
    ws.sel = o.id; touch();
    let [lx, ly] = pt(e), moved = false;
    drag(e, (ev) => { const [x, y] = pt(ev); moveBy(o, x - lx, y - ly); lx = x; ly = y; moved = true; touch(); }, () => moved && commit());
  };
  const startHandle = (e, f, h) => { e.stopPropagation(); drag(e, (ev) => { dragHandle(f, h, pt(ev)); touch(); }, commit); };
  const startScale = (e, o, b) => {
    e.stopPropagation();
    const cx = o.type === 'figure' ? o.x : (b.x + b.x2) / 2, cy = o.type === 'figure' ? o.y : (b.y + b.y2) / 2;
    const [sx, sy] = pt(e), d0 = Math.hypot(sx - cx, sy - cy) || 1, s0 = o.scale, w0 = o.w, h0 = o.h;
    drag(e, (ev) => {
      const [x, y] = pt(ev);
      if (o.type === 'shape') { const r = -(o.rot || 0) * Math.PI / 180, dx = x - o.x, dy = y - o.y; o.w = Math.max(12, Math.abs(dx * Math.cos(r) - dy * Math.sin(r)) * 2); o.h = Math.max(12, Math.abs(dx * Math.sin(r) + dy * Math.cos(r)) * 2); }
      else o.scale = clamp((s0 * Math.hypot(x - cx, y - cy)) / d0, 0.15, 6);
      touch();
    }, commit);
  };
  const startRotate = (e, o) => { e.stopPropagation(); drag(e, (ev) => { const [x, y] = pt(ev); let a = Math.atan2(x - o.x, -(y - o.y)) * 180 / Math.PI; if (ev.shiftKey) a = Math.round(a / 15) * 15; o.rot = a; touch(); }, commit); };
  const startLineEnd = (e, o, end) => { e.stopPropagation(); drag(e, (ev) => { const [x, y] = pt(ev); if (end) { o.x2 = x; o.y2 = y; } else { o.x = x; o.y = y; } touch(); }, commit); };

  const bgDown = (e) => {
    const [x, y] = pt(e);
    if (ws.tool === 'select') {
      ws.sel = null; touch();
      const v0 = { ...d2.view }, sx = e.clientX, sy = e.clientY;
      const k = svg.current.getBoundingClientRect().width / W;
      let moved = false;
      drag(e, (ev) => { d2.view.cx = v0.cx - (ev.clientX - sx) / k / v0.zoom; d2.view.cy = v0.cy - (ev.clientY - sy) / k / v0.zoom; moved = true; touch(); }, () => moved && commit());
    } else if (ws.tool === 'pencil') {
      const o = { id: uid('st'), type: 'stroke', pts: [[Math.round(x), Math.round(y)]], color: ws.penColor, width: ws.penWidth };
      d2.objects.push(o);
      drag(e, (ev) => { const [px, py] = pt(ev); const l = o.pts[o.pts.length - 1]; if (Math.hypot(px - l[0], py - l[1]) > 3 / d2.view.zoom) { o.pts.push([Math.round(px), Math.round(py)]); touch(); } }, commit);
      touch();
    } else if (ws.tool === 'rect' || ws.tool === 'ellipse' || ws.tool === 'line') {
      const o = ws.tool === 'line'
        ? { id: uid('sh'), type: 'shape', kind: 'line', x, y, x2: x, y2: y, color: ws.penColor, width: 12 }
        : { id: uid('sh'), type: 'shape', kind: ws.tool, x, y, w: 2, h: 2, rot: 0, color: ws.shapeColor };
      d2.objects.push(o); ws.sel = o.id;
      drag(e, (ev) => {
        const [px, py] = pt(ev);
        if (o.kind === 'line') { o.x2 = px; o.y2 = py; } else { o.x = (x + px) / 2; o.y = (y + py) / 2; o.w = Math.abs(px - x); o.h = Math.abs(py - y); }
        touch();
      }, () => {
        if (o.kind !== 'line' && (o.w < 8 || o.h < 8)) { o.w = 160; o.h = 160; }
        if (o.kind === 'line' && Math.hypot(o.x2 - o.x, o.y2 - o.y) < 8) o.x2 = o.x + 160;
        ws.tool = 'select'; commit();
      });
    } else if (ws.tool === 'label') {
      const o = { id: uid('lb'), type: 'label', x, y, text: 'Note' };
      d2.objects.push(o); ws.sel = o.id; ws.tool = 'select'; commit();
    } else if (ws.tool === 'light') {
      d2.light = { x, y, r: 240 }; ws.sel = 'light'; ws.tool = 'select'; commit();
    }
  };

  useEffect(() => {
    const el = svg.current;
    const wheel = (e) => {
      e.preventDefault();
      const v = d2.view;
      if (e.ctrlKey || e.metaKey) {
        const [x, y] = svgPoint(world.current, e);
        const z = clamp(v.zoom * Math.exp(-e.deltaY * 0.01), 0.3, 6);
        v.cx = x - ((x - v.cx) * v.zoom) / z; v.cy = y - ((y - v.cy) * v.zoom) / z; v.zoom = z;
      } else {
        const k = el.getBoundingClientRect().width / W;
        v.cx += e.deltaX / k / v.zoom; v.cy += e.deltaY / k / v.zoom;
      }
      touch();
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [d2]);

  const b = sel && sel.type !== 'light' ? bounds(sel) : null;
  const canScale = sel && (sel.type === 'figure' || sel.type === 'prop' || (sel.type === 'shape' && sel.kind !== 'line'));
  const canRotate = sel && (sel.type === 'prop' || (sel.type === 'shape' && sel.kind !== 'line'));
  const cursor = { select: 'default', pencil: 'crosshair', rect: 'crosshair', ellipse: 'crosshair', line: 'crosshair', label: 'text', light: 'crosshair' }[ws.tool];
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${d2.h}`} style={`cursor:${cursor}`} onPointerDown={bgDown}>
      <g ref={world} transform={viewTransform(d2)}>
        <g pointer-events="none"><Background kind={d2.bg.kind} tone={d2.bg.tone} W={W} H={d2.h} gid="live" /></g>
        {d2.light && <><defs><radialGradient id="liveglow"><stop offset="0" stop-color="#ffe9a3" stop-opacity=".75" /><stop offset="1" stop-color="#ffe9a3" stop-opacity="0" /></radialGradient></defs>
          <circle cx={d2.light.x} cy={d2.light.y} r={d2.light.r || 240} fill="url(#liveglow)" pointer-events="none" /></>}
        {d2.objects.map((o) => (
          <g onPointerDown={(e) => startMove(e, o)} style={ws.tool === 'select' ? 'cursor:move' : 'pointer-events:none'}>
            {o.type === 'label'
              ? <g><rect x={o.x - 8} y={o.y - 24} width={o.text.length * 12.5 + 18} height={34} rx={6} fill="#fff8d6" stroke="#23232a" stroke-width="2.5" /><text x={o.x} y={o.y} font-size="22" font-family="system-ui,sans-serif" fill="#23232a">{o.text}</text></g>
              : <Obj o={o} doc={doc} />}
            {o.type === 'stroke' && <path d={strokePath(o.pts)} transform={`translate(${o.dx || 0} ${o.dy || 0})`} fill="none" stroke="transparent" stroke-width={Math.max(o.width, 26)} />}
          </g>
        ))}
        {d2.light && <g transform={`translate(${d2.light.x} ${d2.light.y})`} style="cursor:move" onPointerDown={(e) => {
          if (ws.tool !== 'select') return; e.stopPropagation(); ws.sel = 'light'; touch();
          drag(e, (ev) => { const [x, y] = pt(ev); d2.light.x = x; d2.light.y = y; touch(); }, commit);
        }}>
          <circle r={20 / d2.view.zoom} fill="#ffd66b" stroke={ws.sel === 'light' ? '#f0b541' : '#23232a'} stroke-width={3 / d2.view.zoom} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line x1="0" y1={-27 / d2.view.zoom} x2="0" y2={-36 / d2.view.zoom} stroke="#23232a" stroke-width={3 / d2.view.zoom} stroke-linecap="round" transform={`rotate(${a})`} />)}
        </g>}
        {b && (
          <g transform={b.rot ? `rotate(${b.rot} ${b.cx} ${b.cy})` : null}>
            <rect x={b.x} y={b.y} width={b.x2 - b.x} height={b.y2 - b.y} fill="none" stroke="#f0b541" stroke-width={2.5 / d2.view.zoom} stroke-dasharray={`${8 / d2.view.zoom} ${6 / d2.view.zoom}`} pointer-events="none" />
            {canScale && <rect x={b.x2 - hs} y={b.y2 - hs} width={hs * 2} height={hs * 2} fill="#f0b541" stroke="#16161a" stroke-width={2.5 / d2.view.zoom} style="cursor:nwse-resize" onPointerDown={(e) => startScale(e, sel, b)} />}
            {canRotate && <><line x1={(b.x + b.x2) / 2} y1={b.y} x2={(b.x + b.x2) / 2} y2={b.y - 34 / d2.view.zoom} stroke="#f0b541" stroke-width={2.5 / d2.view.zoom} />
              <circle cx={(b.x + b.x2) / 2} cy={b.y - 34 / d2.view.zoom} r={hs} fill="#fff" stroke="#f0b541" stroke-width={3.5 / d2.view.zoom} style="cursor:grab" onPointerDown={(e) => startRotate(e, sel)} /></>}
          </g>
        )}
        {sel && sel.type === 'shape' && sel.kind === 'line' && [0, 1].map((end) => <circle cx={end ? sel.x2 : sel.x} cy={end ? sel.y2 : sel.y} r={hs} fill="#fff" stroke="#f0b541" stroke-width={3.5 / d2.view.zoom} style="cursor:move" onPointerDown={(e) => startLineEnd(e, sel, end)} />)}
        {sel && sel.type === 'figure' && ws.tool === 'select' && (() => {
          const j = joints(sel);
          return HANDLES.map((h) => <circle cx={j[h][0]} cy={j[h][1]} r={hs} fill="#f0b541" stroke="#16161a" stroke-width={2.5 / d2.view.zoom} style="cursor:grab" onPointerDown={(e) => startHandle(e, sel, h)} />);
        })()}
      </g>
    </svg>
  );
}

/** Render the set up to a JPEG data URL, without any editor marks. */
export async function snapshot2D(d2, doc, long = 1280) {
  const host = document.createElement('div');
  const w = d2.h >= W ? Math.round((long * W) / d2.h) : long, h = d2.h >= W ? long : Math.round((long * d2.h) / W);
  render(
    <svg xmlns="http://www.w3.org/2000/svg" width={w} height={h} viewBox={`0 0 ${W} ${d2.h}`}>
      <g transform={viewTransform(d2)}><Stage2DContent d2={d2} doc={doc} clean gid={'snap' + uid('')} /></g>
    </svg>, host);
  const xml = new XMLSerializer().serializeToString(host.firstChild);
  render(null, host);
  const im = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.9);
}

// ---- operations used by the side panels ----
export function addFigure(d2, ws, charId, pose = 'stand') {
  const n = d2.objects.filter((o) => o.type === 'figure').length;
  const f = newFigure(d2.view.cx + [0, 190, -190, 340, -340][n % 5], d2.view.cy + 80, charId, pose);
  d2.objects.push(f); ws.sel = f.id; ws.tool = 'select'; commit();
}
export function addProp(d2, ws, kind) {
  const def = PROPS[kind];
  const n = d2.objects.length;
  const o = { id: uid('pr'), type: 'prop', kind, x: d2.view.cx + (((n * 2) % 5) - 2) * 110, y: d2.view.cy + ((n % 3) - 1) * 70, scale: 1, rot: 0, flip: false, color: def.color };
  d2.objects.push(o); ws.sel = o.id; ws.tool = 'select'; commit();
}
export function applyPose(f, id) {
  const p = POSES[id]; f.pose = clone(p.pose);
  if (p.facing) f.facing = f.facing === 'left' ? 'left' : p.facing; else if (f.facing !== 'back') f.facing = 'front';
  commit();
}
/** Mirror a figure left to right, pose included. */
export function flipFigure(f) {
  const m = (a) => -a, P = f.pose;
  f.pose = { torso: m(P.torso), head: m(P.head), armL: P.armR.map(m), armR: P.armL.map(m), legL: P.legR.map(m), legR: P.legL.map(m) };
  if (f.facing === 'left') f.facing = 'right'; else if (f.facing === 'right') f.facing = 'left';
  commit();
}
export function reorder(d2, id, dir) {
  const i = d2.objects.findIndex((o) => o.id === id); if (i < 0) return;
  const j = clamp(i + dir, 0, d2.objects.length - 1);
  const [o] = d2.objects.splice(i, 1); d2.objects.splice(j, 0, o); commit();
}
export function removeSel(d2, ws) {
  if (ws.sel === 'light') d2.light = null; else d2.objects = d2.objects.filter((o) => o.id !== ws.sel);
  ws.sel = null; commit();
}
export function duplicateSel(d2, ws) {
  const o = d2.objects.find((o) => o.id === ws.sel); if (!o) return;
  const c = clone(o); c.id = uid('cp'); moveBy(c, 40, 40);
  d2.objects.push(c); ws.sel = c.id; commit();
}
export function setCamera(d2, ws, shot) {
  const f = d2.objects.find((o) => o.id === ws.sel && o.type === 'figure') || d2.objects.find((o) => o.type === 'figure');
  const v = d2.view;
  if (shot === 'wide' || !f) { v.zoom = shot === 'wide' ? 1 : shot === 'medium' ? 1.5 : 2.4; if (shot === 'wide') { v.cx = W / 2; v.cy = d2.h / 2; } }
  else {
    const fb = figureBounds(f), j = joints(f);
    if (shot === 'full') { v.zoom = clamp((d2.h * 0.82) / (fb.y2 - fb.y), 0.4, 4); v.cx = (fb.x + fb.x2) / 2; v.cy = (fb.y + fb.y2) / 2; }
    if (shot === 'medium') { v.zoom = clamp((d2.h * 0.82) / ((fb.y2 - fb.y) * 0.55), 0.6, 5); v.cx = f.x; v.cy = (j.head[1] + f.y) / 2 - 10 * f.scale; }
    if (shot === 'close') { v.zoom = clamp((d2.h * 0.8) / (150 * f.scale), 1, 6); v.cx = j.head[0]; v.cy = j.head[1] + 20 * f.scale; }
  }
  commit();
}

// Draws a page as SVG from render primitives, plus the interactive layer on top:
// selecting panels, dragging bubbles and their tails, and resizing rows and columns.
import { S, touch, commit, asset } from './store.js';
import { pagePrims, imageSize, coverRect } from './render.js';
import { PAGE } from './layout.js';
import { drag, svgPoint } from './ui.jsx';
import { clamp } from './util.js';
import { useRef } from 'preact/hooks';

export function Prim({ p, k }) {
  if (p.t === 'rect') return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} stroke={p.stroke} stroke-width={p.sw} />;
  if (p.t === 'path') return <path d={p.d} fill={p.fill} stroke={p.stroke} stroke-width={p.sw} stroke-linejoin={p.join || 'round'} stroke-dasharray={p.dash ? p.dash.join(' ') : null} />;
  if (p.t === 'text') return (
    <text x={p.x} y={p.y} text-anchor={p.anchor} font-family={p.family} font-size={p.size} font-weight={p.weight} fill={p.fill}
      stroke={p.stroke} stroke-width={p.sw} paint-order="stroke" stroke-linejoin="round"
      transform={p.rot ? `rotate(${p.rot} ${p.cx} ${p.cy})` : null}>{p.text}</text>
  );
  if (p.t === 'group') return <g>{p.prims.map((q, i) => <Prim p={q} k={k + '-' + i} />)}</g>;
  if (p.t === 'image') {
    const src = asset(p.asset);
    if (!src) return null;
    const size = imageSize(p.asset, touch);
    const r = size ? coverRect(p.clip, size.w, size.h, p.fit || {}) : p.clip;
    const id = 'clip-' + k;
    return (
      <g>
        <clipPath id={id}><rect x={p.clip.x} y={p.clip.y} width={p.clip.w} height={p.clip.h} /></clipPath>
        <image href={src} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio={size ? 'none' : 'xMidYMid slice'} clip-path={`url(#${id})`} />
      </g>
    );
  }
  return null;
}

/** A static, non-interactive rendering of a page. Used for thumbnails and the reader preview. */
export function PageStatic({ page, idp = 's' }) {
  const { prims, panels } = pagePrims(S.doc, page);
  return (
    <svg viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}>
      {prims.map((p, i) => <Prim p={p} k={idp + i} />)}
      {panels.map((pp) => pp.prims.map((p, i) => <Prim p={p} k={idp + pp.panel.id + i} />))}
    </svg>
  );
}

export function PageView({ page, onOpenPanel }) {
  const doc = S.doc, ui = S.ui;
  const { prims, panels, layout } = pagePrims(doc, page);
  const ref = useRef();

  const selectPanel = (id) => { ui.panelId = id; ui.bubbleId = null; touch(); };

  const moveBubble = (e, pp, i) => {
    e.stopPropagation();
    const b = pp.panel.bubbles[i], g = pp.geoms[i], r = pp.rect;
    ui.panelId = pp.panel.id; ui.bubbleId = b.id; touch();
    const [sx, sy] = svgPoint(ref.current, e);
    const ox = g.cx - sx, oy = g.cy - sy;
    let moved = false;
    drag(e, (ev) => {
      const [x, y] = svgPoint(ref.current, ev);
      if (!moved && Math.hypot(x - sx, y - sy) < 3) return;
      moved = true;
      b.x = clamp((x + ox - r.x) / r.w, -0.1, 1.1); b.y = clamp((y + oy - r.y) / r.h, -0.1, 1.1); b.auto = false;
      touch();
    }, () => moved && commit());
  };
  const moveTail = (e, pp, i) => {
    e.stopPropagation();
    const b = pp.panel.bubbles[i], r = pp.rect;
    drag(e, (ev) => {
      const [x, y] = svgPoint(ref.current, ev);
      b.tx = (x - r.x) / r.w; b.ty = (y - r.y) / r.h; b.autoTail = false; touch();
    }, commit);
  };
  const resizeBubble = (e, pp, i) => {
    e.stopPropagation();
    const b = pp.panel.bubbles[i], g = pp.geoms[i];
    const sfx = g.type === 'sfx';
    const s0 = b.s || 1, d0 = Math.abs(svgPoint(ref.current, e)[0] - g.cx) || 1;
    drag(e, (ev) => {
      const [x] = svgPoint(ref.current, ev);
      if (sfx) b.s = clamp((s0 * Math.abs(x - g.cx)) / d0, 0.4, 3);
      else b.w = clamp(Math.abs(x - g.cx) * 1.45, 90, 700);
      touch();
    }, commit);
  };
  const dragRow = (e, gt) => {
    const [, sy] = svgPoint(ref.current, e);
    const w0 = [...gt.weights], sum = w0.reduce((a, b) => a + b, 0), per = gt.avail / sum;
    drag(e, (ev) => {
      const dy = (svgPoint(ref.current, ev)[1] - sy) / per;
      const pair = w0[gt.row] + w0[gt.row + 1];
      const a = clamp(w0[gt.row] + dy, pair * 0.15, pair * 0.85);
      const w = [...w0]; w[gt.row] = a; w[gt.row + 1] = pair - a;
      page.rowW = w; touch();
    }, commit);
  };
  const dragCol = (e, gt) => {
    const [sx] = svgPoint(ref.current, e);
    const w0 = [...gt.weights], sum = w0.reduce((a, b) => a + b, 0), per = gt.avail / sum;
    drag(e, (ev) => {
      const dx = (svgPoint(ref.current, ev)[0] - sx) / per;
      const pair = w0[gt.col] + w0[gt.col + 1];
      const a = clamp(w0[gt.col] + dx, pair * 0.2, pair * 0.8);
      const w = [...w0]; w[gt.col] = a; w[gt.col + 1] = pair - a;
      page.colW = page.colW && page.colW.length === layout.rows.length ? page.colW : layout.rows.map(() => null);
      page.colW[gt.row] = w; touch();
    }, commit);
  };

  return (
    <svg class="page-svg" viewBox={`0 0 ${PAGE.w} ${PAGE.h}`} ref={ref}
      onPointerDown={(e) => { if (e.target === ref.current || e.target.dataset.bg) { ui.bubbleId = null; touch(); } }}>
      {prims.map((p, i) => <g data-bg="1"><Prim p={p} k={'pg' + i} /></g>)}
      {panels.map((pp) => {
        const sel = ui.panelId === pp.panel.id, r = pp.rect;
        const base = pp.prims.filter((p) => p.t !== 'group'), groups = pp.prims.filter((p) => p.t === 'group');
        return (
          <g>
            <g style="cursor:pointer" onPointerDown={() => selectPanel(pp.panel.id)} onDblClick={() => onOpenPanel(pp.panel.id)}>
              {base.map((p, i) => <Prim p={p} k={pp.panel.id + i} />)}
              {!pp.panel.artAsset && pp.panel.setupAsset && <g><rect x={r.x + 12} y={r.y + r.h - 44} width="150" height="30" rx="6" fill="rgba(0,0,0,.7)" /><text x={r.x + 87} y={r.y + r.h - 23} text-anchor="middle" font-size="17" font-family="system-ui,sans-serif" fill="#fff">Set up, not stylized</text></g>}
            </g>
            {sel && <rect x={r.x - 7} y={r.y - 7} width={r.w + 14} height={r.h + 14} fill="none" stroke="#f0b541" stroke-width="5" rx="3" pointer-events="none" />}
            {groups.map((p, i) => (
              <g style="cursor:grab" onPointerDown={(e) => moveBubble(e, pp, i)}><Prim p={p} k={'b' + pp.panel.id + i} /></g>
            ))}
            {sel && pp.geoms.map((g, i) => {
              if (pp.panel.bubbles[i]?.id !== ui.bubbleId) return null;
              const tx = g.tail ? g.tail.x : g.cx, ty = g.tail ? g.tail.y : g.cy + g.ry + 34;
              return (
                <g>
                  <rect x={g.cx - g.rx - 6} y={g.cy - g.ry - 6} width={2 * g.rx + 12} height={2 * g.ry + 12} fill="none" stroke="#f0b541" stroke-width="2.5" stroke-dasharray="8 6" rx="8" pointer-events="none" />
                  <circle cx={g.cx + g.rx + 6} cy={g.cy} r="11" fill="#f0b541" stroke="#16161a" stroke-width="3" style="cursor:ew-resize" onPointerDown={(e) => resizeBubble(e, pp, i)} />
                  {!g.noTail && <circle cx={tx} cy={ty} r="11" fill="#fff" stroke="#f0b541" stroke-width="4" style="cursor:move" onPointerDown={(e) => moveTail(e, pp, i)} />}
                </g>
              );
            })}
          </g>
        );
      })}
      {layout.rowGutters.map((g) => <rect x={g.x} y={g.y - 4} width={g.w} height={g.h + 8} fill="transparent" style="cursor:row-resize" onPointerDown={(e) => dragRow(e, g)} />)}
      {layout.colGutters.map((g) => <rect x={g.x - 4} y={g.y} width={g.w + 8} height={g.h} fill="transparent" style="cursor:col-resize" onPointerDown={(e) => dragCol(e, g)} />)}
    </svg>
  );
}

// Page geometry. A page is 1100 x 1700 units (US comic proportions). Panels flow into rows
// based on the size hint in the script; row heights and column widths can be dragged.
export const PAGE = { w: 1100, h: 1700, margin: 56, gutter: 18 };

export function pageRows(page) {
  const rows = [];
  let cur = null;
  for (const p of page.panels) {
    const s = p.size || 'half';
    if (s === 'wide' || s === 'big' || s === 'splash') {
      rows.push({ kind: s, panels: [p], weight: s === 'wide' ? 1 : s === 'big' ? 1.7 : 3 });
      cur = null;
    } else {
      const max = s === 'third' ? 3 : 2;
      if (!cur || cur.kind !== s || cur.panels.length >= max) { cur = { kind: s, panels: [], weight: 1 }; rows.push(cur); }
      cur.panels.push(p);
    }
  }
  return rows;
}

export function layoutPage(page) {
  const { w, h, margin: M, gutter: G } = PAGE;
  const rows = pageRows(page);
  const rowW = page.rowW && page.rowW.length === rows.length ? page.rowW : rows.map((r) => r.weight);
  const total = rowW.reduce((a, b) => a + b, 0) || 1;
  const availH = h - 2 * M - G * Math.max(0, rows.length - 1);
  const rects = [], rowGutters = [], colGutters = [];
  let y = M;
  rows.forEach((row, r) => {
    const rh = (availH * rowW[r]) / total;
    const n = row.panels.length;
    const cw = page.colW && page.colW[r] && page.colW[r].length === n ? page.colW[r] : row.panels.map(() => 1);
    const ct = cw.reduce((a, b) => a + b, 0);
    const availW = w - 2 * M - G * (n - 1);
    let x = M;
    row.panels.forEach((p, c) => {
      const pw = (availW * cw[c]) / ct;
      rects.push({ id: p.id, x, y, w: pw, h: rh, row: r, col: c });
      if (c < n - 1) colGutters.push({ x: x + pw, y, w: G, h: rh, row: r, col: c, weights: cw, avail: availW });
      x += pw + G;
    });
    if (r < rows.length - 1) rowGutters.push({ x: M, y: y + rh, w: w - 2 * M, h: G, row: r, weights: rowW, avail: availH });
    y += rh + G;
  });
  return { rects, rowGutters, colGutters, rows };
}

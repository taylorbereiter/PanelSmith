// The starter comic shown on first launch, so the app opens with something to explore.
import { uid } from './util.js';
import { syncDoc } from './script.js';
import { newFigure } from './figure2d.jsx';

const SCRIPT = `PAGE 1

PANEL 1 (wide)
The lighthouse at dusk. Storm clouds roll in off the sea.
CAPTION: The light had not gone out in ninety years.

PANEL 2
Mara climbs the spiral stairs, lantern in hand, looking up.
MARA: Grandpa? Are you up there?

PANEL 3
Close on the empty chair by the lamp. A cup, still steaming.
MARA (thought): He never leaves his tea.

PANEL 4 (wide)
Through the window: a small boat far out, a light on its bow.
MARA (shout): Oh no!

PAGE 2

PANEL 1 (big)
Mara bursts out of the lighthouse door into the rain, coat flying.
SFX: KRAKOOM

PANEL 2
Grandpa in the boat, calm, rowing toward something glowing under the water.
GRANDPA: Easy now. I see you.

PANEL 3
Mara at the edge of the rocks, shouting across the waves.
MARA (shout): Come back!
`;

export function demoDoc() {
  const mara = { id: uid('ch'), name: 'Mara', color: '#2f8f83', description: 'A girl of about twelve with short auburn hair, freckles, a teal raincoat and rubber boots. Curious and stubborn.', refAsset: null };
  const grandpa = { id: uid('ch'), name: 'Grandpa', color: '#e8833a', description: 'A lighthouse keeper in his seventies with a white beard, a navy wool cap and a heavy orange oilskin coat.', refAsset: null };
  const doc = syncDoc({
    id: uid('proj'), version: 1, title: 'The Lighthouse Keeper',
    style: { preset: 'ink', custom: '', refAsset: null }, caps: true,
    characters: [mara, grandpa], script: SCRIPT, pages: [],
  });
  const p2 = doc.pages[0].panels[1];
  const fig = newFigure(470, 640, mara.id, 'climb');
  p2.setup = {
    mode: '2d', d3: null,
    d2: {
      h: 1066, bg: { kind: 'stairs', tone: 'night' }, view: { cx: 500, cy: 533, zoom: 1 }, light: { x: 330, y: 560 },
      objects: [fig, { id: uid('pr'), type: 'prop', kind: 'lantern', x: 548, y: 560, scale: 0.9, rot: 0, flip: false, color: '#f2c94c' }],
    },
  };
  return doc;
}

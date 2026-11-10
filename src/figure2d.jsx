// The 2D mannequin: a jointed figure posed by dragging its joints.
// Angles are absolute, in degrees, measured clockwise from straight up (0 = up, 90 = right, 180 = down).
import { rad, deg, clamp, shade, uid } from './util.js';

export const BONES = { head: 34, neck: 12, torso: 118, upperArm: 60, lowerArm: 56, upperLeg: 86, lowerLeg: 84, shoulder: 27, hip: 14 };
const INK = '#23232a', SKIN = '#ead9c6';
const dir = (a) => [Math.sin(rad(a)), -Math.cos(rad(a))];
const add = (p, d, l) => [p[0] + d[0] * l, p[1] + d[1] * l];
export const angleTo = (from, to) => deg(Math.atan2(to[0] - from[0], -(to[1] - from[1])));

export const POSES = {
  stand: { name: 'Stand', pose: { torso: 0, head: 0, armL: [192, 186], armR: [168, 174], legL: [185, 181], legR: [175, 179] } },
  walk: { name: 'Walk', facing: 'right', pose: { torso: 4, head: 4, armL: [150, 135], armR: [205, 185], legL: [205, 215], legR: [158, 172] } },
  run: { name: 'Run', facing: 'right', pose: { torso: 18, head: 14, armL: [120, 40], armR: [235, 150], legL: [232, 285], legR: [128, 190] } },
  sit: { name: 'Sit', facing: 'right', pose: { torso: -4, head: 0, armL: [165, 110], armR: [160, 105], legL: [92, 178], legR: [98, 180] } },
  climb: { name: 'Climb', facing: 'right', pose: { torso: 10, head: 20, armL: [60, 25], armR: [150, 80], legL: [200, 195], legR: [110, 185] } },
  reach: { name: 'Reach up', pose: { torso: 0, head: -8, armL: [200, 190], armR: [25, 12], legL: [185, 181], legR: [175, 179] } },
  point: { name: 'Point', facing: 'right', pose: { torso: 2, head: 2, armL: [190, 186], armR: [88, 86], legL: [186, 182], legR: [172, 178] } },
  wave: { name: 'Wave', pose: { torso: 0, head: 5, armL: [192, 186], armR: [62, 10], legL: [185, 181], legR: [175, 179] } },
  hips: { name: 'Hands on hips', pose: { torso: 0, head: 0, armL: [232, 140], armR: [128, 220], legL: [190, 184], legR: [170, 176] } },
  cheer: { name: 'Cheer', pose: { torso: 0, head: -4, armL: [322, 345], armR: [38, 15], legL: [192, 186], legR: [168, 174] } },
  crouch: { name: 'Crouch', facing: 'right', pose: { torso: 28, head: 30, armL: [150, 120], armR: [140, 100], legL: [110, 215], legR: [95, 205] } },
  kneel: { name: 'Kneel', facing: 'right', pose: { torso: 4, head: 8, armL: [175, 150], armR: [165, 130], legL: [180, 268], legR: [95, 180] } },
  lie: { name: 'Lie down', facing: 'right', pose: { torso: 90, head: 84, armL: [100, 95], armR: [108, 100], legL: [268, 270], legR: [264, 268] } },
  fall: { name: 'Fall', pose: { torso: -35, head: -50, armL: [280, 320], armR: [40, 350], legL: [150, 200], legR: [110, 140] } },
  fight: { name: 'Fight', facing: 'right', pose: { torso: 8, head: 6, armL: [120, 30], armR: [100, 70], legL: [200, 195], legR: [155, 185] } },
  think: { name: 'Think', pose: { torso: 0, head: 8, armL: [170, 95], armR: [150, 20], legL: [185, 181], legR: [175, 179] } },
};

export function newFigure(x, y, charId = null, poseId = 'stand') {
  const p = POSES[poseId];
  return { id: uid('fg'), type: 'figure', charId, x, y, scale: 1, facing: p.facing || 'front', pose: JSON.parse(JSON.stringify(p.pose)) };
}

/** World positions of every joint. */
export function joints(f) {
  const s = f.scale, P = f.pose, B = BONES;
  const hip = [f.x, f.y];
  const td = dir(P.torso), perp = dir(P.torso + 90);
  const side = f.facing === 'front' || f.facing === 'back' ? 1 : 0.22;
  const chest = add(hip, td, B.torso * s);
  const j = { hip, chest };
  j.head = add(chest, dir(P.head), (B.neck + B.head) * s);
  j.headTop = add(chest, dir(P.head), (B.neck + B.head * 2) * s);
  for (const [k, sign] of [['L', -1], ['R', 1]]) {
    j['sh' + k] = add(chest, perp, sign * B.shoulder * side * s);
    j['elbow' + k] = add(j['sh' + k], dir(P['arm' + k][0]), B.upperArm * s);
    j['hand' + k] = add(j['elbow' + k], dir(P['arm' + k][1]), B.lowerArm * s);
    j['hip' + k] = add(hip, perp, sign * B.hip * side * s);
    j['knee' + k] = add(j['hip' + k], dir(P['leg' + k][0]), B.upperLeg * s);
    j['foot' + k] = add(j['knee' + k], dir(P['leg' + k][1]), B.lowerLeg * s);
  }
  return j;
}
export function figureBounds(f) {
  const j = joints(f), r = BONES.head * f.scale;
  const pts = Object.values(j);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs, j.head[0] - r) - 14, y: Math.min(...ys, j.head[1] - r) - 14, x2: Math.max(...xs, j.head[0] + r) + 14, y2: Math.max(...ys) + 16 };
}

/** Handles the user can drag, and what each one does. */
export const HANDLES = ['chest', 'headTop', 'elbowL', 'handL', 'elbowR', 'handR', 'kneeL', 'footL', 'kneeR', 'footR'];

function ik(origin, target, l1, l2, bend) {
  const dx = target[0] - origin[0], dy = target[1] - origin[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.5);
  const base = Math.atan2(dx, -dy);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const a1 = base + bend * a;
  const mid = [origin[0] + Math.sin(a1) * l1, origin[1] - Math.cos(a1) * l1];
  const end = [origin[0] + Math.sin(base) * d, origin[1] - Math.cos(base) * d];
  return [deg(a1), angleTo(mid, end)];
}
/** Move a handle to a world position, updating the pose. Hands and feet use two-bone IK. */
export function dragHandle(f, handle, pt) {
  const j = joints(f), s = f.scale, B = BONES, P = f.pose;
  if (handle === 'chest') { P.torso = angleTo(j.hip, pt); return; }
  if (handle === 'headTop') { P.head = angleTo(j.chest, pt); return; }
  const k = handle.slice(-1), part = handle.slice(0, -1);
  if (part === 'elbow') P['arm' + k][0] = angleTo(j['sh' + k], pt);
  else if (part === 'knee') P['leg' + k][0] = angleTo(j['hip' + k], pt);
  else {
    const arm = part === 'hand';
    const o = j[(arm ? 'sh' : 'hip') + k], m = j[(arm ? 'elbow' : 'knee') + k], e = j[handle];
    const cross = (m[0] - o[0]) * (e[1] - o[1]) - (m[1] - o[1]) * (e[0] - o[0]);
    const bend = cross >= 0 ? -1 : 1;
    P[(arm ? 'arm' : 'leg') + k] = ik(o, pt, (arm ? B.upperArm : B.upperLeg) * s, (arm ? B.lowerArm : B.lowerLeg) * s, bend);
  }
}

function Bone({ a, b, w, color }) {
  return (
    <>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK} stroke-width={w + 7} stroke-linecap="round" />
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} stroke-width={w} stroke-linecap="round" />
    </>
  );
}

/** Draws a figure. `color` is the character color, or null for an unassigned gray mannequin. */
export function Figure({ f, color }) {
  const j = joints(f), s = f.scale;
  const c = color || '#8d96a3';
  const legC = shade(c, -0.38), farC = shade(c, -0.2), farLeg = shade(c, -0.5);
  const sideways = f.facing === 'left' || f.facing === 'right';
  const fx = f.facing === 'left' ? -1 : 1;
  const limb = (k, far) => ({
    arm: (
      <g>
        <Bone a={j['sh' + k]} b={j['elbow' + k]} w={20 * s} color={far ? farC : c} />
        <Bone a={j['elbow' + k]} b={j['hand' + k]} w={17 * s} color={far ? shade(SKIN, -0.14) : SKIN} />
        <circle cx={j['hand' + k][0]} cy={j['hand' + k][1]} r={11 * s} fill={far ? shade(SKIN, -0.14) : SKIN} stroke={INK} stroke-width={3.5} />
      </g>
    ),
    leg: (
      <g>
        <Bone a={j['hip' + k]} b={j['knee' + k]} w={25 * s} color={far ? farLeg : legC} />
        <Bone a={j['knee' + k]} b={j['foot' + k]} w={21 * s} color={far ? farLeg : legC} />
        <ellipse cx={j['foot' + k][0] + (sideways ? fx * 10 * s : (k === 'L' ? -5 : 5) * s)} cy={j['foot' + k][1] + 4 * s} rx={19 * s} ry={11 * s} fill={INK} />
      </g>
    ),
  });
  const L = limb('L', sideways), R = limb('R', false);
  const hr = BONES.head * s, [hx, hy] = j.head;
  return (
    <g>
      {sideways && L.arm}
      {L.leg}{R.leg}
      <Bone a={j.hip} b={j.chest} w={50 * s} color={c} />
      <Bone a={j.chest} b={[j.chest[0] + (hx - j.chest[0]) * 0.3, j.chest[1] + (hy - j.chest[1]) * 0.3]} w={15 * s} color={SKIN} />
      {!sideways && L.arm}
      {R.arm}
      <g transform={`rotate(${f.pose.head} ${hx} ${hy})`}>
        <circle cx={hx} cy={hy} r={hr} fill={SKIN} stroke={INK} stroke-width={4} />
        {f.facing === 'back'
          ? <circle cx={hx} cy={hy} r={hr - 2} fill={shade(c, -0.45)} />
          : <path d={`M${hx - hr + 2} ${hy - 4 * s}A${hr - 2} ${hr - 2} 0 0 1 ${hx + hr - 2} ${hy - 4 * s}Q${hx + fx * (sideways ? -hr * 0.2 : 0)} ${hy - hr * 0.62} ${hx - hr + 2} ${hy - 4 * s}Z`} fill={shade(c, -0.45)} />}
        {f.facing === 'front' && <><circle cx={hx - 11 * s} cy={hy + 4 * s} r={3.6 * s} fill={INK} /><circle cx={hx + 11 * s} cy={hy + 4 * s} r={3.6 * s} fill={INK} /></>}
        {sideways && <>
          <circle cx={hx + fx * 14 * s} cy={hy + 4 * s} r={3.6 * s} fill={INK} />
          <path d={`M${hx + fx * (hr - 2)} ${hy + 3 * s}l${fx * 10 * s} ${7 * s}l${-fx * 10 * s} ${5 * s}`} fill={SKIN} stroke={INK} stroke-width={3.5} stroke-linejoin="round" />
        </>}
      </g>
    </g>
  );
}

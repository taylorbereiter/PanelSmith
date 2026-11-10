// Small shared UI components.
import { useState, useEffect, useRef } from 'preact/hooks';
import { Icon } from './icons.jsx';

export function Btn({ kind = '', icon, busy, children, class: cls = '', ...p }) {
  return (
    <button class={`btn ${kind} ${!children ? 'icon-only' : ''} ${cls}`} {...p} disabled={p.disabled || busy}>
      {busy ? <span class="spin" /> : icon && <Icon name={icon} size={15} />}{children}
    </button>
  );
}
export function Seg({ value, options, onChange, class: cls = '' }) {
  return (
    <div class={`seg ${cls}`}>
      {options.map((o) => {
        const [v, label, icon] = Array.isArray(o) ? o : [o, o];
        return <button class={v === value ? 'on' : ''} onClick={() => onChange(v)}>{icon && <Icon name={icon} size={14} />}{label}</button>;
      })}
    </div>
  );
}
export function Slider({ label, value, min, max, step = 1, onInput, onChange, fmt }) {
  return (
    <div class="slider">
      {label && <label>{label}</label>}
      <input type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onInput(parseFloat(e.target.value))} onChange={(e) => onChange && onChange(parseFloat(e.target.value))} />
      <output>{fmt ? fmt(value) : value}</output>
    </div>
  );
}
export function Menu({ trigger, children, right }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    window.addEventListener('pointerdown', off);
    return () => window.removeEventListener('pointerdown', off);
  }, [open]);
  return (
    <div class="menu-wrap" ref={ref}>
      <span onClick={() => setOpen(!open)}>{trigger}</span>
      {open && <div class={`menu ${right ? 'right' : ''}`} onClick={(e) => { if (e.target.closest('.item')) setOpen(false); }}>{children}</div>}
    </div>
  );
}
export const Item = ({ icon, children, hint, ...p }) => <button class="item" {...p}>{icon && <Icon name={icon} size={15} />}{children}{hint && <small>{hint}</small>}</button>;

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div class="overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class={`modal ${wide ? 'wide' : ''}`}>
        <header>{title}<span class="grow" /><Btn kind="ghost sm" icon="x" onClick={onClose} title="Close" /></header>
        <div class="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

/** Follow the pointer until release. Calls onMove with each event and onEnd once. */
export function drag(e, onMove, onEnd) {
  e.preventDefault?.();
  const move = (ev) => onMove(ev);
  const up = (ev) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    onEnd && onEnd(ev);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}
/** Convert a pointer event to coordinates inside an SVG element (or one of its groups). */
export function svgPoint(el, e) {
  const svg = el.ownerSVGElement || el;
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  const m = el.getScreenCTM();
  const q = p.matrixTransform(m.inverse());
  return [q.x, q.y];
}

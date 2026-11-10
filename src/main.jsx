// App shell: top bar, view switching, global shortcuts.
import { render } from 'preact';
import { useEffect, useReducer, useState } from 'preact/hooks';
import comicNeue from '@fontsource/comic-neue/files/comic-neue-latin-700-normal.woff2';
import bangers from '@fontsource/bangers/files/bangers-latin-400-normal.woff2';
import css from './styles.css';
import { S, subscribe, touch, commit, undo, redo, canUndo, canRedo, boot, flush, newDoc, createProject, switchProject, removeProject, duplicateProject, toast } from './store.js';
import { Editor, deleteSelectedPanel } from './editor.jsx';
import { Workspace, closeWorkspace, refreshSnapshots } from './workspace.jsx';
import { Characters } from './characters.jsx';
import { SettingsModal, StyleModal } from './dialogs.jsx';
import { exportPagePng, exportPdf, exportStrip, exportProject, importProject } from './exporter.js';
import { PageStatic } from './pageview.jsx';
import { Btn, Menu, Item, Modal } from './ui.jsx';
import { Icon } from './icons.jsx';

const style = document.createElement('style');
style.textContent = `@font-face{font-family:"Comic Neue";font-weight:700;src:url(${comicNeue}) format("woff2")}
@font-face{font-family:"Bangers";font-weight:400;src:url(${bangers}) format("woff2")}
${css}`;
document.head.appendChild(style);

export function openPanel(id, tab = 'setup') {
  S.ui.panelId = id; S.ui.bubbleId = null; S.ui.wsTab = tab; S.ui.view = 'panel'; touch();
}

function ProjectMenu() {
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Menu trigger={<button class="title-btn">{S.doc.title}<Icon name="chevDown" size={14} /></button>}>
        <Item icon="pencil" onClick={() => setRenaming(true)}>Rename</Item>
        <Item icon="copy" onClick={duplicateProject}>Duplicate</Item>
        <Item icon="plus" onClick={() => createProject(newDoc())}>New comic</Item>
        <Item icon="upload" onClick={importProject}>Open project file</Item>
        {S.projects.length > 1 && <><hr /><div class="mlab">Your comics</div>
          {S.projects.filter((p) => p.id !== S.doc.id).map((p) => <Item icon="book" onClick={() => switchProject(p.id)}>{p.title}</Item>)}</>}
        <hr />
        <Item icon="trash" onClick={() => setConfirm(true)}>Delete this comic</Item>
      </Menu>
      {renaming && <Modal title="Rename comic" onClose={() => setRenaming(false)} footer={<Btn kind="pri" onClick={() => setRenaming(false)}>Done</Btn>}>
        <input class="input" value={S.doc.title} autofocus onInput={(e) => { S.doc.title = e.target.value || 'Untitled comic'; touch(); }} onChange={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { commit(); setRenaming(false); } }} />
      </Modal>}
      {confirm && <Modal title="Delete this comic?" onClose={() => setConfirm(false)}
        footer={<><Btn onClick={() => setConfirm(false)}>Cancel</Btn><Btn kind="danger" icon="trash" onClick={() => { setConfirm(false); removeProject(S.doc.id); }}>Delete</Btn></>}>
        <p class="hint" style="margin:0">“{S.doc.title}” and all of its art will be removed from this browser. This cannot be undone. Save a project file first if you might want it back.</p>
      </Modal>}
    </>
  );
}

function Preview({ onClose }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div class="preview">
      <Btn class="close" icon="x" onClick={onClose}>Close</Btn>
      {S.doc.pages.map((pg, i) => <PageStatic page={pg} idp={'pv' + i} />)}
    </div>
  );
}

function App() {
  const [, force] = useReducer((x) => x + 1, 0);
  const [busy, setBusy] = useState(null);
  useEffect(() => subscribe(force), []);
  useEffect(() => {
    const k = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); flush().then(() => toast('Saved')); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && !mod && S.ui.view === 'editor' && !S.ui.modal && S.ui.panelId && !S.ui.bubbleId
        && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.isContentEditable) { e.preventDefault(); deleteSelectedPanel(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  if (!S.doc) return <div class="app" style="display:grid;place-items:center"><span class="spin" /></div>;
  const ui = S.ui;
  const run = async (label, fn) => {
    setBusy(label);
    try { await fn(); } catch (e) { console.error(e); toast(e.message || String(e), 'error'); }
    setBusy(null);
  };
  const setView = (v) => { if (ui.view === 'panel') closeWorkspace(); ui.view = v; touch(); };
  return (
    <div class="app">
      <div class="top">
        <div class="logo"><svg width="16" height="16" viewBox="0 0 32 32"><path d="M5 5h10v13H5zM18 5h9v7h-9zM18 15h9v12h-9zM5 21h10v6H5z" fill="#16161a" /></svg></div>
        <ProjectMenu />
        <span class="meta">{S.doc.pages.length} {S.doc.pages.length === 1 ? 'page' : 'pages'}</span>
        <span class="grow" />
        <Btn kind="ghost" icon="undo" title="Undo" disabled={!canUndo()} onClick={undo} />
        <Btn kind="ghost" icon="redo" title="Redo" disabled={!canRedo()} onClick={redo} />
        <span class="sep" />
        <Btn kind={ui.view === 'editor' ? 'on' : ''} icon="grid" onClick={() => setView('editor')}>Pages</Btn>
        <Btn kind={ui.view === 'characters' ? 'on' : ''} icon="users" onClick={() => setView('characters')}>Characters</Btn>
        <Btn icon="palette" onClick={() => { ui.modal = 'style'; touch(); }}>Style</Btn>
        <Btn icon="eye" onClick={() => { ui.modal = 'preview'; touch(); }}>Preview</Btn>
        <Menu right trigger={<Btn kind="pri" icon="download" busy={!!busy}>Export</Btn>}>
          <Item icon="image" onClick={() => run('png', () => exportPagePng(ui.pageIdx))}>This page as PNG</Item>
          <Item icon="file" onClick={() => run('pdf', exportPdf)}>All pages as PDF</Item>
          <Item icon="down" onClick={() => run('strip', exportStrip)}>Vertical scroll strip</Item>
          <hr />
          <Item icon="download" onClick={() => run('proj', exportProject)}>Save project file</Item>
        </Menu>
        <Btn kind="ghost" icon="gear" title="Settings" onClick={() => { ui.modal = 'settings'; touch(); }} />
      </div>
      {ui.view === 'editor' && <Editor openPanel={openPanel} />}
      {ui.view === 'panel' && <Workspace />}
      {ui.view === 'characters' && <Characters />}
      {ui.modal === 'settings' && <SettingsModal onClose={() => { ui.modal = null; touch(); }} />}
      {ui.modal === 'style' && <StyleModal onClose={() => { ui.modal = null; touch(); }} />}
      {ui.modal === 'preview' && <Preview onClose={() => { ui.modal = null; touch(); }} />}
      {ui.toast && <div class={`toast ${ui.toast.kind}`}>{ui.toast.msg}</div>}
    </div>
  );
}

render(<App />, document.getElementById('app'));
document.fonts.load('700 25px "Comic Neue"').then(() => document.fonts.load('400 60px "Bangers"')).then(touch).catch(() => {});
boot().then(refreshSnapshots).catch((e) => { console.error(e); toast('Could not start: ' + e.message, 'error'); });

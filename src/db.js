// IndexedDB persistence. Projects and their image assets are stored separately so that
// saving the document after every edit stays cheap.
const DB = 'comic-creator';
let dbp;
function open() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('projects', { keyPath: 'id' });
        r.result.createObjectStore('assets');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && 'result' in out ? out.result : out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
export const listProjects = async () =>
  (await tx('projects', 'readonly', (s) => s.getAll())).map((p) => ({ id: p.id, title: p.doc.title, updated: p.updated }))
    .sort((a, b) => b.updated - a.updated);
export const loadProject = (id) => tx('projects', 'readonly', (s) => s.get(id));
export const saveProject = (doc) => tx('projects', 'readwrite', (s) => s.put({ id: doc.id, updated: Date.now(), doc }));
export const deleteProject = async (id) => {
  await tx('projects', 'readwrite', (s) => s.delete(id));
  const range = IDBKeyRange.bound(id + '/', id + '/￿');
  await tx('assets', 'readwrite', (s) => s.delete(range));
};
export const saveAssets = (projectId, entries) =>
  tx('assets', 'readwrite', (s) => { for (const [k, v] of entries) s.put(v, projectId + '/' + k); });
export async function loadAssets(projectId) {
  const range = IDBKeyRange.bound(projectId + '/', projectId + '/￿');
  const db = await open();
  return new Promise((res, rej) => {
    const out = {};
    const t = db.transaction('assets', 'readonly');
    const c = t.objectStore('assets').openCursor(range);
    c.onsuccess = () => {
      const cur = c.result;
      if (cur) { out[cur.key.slice(projectId.length + 1)] = cur.value; cur.continue(); }
    };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
  });
}
export const deleteAssets = (projectId, keys) =>
  tx('assets', 'readwrite', (s) => { for (const k of keys) s.delete(projectId + '/' + k); });

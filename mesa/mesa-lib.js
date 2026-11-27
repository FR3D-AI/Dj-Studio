/* Mesa Web · biblioteca
   - Lee el XML que exporta rekordbox (Archivo → Exportar colección en formato xml): pistas, BPM, grilla de tempo,
     memory cues, hot cues (con color y nombre), loops guardados y listas de reproducción.
   - Empareja cada pista con su archivo en la carpeta de música que elijas (por nombre de archivo).
   - Lo que cambies aquí (cues, grilla) se guarda en este navegador y se puede exportar de vuelta a rekordbox. */
(function(){
'use strict';
const MW = window.MW = window.MW || {};

/* ---------- IndexedDB ---------- */
let dbP = null;
function db(){
  if (dbP) return dbP;
  dbP = new Promise((ok, bad) => {
    const r = indexedDB.open('mesa-web', 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
  }).catch(() => null);
  return dbP;
}
async function idb(store, mode, fn){ const d = await db(); if (!d) return null; return new Promise(ok => { try { const tx = d.transaction(store, mode), st = tx.objectStore(store); const r = fn(st); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => ok(null); } catch(e){ ok(null); } }); }
const kvGet = k => idb('kv', 'readonly', s => s.get(k));
const kvSet = (k, v) => idb('kv', 'readwrite', s => s.put(v, k));

/* ---------- utilidades ---------- */
const base = p => { p = String(p || ''); const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')); return p.slice(i + 1); };
const norm = s => String(s || '').normalize('NFC').toLowerCase();
function locToPath(loc){
  let p = String(loc || '').replace(/^file:\/\/localhost/i, '').replace(/^file:\/\//i, '');
  try { p = decodeURIComponent(p); } catch(e){ try { p = decodeURI(p); } catch(e2){} }
  if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);
  return p;
}
const AUDIO_RE = /\.(mp3|wav|aiff?|m4a|aac|flac|ogg|opus|alac|mp4|wma)$/i;
function guessMeta(name){
  const b = name.replace(/\.[^.]+$/, ''), m = /^(.*?)\s+[-–]\s+(.*)$/.exec(b);
  return m ? {artist: m[1].trim(), title: m[2].trim()} : {artist: '', title: b};
}
const hex = c => '#' + c.map(x => Math.max(0, Math.min(255, x | 0)).toString(16).padStart(2, '0')).join('');

/* ---------- estado ---------- */
const L = MW.lib = {
  tracks: [], byId: new Map(), playlists: [], files: new Map(), folderName: '', xmlName: '', history: [],
  view: 'all', list: [], sel: 0, query: '', sortKey: null, sortDir: 1, dirHandle: null, needPerm: false, focus: 'list',
};
L.changed = () => { L.refresh(); MW.emitLib && MW.emitLib(); };

/* ---------- XML de rekordbox ---------- */
L.importXml = async function(text, name, quiet){
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.querySelector('DJ_PLAYLISTS')){ if (!quiet) MW.toast('Ese archivo no parece un XML de rekordbox. En rekordbox: Archivo → Exportar colección en formato xml.', true); return false; }
  // se borran las pistas del XML anterior (las de carpeta se quedan)
  L.tracks = L.tracks.filter(t => t.src !== 'xml'); L.byId = new Map(L.tracks.map(t => [t.id, t]));
  const xmlIds = new Map();
  for (const el of doc.querySelectorAll('COLLECTION > TRACK')){
    const a = k => el.getAttribute(k) || '';
    const loc = a('Location'), path = locToPath(loc);
    const t = {
      id: 'x' + a('TrackID'), rbId: a('TrackID'), src: 'xml', title: a('Name') || base(path), artist: a('Artist'), album: a('Album'), genre: a('Genre'),
      fileName: base(path), bpm: parseFloat(a('AverageBpm')) || 0, key: a('Tonality'), dur: parseFloat(a('TotalTime')) || 0, rating: (+a('Rating') || 0) / 51,
      loc, path, fname: norm(base(path)), size: +a('Size') || 0, comment: a('Comments'), color: a('Colour') ? '#' + a('Colour').replace(/^0x/i, '').padStart(6, '0').slice(-6) : '',
      added: a('DateAdded'), kind: a('Kind'), plays: +a('PlayCount') || 0, attrs: {}, grid: [], cues: [],
    };
    for (const at of el.attributes) t.attrs[at.name] = at.value;
    for (const g of el.querySelectorAll('TEMPO')) t.grid.push({t: parseFloat(g.getAttribute('Inizio')) || 0, bpm: parseFloat(g.getAttribute('Bpm')) || 0, bar: +g.getAttribute('Battito') || 1, metro: g.getAttribute('Metro') || '4/4'});
    for (const p of el.querySelectorAll('POSITION_MARK')){
      const num = +(p.getAttribute('Num') ?? -1), type = +(p.getAttribute('Type') || 0);
      const c = {t: parseFloat(p.getAttribute('Start')) || 0, num, type, name: p.getAttribute('Name') || ''};
      if (p.hasAttribute('End')) c.end = parseFloat(p.getAttribute('End'));
      if (p.hasAttribute('Red')) c.color = hex([+p.getAttribute('Red'), +p.getAttribute('Green'), +p.getAttribute('Blue')]);
      else if (num >= 0) c.color = MW.HOT_COLORS[num % 8];
      // rekordbox guarda cada hot cue dos veces en algunas versiones (con y sin color): se queda la primera
      if (num >= 0 && t.cues.some(x => x.num === num)) continue;
      t.cues.push(c);
    }
    if (!t.bpm && t.grid.length) t.bpm = t.grid[0].bpm;
    L.tracks.push(t); L.byId.set(t.id, t); xmlIds.set(t.rbId, t); xmlIds.set('L' + loc, t);
  }
  // listas de reproducción (carpetas y listas, con su orden)
  const walk = node => {
    const out = [];
    for (const ch of node.children){
      if (ch.tagName !== 'NODE') continue;
      const type = ch.getAttribute('Type'), name = ch.getAttribute('Name') || '';
      if (type === '0') out.push({name, children: walk(ch)});
      else {
        const keyType = ch.getAttribute('KeyType'), ids = [];
        for (const tr of ch.children){ if (tr.tagName !== 'TRACK') continue; const k = tr.getAttribute('Key'); const t = keyType === '1' ? xmlIds.get('L' + k) : xmlIds.get(k); if (t) ids.push(t.id); }
        out.push({name, ids});
      }
    }
    return out;
  };
  const root = doc.querySelector('PLAYLISTS > NODE');
  L.playlists = root ? walk(root) : [];
  // las canciones de la carpeta que están en el XML se quedan solo como pista de rekordbox (con sus cues)
  if (L.files.size){ folderTracks(); hydrate(); }
  L.xmlName = name || 'rekordbox.xml';
  if (!quiet){ kvSet('xml', {text, name: L.xmlName}); }
  L.view = 'all'; L.sel = 0;
  L.changed();
  const n = L.tracks.filter(t => t.src === 'xml').length;
  if (!quiet) MW.toast('Biblioteca de rekordbox: ' + n + ' pistas' + (L.playlists.length ? ' y ' + countLists(L.playlists) + ' listas' : '') + '. ' + (L.files.size ? '' : 'Ahora elige la carpeta donde está tu música.'));
  return true;
};
const countLists = arr => arr.reduce((s, p) => s + (p.children ? countLists(p.children) : 1), 0);

/* ---------- carpeta de música ---------- */
function addFile(file, path, handle){
  const k = norm(base(path || file.name));
  if (!AUDIO_RE.test(k)) return;
  const arr = L.files.get(k) || []; arr.push({file, path: path || (file && file.name), handle, size: file ? file.size : 0}); L.files.set(k, arr);
}
function folderTracks(){
  // los archivos que no están en el XML aparecen como pistas sueltas
  const inXml = new Set(L.tracks.filter(t => t.src === 'xml').map(t => t.fname));
  L.tracks = L.tracks.filter(t => t.src !== 'folder');
  for (const [k, arr] of L.files){
    if (inXml.has(k)) continue;
    const f = arr[0], m = guessMeta(base(f.path));
    const t = {id: 'f:' + f.path, src: 'folder', fileName: base(f.path), title: m.title, artist: m.artist, album: '', genre: '', bpm: 0, key: '', dur: 0, fname: k, path: f.path, size: f.size, grid: [], cues: [], color: ''};
    L.tracks.push(t);
  }
  L.byId = new Map(L.tracks.map(t => [t.id, t]));
}
// lo que ya se analizó antes (BPM, duración) aparece en la lista sin volver a analizar
async function hydrate(){
  for (const t of L.tracks){
    if (t.bpm && t.dur) continue;
    const s = await L.getSaved(t);
    if (s){ if (!t.bpm && s.grid && s.grid[0]) t.bpm = s.grid[0].bpm; if (!t.dur && s.dur) t.dur = s.dur; }
  }
  L.refresh(); MW.emitLib && MW.emitLib();
}
L.addFiles = function(fileList, folder){
  let n = 0;
  for (const f of fileList){ if (AUDIO_RE.test(f.name)){ addFile(f, f.webkitRelativePath || f.name); n++; } }
  if (folder) L.folderName = folder;
  folderTracks(); hydrate(); L.changed();
  return n;
};
async function walkDir(dir, path, depth){
  if (depth > 8) return;
  for await (const [name, h] of dir.entries()){
    if (name.startsWith('.')) continue;
    if (h.kind === 'file'){ if (AUDIO_RE.test(name)) addFile(null, path + name, h); }
    else await walkDir(h, path + name + '/', depth + 1);
  }
}
L.pickFolder = async function(){
  if (window.showDirectoryPicker){
    try {
      const h = await window.showDirectoryPicker({id: 'mesa-musica', mode: 'read'});
      await L.useDir(h); kvSet('dir', h); return true;
    } catch(e){ if (e && e.name === 'AbortError') return false; }
  }
  // respaldo: selector de carpeta clásico
  return new Promise(ok => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.webkitdirectory = true; inp.multiple = true;
    inp.onchange = () => { const fs = [...inp.files]; const top = fs[0] && fs[0].webkitRelativePath ? fs[0].webkitRelativePath.split('/')[0] : 'Carpeta'; const n = L.addFiles(fs, top); MW.toast(n + ' archivos de música en «' + top + '».'); ok(true); };
    inp.click();
  });
};
L.useDir = async function(h){
  L.dirHandle = h; L.needPerm = false;
  for (const [k, arr] of [...L.files]){ const keep = arr.filter(x => !x.handle); if (keep.length) L.files.set(k, keep); else L.files.delete(k); }
  MW.toast('Leyendo la carpeta «' + h.name + '»…');
  await walkDir(h, '', 0);
  L.folderName = h.name;
  folderTracks(); hydrate(); L.changed();
  const matched = L.tracks.filter(t => t.src === 'xml' && L.files.has(t.fname)).length, xmlN = L.tracks.filter(t => t.src === 'xml').length;
  MW.toast('Carpeta «' + h.name + '»: ' + L.files.size + ' archivos' + (xmlN ? ' · ' + matched + ' de ' + xmlN + ' pistas de rekordbox encontradas' : '') + '.');
};
L.regrant = async function(){
  if (!L.dirHandle) return;
  try { if (await L.dirHandle.requestPermission({mode: 'read'}) === 'granted') await L.useDir(L.dirHandle); } catch(e){}
};
L.hasFile = t => !!(t && (t.file || L.files.has(t.fname)));
function pick(t){
  const arr = L.files.get(t.fname); if (!arr || !arr.length) return null;
  if (arr.length === 1) return arr[0];
  // varios con el mismo nombre: el de igual tamaño, o el que comparte más carpetas con la ruta de rekordbox
  const bySize = t.size && arr.find(x => x.size === t.size); if (bySize) return bySize;
  const parts = norm(t.path || '').split(/[\\/]/).reverse();
  let best = arr[0], bs = -1;
  for (const x of arr){ const q = norm(x.path).split('/').reverse(); let s = 0; while (s < q.length && s < parts.length && q[s] === parts[s]) s++; if (s > bs){ bs = s; best = x; } }
  return best;
}
L.fileFor = async function(t){
  if (!t) return null;
  if (t.file) return t.file;
  const x = pick(t); if (!x) return null;
  if (x.file){ if (!t.size) t.size = x.file.size; return x.file; }
  try { const f = await x.handle.getFile(); x.size = f.size; if (!t.size) t.size = f.size; return f; } catch(e){ return null; }
};

/* ---------- lo guardado en este navegador (cues, grilla) ---------- */
const keyOf = t => (t.fname || '') + '|' + (t.size || '');
L.getSaved = t => idb('tracks', 'readonly', s => s.get(keyOf(t)));
L.save = (t, data) => { data.at = Date.now(); idb('tracks', 'readwrite', s => s.put(data, keyOf(t))); if (data.grid && data.grid.length && t.src !== 'xml') t.grid = data.grid; if (data.cues) t.cues = data.cues; t.edited = true; };
L.markPlayed = t => { L.history = [t.id, ...L.history.filter(x => x !== t.id)].slice(0, 200); };

/* ---------- vistas, búsqueda y orden ---------- */
L.sources = function(){
  const src = [{id:'all', name:'Colección', n: L.tracks.length, depth:0}];
  const add = (arr, d, path) => arr.forEach((p, i) => { const id = path + i; if (p.children){ src.push({id:'f' + id, name:p.name, folder:true, depth:d}); add(p.children, d + 1, id + '.'); } else src.push({id:'p' + id, name:p.name, n:p.ids.length, depth:d}); });
  if (L.playlists.length){ src.push({id:'h-pl', name:'Listas de rekordbox', head:true, depth:0}); add(L.playlists, 1, ''); }
  if (L.history.length) src.push({id:'hist', name:'Historial de hoy', n:L.history.length, depth:0});
  return src;
};
function listFor(id){
  if (id === 'all') return L.tracks;
  if (id === 'hist') return L.history.map(x => L.byId.get(x)).filter(Boolean);
  if (id[0] === 'p'){ const path = id.slice(1).split('.').map(Number); let arr = L.playlists, p = null; for (const i of path){ p = arr[i]; if (!p) return []; arr = p.children || []; } return p && p.ids ? p.ids.map(x => L.byId.get(x)).filter(Boolean) : []; }
  return [];
}
L.refresh = function(){
  let list = listFor(L.view);
  const q = norm(L.query).trim();
  if (q){ const ws = q.split(/\s+/); list = list.filter(t => { const h = norm(t.title + ' ' + t.artist + ' ' + (t.fileName || '') + ' ' + t.album + ' ' + t.genre + ' ' + t.key + ' ' + (t.bpm ? Math.round(t.bpm) : '')); return ws.every(w => h.includes(w)); }); }
  if (L.sortKey){ const k = L.sortKey, d = L.sortDir; list = [...list].sort((a, b) => { const x = a[k], y = b[k]; if (typeof x === 'number' || typeof y === 'number') return ((x || 0) - (y || 0)) * d; return String(x || '').localeCompare(String(y || ''), 'es', {numeric: true, sensitivity: 'base'}) * d; }); }
  L.list = list; L.sel = Math.max(0, Math.min(L.sel, list.length - 1));
};
L.selected = () => L.list[L.sel] || null;
L.setView = id => { L.view = id; L.sel = 0; L.changed(); };
L.move = n => { if (!L.list.length) return; L.sel = Math.max(0, Math.min(L.list.length - 1, L.sel + n)); MW.emitLib && MW.emitLib(true); };
L.control = function(k, v){
  switch (k){
    case 'MoveVertical': case 'SelectTrackKnob': case 'ScrollVertical':
      if (L.focus === 'tree') L.moveTree(v > 0 ? 1 : -1); else L.move(v); break;
    case 'MoveDown': case 'SelectNextTrack': if (v > 0) L.move(1); break;
    case 'MoveUp': case 'SelectPrevTrack': if (v > 0) L.move(-1); break;
    case 'SelectNextPlaylist': if (v > 0) L.moveTree(1); break;
    case 'SelectPrevPlaylist': if (v > 0) L.moveTree(-1); break;
    case 'SelectPlaylist': L.moveTree(v > 0 ? 1 : -1); break;
    case 'MoveFocusForward': case 'MoveFocusBackward': case 'MoveFocus': if (v) { L.focus = L.focus === 'list' ? 'tree' : 'list'; MW.emitLib && MW.emitLib(); } break;
    case 'GoToItem': case 'ToggleSelectedSidebarItem': if (v > 0 && L.focus === 'tree'){ L.focus = 'list'; MW.emitLib && MW.emitLib(); } break;
    case 'LoadSelectedIntoFirstStopped': if (v > 0){ const d = MW.decks.find(x => !x.playing()); if (d) d.load(L.selected()); } break;
  }
};
L.moveTree = n => { const s = L.sources().filter(x => !x.head && !x.folder); let i = s.findIndex(x => x.id === L.view); i = Math.max(0, Math.min(s.length - 1, i + n)); L.setView(s[i].id); };

/* ---------- analizar las canciones de la lista que no tienen BPM ---------- */
L.analyzeList = async function(){
  if (L.analyzing){ L.stopAnalyze = true; return; }
  const todo = L.list.filter(t => !t.bpm && L.hasFile(t)); if (!todo.length){ MW.toast('Todas las canciones de esta lista ya tienen BPM.'); return; }
  L.stopAnalyze = false; let k = 0;
  for (const t of todo){
    if (L.stopAnalyze) break;
    L.analyzing = (++k) + ' de ' + todo.length; MW.emitLib && MW.emitLib();
    try {
      const f = await L.fileFor(t); if (!f) continue;
      const buf = await MW.A.ctx.decodeAudioData(await f.arrayBuffer());
      const an = await MW.analyzeBeats(buf.getChannelData(0), buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0), buf.sampleRate, MW.analyzeOpts());
      t.dur = buf.duration; if (!t.size) t.size = f.size;
      const prev = (await L.getSaved(t)) || {};
      if (an){ t.bpm = an.bpm; L.save(t, {...prev, grid: an.grid, dur: buf.duration}); } else L.save(t, {...prev, dur: buf.duration});
    } catch(e){ console.error(e); }
  }
  L.analyzing = null; L.changed();
  MW.toast(L.stopAnalyze ? 'Análisis detenido.' : 'Análisis listo.');
};

/* ---------- exportar a rekordbox ---------- */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
L.exportXml = async function(){
  const tracks = L.tracks;
  const saved = new Map();
  for (const t of tracks){ const s = await L.getSaved(t); if (s) saved.set(t.id, s); }
  let id = 1; const ids = new Map();
  const rows = tracks.map(t => {
    const rid = t.rbId || String(100000 + id++); ids.set(t.id, rid);
    const s = saved.get(t.id) || {}, grid = s.grid || t.grid || [], cues = s.cues || t.cues || [];
    const at = Object.assign({}, t.attrs || {}, {TrackID: rid, Name: t.title, Artist: t.artist, Album: t.album, Genre: t.genre, Location: t.loc || ('file://localhost/' + encodeURI((t.path || t.fname).replace(/\\/g, '/'))), AverageBpm: (grid[0] && grid[0].bpm || t.bpm || 0).toFixed(2)});
    if (t.dur) at.TotalTime = String(Math.round(t.dur));
    if (t.key) at.Tonality = t.key;
    let x = '    <TRACK ' + Object.entries(at).map(([k, v]) => k + '="' + esc(v) + '"').join(' ') + '>\n';
    for (const g of grid) x += '      <TEMPO Inizio="' + (+g.t).toFixed(3) + '" Bpm="' + (+g.bpm).toFixed(2) + '" Metro="' + esc(g.metro || '4/4') + '" Battito="' + (g.bar || 1) + '"/>\n';
    for (const c of cues){
      x += '      <POSITION_MARK Name="' + esc(c.name || '') + '" Type="' + (c.type || 0) + '" Start="' + (+c.t).toFixed(3) + '"' + (c.end != null ? ' End="' + (+c.end).toFixed(3) + '"' : '') + ' Num="' + (c.num == null ? -1 : c.num) + '"';
      if (c.num >= 0 && c.color){ const h = c.color.replace('#', ''); x += ' Red="' + parseInt(h.slice(0, 2), 16) + '" Green="' + parseInt(h.slice(2, 4), 16) + '" Blue="' + parseInt(h.slice(4, 6), 16) + '"'; }
      x += '/>\n';
    }
    return x + '    </TRACK>\n';
  });
  const node = (p, d) => { const pad = '  '.repeat(d); if (p.children) return pad + '<NODE Type="0" Name="' + esc(p.name) + '" Count="' + p.children.length + '">\n' + p.children.map(c => node(c, d + 1)).join('') + pad + '</NODE>\n'; return pad + '<NODE Name="' + esc(p.name) + '" Type="1" KeyType="0" Entries="' + p.ids.length + '">\n' + p.ids.map(i => pad + '  <TRACK Key="' + ids.get(i) + '"/>\n').join('') + pad + '</NODE>\n'; };
  const lists = [...L.playlists]; if (L.history.length) lists.push({name: 'Mesa Web ' + new Date().toLocaleDateString(), ids: L.history.slice().reverse()});
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<DJ_PLAYLISTS Version="1.0.0">\n  <PRODUCT Name="rekordbox" Version="6.0.0" Company="Mesa Web DJ Studio"/>\n  <COLLECTION Entries="' + rows.length + '">\n' + rows.join('') + '  </COLLECTION>\n  <PLAYLISTS>\n    <NODE Type="0" Name="ROOT" Count="' + lists.length + '">\n' + lists.map(p => node(p, 3)).join('') + '    </NODE>\n  </PLAYLISTS>\n</DJ_PLAYLISTS>\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml], {type: 'application/xml'})); a.download = 'mesa-web-rekordbox.xml'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

/* ---------- forma de onda de 3 colores (graves, medios, agudos), 150 puntos por segundo ---------- */
MW.analyseWave = async function(Lc, Rc, sr){
  const RATE = 150, hop = Math.max(1, Math.round(sr / RATE)), n = Math.ceil(Lc.length / hop);
  const lo = new Float32Array(n), mi = new Float32Array(n), hi = new Float32Array(n), pk = new Float32Array(n);
  const aL = 1 - Math.exp(-2 * Math.PI * 200 / sr), aH = 1 - Math.exp(-2 * Math.PI * 2200 / sr);
  let l1 = 0, l2 = 0, h1 = 0, h2 = 0, j = 0, cnt = 0, mLo = 0, mMi = 0, mHi = 0, mPk = 0;
  const CH = 1 << 20;
  for (let s = 0; s < Lc.length; s += CH){
    const e = Math.min(Lc.length, s + CH);
    for (let i = s; i < e; i++){
      const x = (Lc[i] + Rc[i]) * 0.5;
      l1 += aL * (x - l1); l2 += aL * (l1 - l2);
      h1 += aH * (x - h1); h2 += aH * (h1 - h2);
      const vl = Math.abs(l2), vh = Math.abs(x - h2), vm = Math.abs(h2 - l2), vp = Math.abs(x);
      if (vl > mLo) mLo = vl; if (vm > mMi) mMi = vm; if (vh > mHi) mHi = vh; if (vp > mPk) mPk = vp;
      if (++cnt === hop){ lo[j] = mLo; mi[j] = mMi; hi[j] = mHi; pk[j] = mPk; j++; cnt = 0; mLo = mMi = mHi = mPk = 0; }
    }
    await new Promise(r => setTimeout(r, 0));
  }
  if (cnt && j < n){ lo[j] = mLo; mi[j] = mMi; hi[j] = mHi; pk[j] = mPk; }
  const q = (a, k) => { const out = new Uint8Array(n); let m = 1e-6; for (let i = 0; i < n; i++) if (a[i] > m) m = a[i]; const g = 255 / m * k; for (let i = 0; i < n; i++) out[i] = Math.min(255, a[i] * g); return out; };
  return {rate: RATE, n, lo: q(lo, 1), mid: q(mi, 0.9), hi: q(hi, 0.8), pk: q(pk, 1)};
};

/* ---------- al abrir: se recupera la biblioteca de la última vez ---------- */
L.restore = async function(){
  const x = await kvGet('xml'); if (x && x.text) await L.importXml(x.text, x.name, true);
  const h = await kvGet('dir');
  if (h && h.queryPermission){
    L.dirHandle = h; L.folderName = h.name;
    try { const p = await h.queryPermission({mode: 'read'}); if (p === 'granted') await L.useDir(h); else { L.needPerm = true; L.changed(); } } catch(e){}
  }
};
L.forget = async function(){ await kvSet('xml', null); await kvSet('dir', null); L.tracks = []; L.byId.clear(); L.playlists = []; L.files.clear(); L.folderName = ''; L.xmlName = ''; L.dirHandle = null; L.needPerm = false; L.changed(); };
})();

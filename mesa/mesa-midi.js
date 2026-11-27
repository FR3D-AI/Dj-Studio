/* Mesa Web · controladoras por Web MIDI
   Se conecta sola: reconoce la controladora por su nombre y carga el mapeo publicado por el proyecto Mixxx
   (código abierto, GPL-2.0+): el XML con los mensajes MIDI y su script. La Pioneer DDJ-400 viene incluida aquí;
   para las demás (más de 140) el mapeo se descarga de GitHub, fijado a una versión exacta. */
(function(){
'use strict';
const MW = window.MW = window.MW || {};
const BASE = (document.currentScript && document.currentScript.src) || location.href;
const MIXXX_COMMIT = '902cfc2543d7ef65bda1678e6f3c3e98be4aa39d';
const RAW = 'https://raw.githubusercontent.com/mixxxdj/mixxx/' + MIXXX_COMMIT + '/res/controllers/';
const LOCAL = {'Pioneer-DDJ-400.midi.xml': 1, 'Pioneer-DDJ-400-script.js': 1, 'common-controller-scripts.js': 1};
const localUrl = f => new URL('../vendor/mixxx/' + f, BASE).href;

const M = MW.midi = {access: null, sysex: false, devices: [], index: null, status: 'off', log: []};
const note = (t, warn) => { M.log.unshift((warn ? '⚠️ ' : '') + t); M.log.length = Math.min(M.log.length, 30); MW.emitMidi && MW.emitMidi(); };
M.note = note;

async function fetchText(f){
  const url = LOCAL[f] ? localUrl(f) : RAW + encodeURIComponent(f).replace(/%2F/g, '/');
  const key = 'mesa-mixxx:' + MIXXX_COMMIT.slice(0, 8) + ':' + f;
  if (!LOCAL[f]){ try { const c = localStorage.getItem(key); if (c) return c; } catch(e){} }
  const r = await fetch(url, {cache: 'force-cache'}); if (!r.ok) throw new Error('No se pudo descargar ' + f + ' (' + r.status + ')');
  const t = await r.text();
  if (!LOCAL[f] && t.length < 400000){ try { localStorage.setItem(key, t); } catch(e){} }
  return t;
}
const normName = s => String(s || '').toLowerCase().replace(/^(pioneer( dj)?|alphatheta|numark|hercules|denon( dj)?|reloop|native instruments|behringer|roland|akai( professional)?|vestax|stanton|gemini|traktor)\s+/, '').replace(/[^a-z0-9]/g, '');
// el mapeo que corresponde al nombre que reporta el sistema ("DDJ-400", "DDJ-400 MIDI 1", "Pioneer DDJ-400"…)
function findMapping(portName){
  const dn = String(portName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let best = null, bl = 0;
  for (const e of M.index || []){
    const cand = [e.n, e.f.replace(/\.midi\.xml$/, '')].map(normName).filter(x => x.length >= 4);
    for (const c of cand) if (dn.includes(c) && c.length > bl){ best = e; bl = c.length; }
  }
  return best;
}
M.findMapping = findMapping;

/* ---------- motor compatible con los scripts de Mixxx ---------- */
function makeHost(dev){
  const timers = new Map(); let tid = 1;
  const resolveFn = f => typeof f === 'function' ? f : (typeof f === 'string' && dev.evalIn ? dev.evalIn(f) : null);
  const conn = (group, key, cb) => {
    const c = MW.ctl(group, key), fn = (v, g, k) => { try { cb(v, g, k); } catch(e){ console.error('[Mixxx script]', e); } };
    c.conns.push(fn); dev.conns.push([c, fn]);
    return {group, key, isConnected: true, disconnect(){ const i = c.conns.indexOf(fn); if (i >= 0) c.conns.splice(i, 1); this.isConnected = false; return true; }, trigger(){ fn(c.v, group, key); }};
  };
  const soft = (c, newP) => {
    if (!c.soft || dev.fromScriptInit) return true;
    if (c.softIgnore){ c.softIgnore = false; c.softLast = newP; return false; }
    const cur = MW.toParam(c.s, c.v), last = c.softLast; c.softLast = newP;
    if (last == null) return Math.abs(newP - cur) < 0.06;
    if (Math.abs(newP - cur) < 0.06 || (last - cur) * (newP - cur) <= 0) return true;
    return false;
  };
  dev.soft = soft;
  const engine = {
    getValue: (g, k) => MW.getValue(g, k),
    setValue: (g, k, v) => { const c = MW.ctl(g, k); if (c.soft && (c.s.t === 'pot' || c.s.t === 'log') && !soft(c, MW.toParam(c.s, +v))) return; MW.setValue(g, k, v, 'midi'); },
    getParameter: (g, k) => MW.getParameter(g, k),
    setParameter: (g, k, p) => { const c = MW.ctl(g, k); if (c.soft && !soft(c, +p)) return; MW.setParameter(g, k, p, 'midi'); },
    getParameterForValue: (g, k, v) => MW.toParam(MW.ctl(g, k).s, v),
    reset: (g, k) => MW.reset(g, k),
    getDefaultValue: (g, k) => MW.ctl(g, k).s.def || 0,
    getDefaultParameter: (g, k) => { const c = MW.ctl(g, k); return MW.toParam(c.s, c.s.def || 0); },
    makeConnection: conn, makeUnbufferedConnection: conn,
    connectControl: (g, k, cb, remove) => {
      const f = resolveFn(cb); if (!f) return false;
      if (remove){ const c = MW.ctl(g, k); dev.conns = dev.conns.filter(([cc, fn]) => { if (cc === c && fn.__src === f){ const i = c.conns.indexOf(fn); if (i >= 0) c.conns.splice(i, 1); return false; } return true; }); return true; }
      const h = conn(g, k, f); dev.conns[dev.conns.length - 1][1].__src = f; return h;
    },
    trigger: (g, k) => { const c = MW.ctl(g, k); for (const fn of c.conns.slice()) fn(c.v, g, k); for (const o of c.outs) o(c.v); },
    beginTimer: (ms, fn, oneShot) => {
      const f = resolveFn(fn); if (!f) return 0; const id = tid++;
      const h = oneShot ? setTimeout(() => { timers.delete(id); try { f(); } catch(e){ console.error(e); } }, Math.max(20, ms)) : setInterval(() => { try { f(); } catch(e){ console.error(e); } }, Math.max(20, ms));
      timers.set(id, [h, oneShot]); return id;
    },
    stopTimer: id => { const t = timers.get(id); if (!t) return false; (t[1] ? clearTimeout : clearInterval)(t[0]); timers.delete(id); return true; },
    softTakeover: (g, k, on) => { const c = MW.ctl(g, k); c.soft = !!on; c.softLast = null; },
    softTakeoverIgnoreNextValue: (g, k) => { MW.ctl(g, k).softIgnore = true; },
    scratchEnable: (n, iv, rpm) => MW.scratchEnable(n, iv, rpm),
    scratchTick: (n, t) => MW.scratchTick(n, t),
    scratchDisable: n => MW.scratchDisable(n),
    isScratching: n => MW.isScratching(n),
    brake: (n, on) => { if (on) MW.setValue('[Channel' + n + ']', 'play', 0); },
    spinback: (n, on) => { if (on) MW.setValue('[Channel' + n + ']', 'play', 0); },
    softStart: (n, on) => { if (on) MW.setValue('[Channel' + n + ']', 'play', 1); },
    isBrakeActive: () => false, isSpinbackActive: () => false, isSoftStartActive: () => false,
    getSetting: name => dev.settings[name],
    getSharedData: () => dev.shared, setSharedData: v => { dev.shared = v; }, makeSharedDataConnection: () => ({disconnect(){}}),
    log: (...a) => console.log('[' + dev.name + ']', ...a),
  };
  const midi = {
    sendShortMsg: (st, d1, d2) => dev.send([st & 0xFF, d1 & 0x7F, Math.max(0, Math.min(127, Math.round(d2 || 0)))]),
    sendSysexMsg: (data, len) => { if (!M.sysex) return; dev.send(Array.from(data).slice(0, len || data.length)); },
    send: data => { const a = Array.from(data); if (a[0] === 0xF0 && !M.sysex) return; dev.send(a); },
  };
  dev.timers = timers;
  return {engine, midi};
}

/* ---------- lectura del XML de Mixxx ---------- */
function parseXml(text){
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const num = s => { s = String(s || '').trim(); return s ? (s.startsWith('0x') || s.startsWith('0X') ? parseInt(s, 16) : parseInt(s, 10)) : 0; };
  const controls = new Map(), outputs = [], scripts = [], settings = {};
  for (const f of doc.querySelectorAll('scriptfiles > file')) scripts.push({file: f.getAttribute('filename'), prefix: f.getAttribute('functionprefix') || ''});
  for (const o of doc.querySelectorAll('settings option')){ const v = o.getAttribute('variable'); if (!v) continue; let d = o.getAttribute('default'); const type = o.getAttribute('type'); if (type === 'boolean') d = d === 'true'; else if (type === 'integer' || type === 'real') d = +d; else if (type === 'enum'){ const sel = o.querySelector('value[default="true"]') || o.querySelector('value'); d = sel ? sel.textContent.trim() : ''; } settings[v] = d; }
  for (const c of doc.querySelectorAll('controls > control')){
    const t = k => (c.querySelector(k) && c.querySelector(k).textContent || '').trim();
    const opts = new Set([...(c.querySelector('options') ? c.querySelector('options').children : [])].map(x => x.tagName.toLowerCase()));
    const ctl = {status: num(t('status')), midino: num(t('midino')), group: t('group'), key: t('key'), opts};
    const id = (ctl.status << 8) | ctl.midino;
    if (!controls.has(id)) controls.set(id, []);
    controls.get(id).push(ctl);
  }
  for (const o of doc.querySelectorAll('outputs > output')){
    const t = k => (o.querySelector(k) && o.querySelector(k).textContent || '').trim();
    outputs.push({group: t('group'), key: t('key'), status: num(t('status')), midino: num(t('midino')), on: t('on') ? num(t('on')) : 0x7F, off: t('off') ? num(t('off')) : 0, min: t('minimum') !== '' ? parseFloat(t('minimum')) : 0.5, max: t('maximum') !== '' ? parseFloat(t('maximum')) : Infinity});
  }
  return {controls, outputs, scripts, settings};
}
const midiToParam = v => v <= 64 ? v / 128 : 0.5 + (v - 64) / 126;
const fullToParam = f => f <= 8192 ? f / 16384 : 0.5 + (f - 8192) / 16382;

/* ---------- conectar una controladora ---------- */
async function attach(input, entry){
  const dev = {id: input.id, name: input.name, input, output: null, entry, conns: [], shared: null, settings: {}, msb: {}, lsb: {}, lastOut: new Map(), map: null, prefixes: [], evalIn: null, ok: false};
  dev.output = [...M.access.outputs.values()].find(o => o.name === input.name) || [...M.access.outputs.values()].find(o => normName(o.name).includes(normName(input.name).replace(/midi\d*$/, '').slice(0, 8)));
  dev.send = data => { if (!dev.output) return; const k = data.length === 3 && data[0] < 0xF0 ? (data[0] << 8) | data[1] : null; if (k != null){ if (dev.lastOut.get(k) === data[2]) return; dev.lastOut.set(k, data[2]); } try { dev.output.send(data); } catch(e){} };
  M.devices.push(dev);
  note('Controladora detectada: ' + input.name + ' → mapeo «' + entry.n + '»' + (LOCAL[entry.f] ? '' : ' (se descarga del proyecto Mixxx)'));
  try {
    const xml = await fetchText(entry.f), map = dev.map = parseXml(xml);
    dev.settings = map.settings;
    const files = ['common-controller-scripts.js', ...map.scripts.map(s => s.file).filter(f => f && f !== 'common-controller-scripts.js')];
    const codes = [];
    for (const f of files) codes.push('/* ' + f + ' */\n' + await fetchText(f));
    const {engine, midi} = makeHost(dev);
    const prefixes = map.scripts.map(s => s.prefix).filter(Boolean);
    // los scripts corren juntos en un mismo ámbito, con el "engine" y el "midi" de la Mesa Web
    const body = codes.join('\n;\n') + '\n;return function(__p){ return eval(__p); };';
    const fn = new Function('engine', 'midi', 'print', 'console', 'controller', body);
    dev.evalIn = fn(engine, midi, (...a) => console.log('[' + input.name + ']', ...a), console, {});
    dev.prefixes = prefixes.map(p => { try { return [p, dev.evalIn(p)]; } catch(e){ return [p, null]; } });
    // luces: cada salida del XML sigue a su control
    for (const o of map.outputs){
      const c = MW.ctl(o.group, o.key), f = v => { const on = v >= o.min && v <= o.max; const val = on ? o.on : o.off; if (val === 0xFF) return; dev.send([o.status, o.midino, val]); };
      c.outs.push(f); dev.conns.push([c, null, f]);
    }
    dev.fromScriptInit = true;
    for (const [, obj] of dev.prefixes) if (obj && typeof obj.init === 'function'){ try { obj.init(input.name, false); } catch(e){ console.error(e); note('El script de ' + input.name + ' falló al iniciar: ' + e.message, true); } }
    dev.fromScriptInit = false;
    for (const o of map.outputs){ const c = MW.ctl(o.group, o.key); const on = c.v >= o.min && c.v <= o.max; const val = on ? o.on : o.off; if (val !== 0xFF) dev.send([o.status, o.midino, val]); }
    dev.override = OVERRIDES[entry.f] ? OVERRIDES[entry.f](dev) : null;
    input.onmidimessage = e => onMessage(dev, e.data);
    dev.ok = true;
    note('✅ ' + input.name + ' lista: los controles, las perillas y las luces ya responden.');
  } catch(e){
    console.error(e); note('No pude cargar el mapeo de ' + input.name + ': ' + (e && e.message || e), true);
  }
  MW.emitMidi && MW.emitMidi();
}
function detach(dev){
  try { for (const [, obj] of dev.prefixes) if (obj && typeof obj.shutdown === 'function') obj.shutdown(); } catch(e){}
  for (const [c, fn, out] of dev.conns){ if (fn){ const i = c.conns.indexOf(fn); if (i >= 0) c.conns.splice(i, 1); } if (out){ const j = c.outs.indexOf(out); if (j >= 0) c.outs.splice(j, 1); } }
  for (const [, t] of dev.timers || []) (t[1] ? clearTimeout : clearInterval)(t[0]);
  try { dev.input.onmidimessage = null; } catch(e){}
  M.devices = M.devices.filter(d => d !== dev);
  note('Controladora desconectada: ' + dev.name);
}

function onMessage(dev, data){
  if (!data || !data.length) return;
  let st = data[0], d1 = data[1] | 0, d2 = data[2] | 0;
  if (st === 0xF0){ for (const [, obj] of dev.prefixes) if (obj && typeof obj.incomingData === 'function'){ try { obj.incomingData(data, data.length); } catch(e){} } return; }
  M.lastMsg = [st, d1, d2]; MW.midiActivity = performance.now();
  if (dev.override && dev.override(st, d1, d2)) return;
  let list = dev.map.controls.get((st << 8) | d1);
  if (!list && st >= 0x80 && st <= 0x8F){ st |= 0x10; d2 = 0; list = dev.map.controls.get((st << 8) | d1); }
  if (!list && (st & 0xF0) === 0xE0) list = dev.map.controls.get(st << 8);
  if (!list) return;
  for (const c of list){
    try { handle(dev, c, st, d1, d2, (data[0] & 0xF0) === 0x80); } catch(e){ console.error('[Mesa MIDI]', c.key, e); }
  }
}
function handle(dev, c, st, d1, d2, noteOff){
  const o = c.opts;
  if (o.has('script-binding')){
    const k = c.key, dot = k.lastIndexOf('.');
    const obj = dot > 0 ? dev.evalIn(k.slice(0, dot)) : null, fn = dot > 0 ? obj && obj[k.slice(dot + 1)] : dev.evalIn(k);
    if (typeof fn === 'function') fn.call(obj, st & 0x0F, d1, d2, st, c.group);
    return;
  }
  const ctl = MW.ctl(c.group, c.key), s = ctl.s;
  let v = d2;
  if (o.has('invert')) v = 127 - v;
  if (o.has('fourteen-bit-msb') || o.has('fourteen-bit-lsb')){
    const id = c.group + ',' + c.key;
    if (o.has('fourteen-bit-msb')) dev.msb[id] = v; else dev.lsb[id] = v;
    if (o.has('fourteen-bit-msb') && dev.lsb[id] == null) return;     // se aplica cuando llega la parte fina
    const full = ((dev.msb[id] || 0) << 7) | (dev.lsb[id] || 0);
    const p = fullToParam(full);
    if (ctl.soft && !dev.soft(ctl, p)) return;
    MW.setParameter(c.group, c.key, p, 'midi'); return;
  }
  if (o.has('selectknob') || s.t === 'rel'){
    let dlt = o.has('selectknob') ? (v < 64 ? v : v - 128) : v - 64;
    if (o.has('spread64')){ dlt = v - 64; dlt = Math.sign(dlt) * Math.pow(Math.abs(dlt), 1.5); }
    if (dlt) MW.setValue(c.group, c.key, dlt, 'midi');
    return;
  }
  if (o.has('rot64') || o.has('rot64inv') || o.has('rot64fast') || o.has('diff') || o.has('spread64')){
    let dlt = v - 64; if (o.has('rot64inv')) dlt = -dlt; if (o.has('rot64fast')) dlt *= 1.5; if (o.has('spread64')) dlt = Math.sign(dlt) * Math.pow(Math.abs(dlt), 1.5) / 4;
    const p = MW.clamp(MW.toParam(s, ctl.v) + dlt / 128, 0, 1); MW.setParameter(c.group, c.key, p, 'midi'); return;
  }
  if (s.t === 'push'){
    if (o.has('switch')){ MW.setValue(c.group, c.key, 1, 'midi'); MW.setValue(c.group, c.key, 0, 'midi'); return; }
    MW.setValue(c.group, c.key, noteOff ? 0 : (v > 0 ? 1 : 0), 'midi'); return;
  }
  if (s.t === 'toggle'){ if (o.has('switch') || (!noteOff && v > 0)) MW.setValue(c.group, c.key, ctl.v > 0 ? 0 : 1, 'midi'); return; }
  if (s.t === 'pot' || s.t === 'log'){ const p = midiToParam(v); if (ctl.soft && !dev.soft(ctl, p)) return; MW.setParameter(c.group, c.key, p, 'midi'); return; }
  MW.setValue(c.group, c.key, v, 'midi');
}

/* ---------- la DDJ-400 al estilo rekordbox ---------- */
// Mixxx usa la sección BEAT FX a su manera; aquí se comporta como en rekordbox:
// FX SELECT cambia el efecto, ◀ ▶ cambian los golpes, LEVEL/DEPTH es la mezcla, CH SELECT elige el canal.
// CUE/LOOP CALL ◀ ▶: con un loop activo lo achica o agranda; sin loop salta entre los memory cues de rekordbox.
const OVERRIDES = {
  'Pioneer-DDJ-400.midi.xml': dev => {
    const fx = () => MW.A.fx;
    const light = () => { const on = fx().state.enabled ? 0x7F : 0; dev.send([0x94, 0x47, on]); dev.send([0x94, 0x43, on]); };
    MW.onFxLight = light; light();
    return (st, d1, d2) => {
      if (st >= 0x97 && st <= 0x9A && d2){
        const side = st <= 0x98 ? 0 : 1, m = d1 < 0x08 ? 'hot' : d1 >= 0x60 && d1 < 0x68 ? 'loop' : d1 >= 0x20 && d1 < 0x28 ? 'jump' : d1 >= 0x30 && d1 < 0x38 ? 'smp' : null;
        if (m) MW.padModeHw[side] = m;
      }
      // BEAT SYNC como en rekordbox: un toque deja la bandeja sincronizada (y la apaga si ya estaba); mantenerlo la hace MASTER
      if ((st === 0x90 || st === 0x91) && (d1 === 0x58 || d1 === 0x5C)){
        const d = MW.decks[st & 0x0F]; if (!d || !d2) return true;
        if (d1 === 0x58) MW.setValue(d.g, 'sync_enabled', MW.getValue(d.g, 'sync_enabled') ? 0 : 1, 'midi');
        else { MW.setValue(d.g, 'sync_leader', 1, 'midi'); MW.setValue(d.g, 'sync_enabled', 1, 'midi'); }
        return true;
      }
      if (st === 0x94){
        if (d1 === 0x63 || d1 === 0x64){ if (d2) fx().next(d1 === 0x63 ? 1 : -1); return true; }
        if (d1 === 0x4A || d1 === 0x4B){ if (d2) fx().beat(d1 === 0x4B ? 1 : -1); return true; }
        if (d1 === 0x47 || d1 === 0x43){ if (d2){ if (d1 === 0x43) fx().toggle(false); else fx().toggle(); light(); } return true; }
        if (d1 === 0x10 || d1 === 0x11 || d1 === 0x14){ if (d2) fx().setTarget(d1 === 0x10 ? '1' : d1 === 0x11 ? '2' : 'm'); return true; }
      }
      if (st === 0xB4 && d1 === 0x02){ fx().setMix(d2 / 127); return true; }
      if (st === 0xB4 && d1 === 0x22) return true;
      if ((st === 0x90 || st === 0x91) && (d1 === 0x51 || d1 === 0x53)){
        const d = MW.decks[st & 0x0F]; if (!d2 || !d) return true;
        if (d.loop.on) MW.setValue(d.g, 'loop_scale', d1 === 0x51 ? 0.5 : 2);
        else d.memJump(d1 === 0x51 ? -1 : 1);
        return true;
      }
      return false;
    };
  },
};

/* ---------- inicio ---------- */
function scan(){
  if (!M.access) return;
  const ins = [...M.access.inputs.values()].filter(i => i.state === 'connected');
  for (const dev of M.devices.slice()) if (!ins.includes(dev.input)) detach(dev);
  for (const inp of ins){
    if (M.devices.some(d => d.input === inp)) continue;
    const e = findMapping(inp.name);
    if (e) attach(inp, e);
    else if (!M.unknown || !M.unknown.has(inp.id)){ (M.unknown = M.unknown || new Set()).add(inp.id); note('Hay un equipo MIDI («' + inp.name + '») sin mapeo conocido. Envíame su archivo de mapeo y lo agrego.', true); }
  }
  M.status = M.devices.length ? 'on' : 'none';
  MW.emitMidi && MW.emitMidi();
}
M.start = async function(){
  if (M.access) { scan(); return true; }
  if (!navigator.requestMIDIAccess){ M.status = 'nosupport'; note('Este navegador no tiene Web MIDI. Usa Chrome o Edge en un computador.', true); return false; }
  try { M.index = JSON.parse(await (await fetch(new URL('mixxx-index.json', BASE).href)).text()); } catch(e){ M.index = [{f:'Pioneer-DDJ-400.midi.xml', n:'Pioneer DDJ-400', s:['Pioneer-DDJ-400-script.js']}]; }
  try { M.access = await navigator.requestMIDIAccess({sysex: true}); M.sysex = true; }
  catch(e){
    try { M.access = await navigator.requestMIDIAccess({sysex: false}); M.sysex = false; }
    catch(e2){ M.status = 'denied'; note('El navegador no dio permiso para usar la controladora (MIDI). Actívalo en el candado de la barra de direcciones.', true); return false; }
  }
  M.access.onstatechange = () => setTimeout(scan, 200);
  scan();
  return true;
};
})();

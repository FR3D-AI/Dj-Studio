/* Mesa Web · núcleo
   - Controles con los mismos nombres que usa Mixxx ([Channel1] play, volume, hotcue_1_activate…), así los mapeos
     de controladoras publicados por Mixxx funcionan tal cual, sin mapear nada a mano.
   - Grafo de audio: 2 bandejas → trim → EQ aislador de 3 bandas → filtro → fader → crossfader → master,
     con escucha previa (CUE) para audífonos, efectos de ritmo y sampler. */
(function(){
'use strict';
const MW = window.MW = window.MW || {};
const BASE = (document.currentScript && document.currentScript.src) || location.href;

/* ---------- utilidades ---------- */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
MW.clamp = clamp;
MW.fmtTime = s => { if (!isFinite(s) || s < 0) s = 0; const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
// colores de hot cue de rekordbox (A–H) cuando la pista no trae color
MW.HOT_COLORS = ['#28e214', '#e44a3c', '#ffa000', '#e3e01e', '#00c0ff', '#2457ff', '#c33fff', '#ff4fb1'];

/* ---------- controles estilo Mixxx ---------- */
// tipo: push (vale 1 mientras se aprieta), toggle (cada toque alterna), pot (lineal), log (0..1..máx), num (valor tal cual), rel (relativo)
const SPEC = {};
const deckSpec = {
  play:'toggle', cue_default:'push', cue_gotoandplay:'push', cue_gotoandstop:'push', cue_set:'push', cue_goto:'push', cue_preview:'push', cue_play:'push',
  start_play:'push', start_stop:'push', start:'push', end:'push', stop:'push', eject:'push', LoadSelectedTrack:'push',
  reverse:'push', reverseroll:'push', back:'push', fwd:'push',
  pfl:'toggle', keylock:'toggle', quantize:'toggle', slip_enabled:'toggle', mute:'toggle', sync_enabled:'toggle', sync_leader:'toggle', sync_master:'toggle', repeat:'toggle',
  beatsync:'push', beatsync_tempo:'push', beatsync_phase:'push', bpm_tap:'push', rate_temp_up:'push', rate_temp_down:'push', rate_perm_up:'push', rate_perm_down:'push',
  rate_perm_up_small:'push', rate_perm_down_small:'push', rate_temp_up_small:'push', rate_temp_down_small:'push',
  loop_in:'push', loop_out:'push', reloop_toggle:'push', reloop_exit:'push', reloop_andstop:'push', loop_halve:'push', loop_double:'push',
  beatjump_forward:'push', beatjump_backward:'push', beatloop_activate:'push', loop_move_forward:'push', loop_move_backward:'push',
  volume:{t:'pot', min:0, max:1, def:1}, pregain:{t:'log', max:4, def:1}, rate:{t:'pot', min:-1, max:1, def:0}, rateRange:{t:'num', def:0.10},
  filterLow:{t:'log', max:2, def:1}, filterMid:{t:'log', max:2, def:1}, filterHigh:{t:'log', max:2, def:1},
  filterLowKill:'toggle', filterMidKill:'toggle', filterHighKill:'toggle',
  orientation:{t:'num', def:1}, quantize:{t:'toggle', def:1}, keylock:{t:'toggle', def:1}, jog:'rel', wheel:'rel', scratch2:{t:'num', def:0}, scratch2_enable:'toggle',
  beatjump_size:{t:'num', def:4}, beatloop_size:{t:'num', def:4}, loop_scale:{t:'num', def:1},
  playposition:{t:'pot', min:0, max:1, def:0},
};
const masterSpec = { crossfader:{t:'pot', min:-1, max:1, def:0}, headGain:{t:'log', max:5, def:1}, headMix:{t:'pot', min:-1, max:1, def:-1}, gain:{t:'log', max:5, def:1}, balance:{t:'pot', min:-1, max:1, def:0}, headVolume:{t:'log', max:5, def:1}, volume:{t:'log', max:5, def:1} };
const eqSpec = { parameter1:{t:'log', max:2, def:1}, parameter2:{t:'log', max:2, def:1}, parameter3:{t:'log', max:2, def:1}, button_parameter1:'toggle', button_parameter2:'toggle', button_parameter3:'toggle', enabled:{t:'num', def:1} };
const qfxSpec = { super1:{t:'pot', min:0, max:1, def:0.5}, enabled:{t:'toggle', def:1} };
const fxUnitSpec = { mix:{t:'pot', min:0, max:1, def:0.5}, super1:{t:'pot', min:0, max:1, def:0.5}, focused_effect:{t:'num', def:1}, show_focus:{t:'num', def:0}, enabled:{t:'toggle', def:1},
  'group_[Channel1]_enable':'toggle', 'group_[Channel2]_enable':'toggle', 'group_[Master]_enable':'toggle', 'group_[Headphone]_enable':'toggle', next_chain:'push', prev_chain:'push' };
const fxSpec = { enabled:'toggle', next_effect:'push', prev_effect:'push', effect_selector:'rel', meta:{t:'pot', min:0, max:1, def:0.5}, parameter1:{t:'pot', min:0, max:1, def:0.5} };
const libSpec = { MoveVertical:'rel', MoveUp:'push', MoveDown:'push', MoveFocusForward:'push', MoveFocusBackward:'push', MoveFocus:'rel', GoToItem:'push', ScrollVertical:'rel', MoveLeft:'push', MoveRight:'push', MoveHorizontal:'rel' };
const playlistSpec = { SelectNextTrack:'push', SelectPrevTrack:'push', SelectTrackKnob:'rel', LoadSelectedIntoFirstStopped:'push', SelectNextPlaylist:'push', SelectPrevPlaylist:'push', SelectPlaylist:'rel', ToggleSelectedSidebarItem:'push' };
for (let i = 1; i <= 8; i++){ ['activate','clear','set','goto','gotoandplay','gotoandstop','gotoandloop'].forEach(k => deckSpec['hotcue_' + i + '_' + k] = 'push'); }
['0.03125','0.0625','0.125','0.25','0.5','1','2','4','8','16','32','64'].forEach(s => { deckSpec['beatloop_' + s + '_toggle'] = 'push'; deckSpec['beatloop_' + s + '_activate'] = 'push'; deckSpec['beatlooproll_' + s + '_activate'] = 'push'; deckSpec['beatjump_' + s + '_forward'] = 'push'; deckSpec['beatjump_' + s + '_backward'] = 'push'; });
function specFor(group, key){
  let s;
  if (/^\[(Channel|Sampler|PreviewDeck)\d+\]$/.test(group)) s = deckSpec[key];
  else if (group === '[Master]' || group === '[Mixer]') s = masterSpec[key];
  else if (/^\[EqualizerRack1_/.test(group)) s = eqSpec[key];
  else if (/^\[QuickEffectRack1_/.test(group)) s = qfxSpec[key];
  else if (/^\[EffectRack1_EffectUnit\d+\]$/.test(group)) s = fxUnitSpec[key];
  else if (/^\[EffectRack1_EffectUnit\d+_Effect\d+\]$/.test(group)) s = fxSpec[key];
  else if (group === '[Library]') s = libSpec[key];
  else if (group === '[Playlist]') s = playlistSpec[key];
  if (!s) return {t:'num', def:0};
  return typeof s === 'string' ? {t:s, def:0} : s;
}
const CO = new Map();
MW.CO = CO;
function ctl(group, key){
  const id = group + ',' + key; let c = CO.get(id);
  if (!c){ const s = specFor(group, key); c = {id, group, key, s, v: s.def || 0, conns: [], outs: [], soft:false, softOk:true}; CO.set(id, c); }
  return c;
}
MW.ctl = ctl;
// parámetro (0..1, como la perilla) ↔ valor
function toValue(s, p){
  p = clamp(p, 0, 1);
  if (s.t === 'pot') return s.min + p * (s.max - s.min);
  if (s.t === 'log'){
    if (p <= 0) return 0;
    if (p <= 0.5){ const db = -26 * (1 - p / 0.5); return p < 0.012 ? 0 : Math.pow(10, db / 20); }
    return Math.pow(10, ((p - 0.5) / 0.5) * (20 * Math.log10(s.max)) / 20);
  }
  if (s.t === 'push' || s.t === 'toggle') return p > 0 ? 1 : 0;
  return p;
}
function toParam(s, v){
  if (s.t === 'pot') return (v - s.min) / ((s.max - s.min) || 1);
  if (s.t === 'log'){
    if (v <= 0) return 0;
    const db = 20 * Math.log10(v);
    if (db <= 0) return clamp(0.5 * (1 + db / 26), 0.012, 0.5);
    return clamp(0.5 + 0.5 * db / (20 * Math.log10(s.max)), 0.5, 1);
  }
  return v;
}
MW.toValue = toValue; MW.toParam = toParam;
const handlers = [];   // acciones internas: (c, value, prev) → void
MW.onControl = fn => handlers.push(fn);
let uiDirty = new Set();
MW.uiDirty = () => { const d = uiDirty; uiDirty = new Set(); return d; };
function setValue(group, key, v, from){
  const c = ctl(group, key);
  if (typeof v === 'boolean') v = v ? 1 : 0;
  v = +v; if (!isFinite(v)) return;
  const prev = c.v;
  const ev = c.s.t === 'push' || c.s.t === 'rel';   // los botones y relativos siempre disparan
  if (!ev && prev === v) return;
  if (c.s.t !== 'rel') c.v = v;
  for (const h of handlers){ try { h(c, v, prev, from); } catch(e){ console.error('[Mesa]', e); } }
  if (c.s.t === 'rel') return;
  emit(c);
}
function emit(c){
  uiDirty.add(c.id);
  for (const fn of c.conns.slice()){ try { fn(c.v, c.group, c.key); } catch(e){ console.error('[Mesa script]', e); } }
  for (const o of c.outs){ try { o(c.v); } catch(e){} }
}
// para valores que calcula el motor (indicadores, posición…): no pasan por las acciones
function setState(group, key, v){ const c = ctl(group, key); v = +v; if (c.v === v) return; c.v = v; emit(c); }
MW.setValue = setValue; MW.setState = setState;
MW.getValue = (g, k) => ctl(g, k).v;
MW.setParameter = (g, k, p, from) => { const c = ctl(g, k); setValue(g, k, toValue(c.s, p), from); };
MW.getParameter = (g, k) => { const c = ctl(g, k); return toParam(c.s, c.v); };
MW.reset = (g, k) => { const c = ctl(g, k); setValue(g, k, c.s.def || 0); };

/* ---------- grilla de beats (TEMPO de rekordbox) ---------- */
// segmentos [{t (s), bpm, beat (número de golpe en el compás, 1–4)}]; permite tempos variables
function mkGrid(segs){
  if (!segs || !segs.length) return null;
  const s = segs.map(x => ({t:+x.t, bpm:+x.bpm, bar: +(x.bar || 1)})).filter(x => x.bpm > 0).sort((a, b) => a.t - b.t);
  if (!s.length) return null;
  let B = 0;
  for (let i = 0; i < s.length; i++){ s[i].B = B; if (i + 1 < s.length) B += (s[i + 1].t - s[i].t) * s[i].bpm / 60; }
  return s;
}
MW.mkGrid = mkGrid;
function segAt(g, t){ let lo = 0, hi = g.length - 1; if (t <= g[0].t) return g[0]; while (lo < hi){ const m = (lo + hi + 1) >> 1; if (g[m].t <= t) lo = m; else hi = m - 1; } return g[lo]; }
MW.beatAt = (g, t) => { const s = segAt(g, t); return s.B + (t - s.t) * s.bpm / 60; };
MW.timeOfBeat = (g, b) => { let s = g[0]; for (const x of g) if (x.B <= b) s = x; return s.t + (b - s.B) * 60 / s.bpm; };
MW.bpmAt = (g, t) => segAt(g, t).bpm;
// el golpe 1 del compás: rekordbox dice en qué golpe del compás cae cada punto de tempo
MW.isDownbeat = (g, b) => { const s = segAt(g, MW.timeOfBeat(g, b)); const k = Math.round(b - s.B); return ((k + (s.bar - 1)) % 4 + 4) % 4 === 0; };

/* ---------- audio ---------- */
const A = MW.A = {ctx:null, ready:false};
MW.decks = []; MW.samplers = [];
MW.settings = {xfCurve:'suave', pitchUp:false, hpMode:'auto', autoOut:true, bpmRange:3, gridMode:'fija'};
// pitch como Pioneer/rekordbox: fader hacia abajo = más rápido (pitchUp = true lo invierte)
const pitchSign = () => MW.settings.pitchUp ? 1 : -1;
MW.pitchSign = pitchSign;
MW.analyzeOpts = () => { const r = (MW.BPM_RANGES || [[88, 175]])[MW.settings.bpmRange] || [88, 175]; return {min: r[0], max: r[1], dynamic: MW.settings.gridMode === 'dinamica'}; };
try { Object.assign(MW.settings, JSON.parse(localStorage.getItem('mesa-ajustes') || '{}')); } catch(e){}
MW.saveSettings = () => { try { localStorage.setItem('mesa-ajustes', JSON.stringify(MW.settings)); } catch(e){} };

function biq(ctx, type, f, q){ const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q == null ? Math.SQRT1_2 : q; return b; }
function chain(...n){ for (let i = 0; i + 1 < n.length; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }

MW.initAudio = async function(ctx, hostOut){
  if (A.ready) return;
  A.ctx = ctx;
  await ctx.audioWorklet.addModule(new URL('mesa-worklet.js', BASE));
  // suma de canales con 3 dB de margen → nivel master → limitador al final (techo −2 dB: la transmisión Opus no recorta)
  A.master = ctx.createGain(); A.master.gain.value = 0.708;
  A.masterLvl = ctx.createGain();
  A.limiter = ctx.createDynamicsCompressor(); A.limiter.threshold.value = -3; A.limiter.knee.value = 2; A.limiter.ratio.value = 20; A.limiter.attack.value = 0.001; A.limiter.release.value = 0.15;
  A.masterOut = ctx.createGain();
  chain(A.master, A.masterLvl, A.limiter, A.masterOut);
  A.masterAn = ctx.createAnalyser(); A.masterAn.fftSize = 512; A.masterOut.connect(A.masterAn);
  A.hostOut = hostOut;             // analizador de la sala: luces, baile y transmisión
  // audífonos: CUE de las bandejas + master, según la perilla MIX
  A.cueBus = ctx.createGain(); A.hpCue = ctx.createGain(); A.hpMst = ctx.createGain(); A.hp = ctx.createGain();
  A.cueBus.connect(A.hpCue); A.masterOut.connect(A.hpMst); A.hpCue.connect(A.hp); A.hpMst.connect(A.hp);
  A.fx = makeFxUnit(ctx);
  for (let i = 0; i < 2; i++) MW.decks.push(new Deck(ctx, i + 1));
  makeSamplers(ctx);
  A.ready = true;
  route();
  applyMaster();
};
// a dónde sale cada cosa: master a la sala (y a los parlantes), audífonos por la DDJ (canales 3-4) o por otra salida
A.on = false; A.hpEl = null; A.hpDest = null; A.merger = null; A.sink = '';
function route(){
  const ctx = A.ctx; if (!ctx) return;
  try { A.masterOut.disconnect(A.hostOut); } catch(e){}
  try { A.hp.disconnect(); } catch(e){}
  if (A.merger){ try { A.masterOut.disconnect(A.merger); } catch(e){} try { A.merger.disconnect(); } catch(e){} A.merger = null; }
  try { A.masterOut.disconnect(ctx.destination); } catch(e){}
  if (!A.on) return;
  if (A.feed !== false) A.masterOut.connect(A.hostOut);
  const four = MW.settings.hpMode !== 'otra' && ctx.destination.maxChannelCount >= 4;
  A.fourCh = four;
  if (four){
    ctx.destination.channelCount = 4; ctx.destination.channelCountMode = 'explicit'; ctx.destination.channelInterpretation = 'discrete';
    const m = A.merger = ctx.createChannelMerger(4), sp1 = ctx.createChannelSplitter(2), sp2 = ctx.createChannelSplitter(2);
    A.masterOut.connect(sp1); A.hp.connect(sp2);
    sp1.connect(m, 0, 0); sp1.connect(m, 1, 1); sp2.connect(m, 0, 2); sp2.connect(m, 1, 3);
    m.connect(ctx.destination);
  } else {
    try { ctx.destination.channelCount = 2; ctx.destination.channelInterpretation = 'speakers'; } catch(e){}
    A.masterOut.connect(ctx.destination);
    if (MW.settings.hpDev){
      if (!A.hpDest){ A.hpDest = ctx.createMediaStreamDestination(); A.hpEl = new Audio(); A.hpEl.srcObject = A.hpDest.stream; }
      A.hp.connect(A.hpDest);
      if (A.hpEl.setSinkId) A.hpEl.setSinkId(MW.settings.hpDev).catch(() => {});
      A.hpEl.play().catch(() => {});
    } else if (A.hpEl) A.hpEl.pause();
  }
}
MW.route = route;
MW.setOutput = async function(deviceId){
  const ctx = A.ctx; if (!ctx || !ctx.setSinkId) return false;
  try { await ctx.setSinkId(deviceId || ''); A.sink = deviceId || ''; route(); return true; } catch(e){ return false; }
};
MW.setActive = on => { A.on = !!on; route(); };
MW.feedRoom = on => { if (A.feed === !!on) return; A.feed = !!on; route(); };
function applyMaster(){
  if (!A.ready) return;
  const mix = MW.getValue('[Master]', 'headMix');         // -1 = solo CUE, 1 = solo master
  const a = (mix + 1) / 2;
  A.hpCue.gain.value = Math.cos(a * Math.PI / 2); A.hpMst.gain.value = Math.sin(a * Math.PI / 2);
  A.hp.gain.value = MW.getValue('[Master]', 'headGain');
  A.masterLvl.gain.value = MW.getValue('[Master]', 'gain');
  for (const d of MW.decks) d.applyFader();
}

/* ---------- bandeja ---------- */
function Deck(ctx, n){
  const d = this;
  d.n = n; d.g = '[Channel' + n + ']';
  d.node = new AudioWorkletNode(ctx, 'mesa-deck', {numberOfInputs:0, numberOfOutputs:1, outputChannelCount:[2]});
  d.trim = ctx.createGain();
  // aislador de 3 bandas (como el modo ISO de rekordbox): cada banda se puede apagar del todo
  const m1 = biq(ctx, 'highpass', 250), m2 = biq(ctx, 'highpass', 250), m3 = biq(ctx, 'lowpass', 2500), m4 = biq(ctx, 'lowpass', 2500);
  chain(m1, m2, m3, m4);
  d.gLo = ctx.createGain(); d.gMid = ctx.createGain(); d.gHi = ctx.createGain();
  d.eqSum = ctx.createGain();
  d.node.connect(d.trim);
  const loA = biq(ctx, 'lowpass', 250), loB = biq(ctx, 'lowpass', 250), hiA = biq(ctx, 'highpass', 2500), hiB = biq(ctx, 'highpass', 2500);
  d.trim.connect(loA); chain(loA, loB, d.gLo, d.eqSum);
  d.trim.connect(hiA); chain(hiA, hiB, d.gHi, d.eqSum);
  d.trim.connect(m1); chain(m4, d.gMid, d.eqSum);
  // filtro (perilla FILTER: izquierda pasa-bajos, derecha pasa-altos)
  d.fLP = biq(ctx, 'lowpass', 22000, 0.9); d.fHP = biq(ctx, 'highpass', 10, 0.9);
  chain(d.eqSum, d.fLP, d.fHP);
  d.pre = d.fHP;
  d.an = ctx.createAnalyser(); d.an.fftSize = 256; d.anBuf = new Float32Array(256); d.pre.connect(d.an);
  d.cue = ctx.createGain(); d.cue.gain.value = 0; d.pre.connect(d.cue); d.cue.connect(A.cueBus);
  d.fader = ctx.createGain(); d.pre.connect(d.fader);
  d.dry = ctx.createGain(); d.send = ctx.createGain(); d.send.gain.value = 0;
  d.xf = ctx.createGain();
  d.fader.connect(d.dry); d.dry.connect(d.xf); d.fader.connect(d.send); d.send.connect(A.fx.input);
  d.xf.connect(A.master);
  d.track = null; d.L = null; d.dur = 0; d.sr = ctx.sampleRate;
  d.rep = {pos:0, t:0, v:0, playing:false};
  d.cuePt = 0; d.hot = new Array(8).fill(null); d.mem = [];
  d.loop = {on:false, a:0, b:0, beats:0}; d.grid = null;
  d.cueHeld = false; d.cuePreview = false; d.hotHeld = -1; d.playedDuringCue = false;
  d.scratching = false; d.bendV = 0; d.jogAcc = 0; d.loading = false;
  d.node.port.onmessage = e => { const m = e.data; if (m.end){ d.onEnd(); return; } d.rep = m; };
  d.applyEq(); d.applyFilter(); d.applyFader();
  d.post({t:'keylock', on: MW.getValue(d.g, 'keylock') > 0});   // Master Tempo encendido: el tono no cambia al sincronizar
}
Deck.prototype = {
  get loaded(){ return !!this.L; },
  pos(){ // segundos, estimado entre reportes del hilo de audio
    const r = this.rep; if (!this.L) return 0;
    return (r.pos + Math.max(0, A.ctx.currentTime - r.t) * r.v * this.sr) / this.sr;
  },
  playing(){ return MW.getValue(this.g, 'play') > 0; },
  tempo(){ const r = MW.getValue(this.g, 'rate') * MW.getValue(this.g, 'rateRange') * pitchSign(); return 1 + r; },
  baseBpm(t){ return this.grid ? MW.bpmAt(this.grid, t == null ? this.pos() : t) : (this.track && this.track.bpm) || 0; },
  bpm(){ return this.baseBpm() * this.tempo(); },
  post(m, tr){ this.node.port.postMessage(m, tr || []); },
  seek(t){ t = clamp(t, 0, Math.max(0, this.dur - 0.01)); this.post({t:'seek', pos: t * this.sr}); this.rep = {pos: t * this.sr, t: A.ctx.currentTime, v: this.rep.v, playing: this.rep.playing}; },
  setPlay(on){ this.post({t:'play', on: !!on}); this.rep.playing = !!on; },
  applyRate(){ const bend = this.bendV; this.post({t:'rate', r: this.tempo()}); this.post({t:'bend', v: bend}); MW.setState(this.g, 'bpm', this.bpm()); },
  applyEq(){
    const g = '[EqualizerRack1_' + this.g + '_Effect1]';
    const kill = k => MW.getValue(this.g, k) || MW.getValue(g, 'button_' + ({filterLowKill:'parameter1', filterMidKill:'parameter2', filterHighKill:'parameter3'})[k]);
    this.gLo.gain.value = kill('filterLowKill') ? 0 : MW.getValue(g, 'parameter1');
    this.gMid.gain.value = kill('filterMidKill') ? 0 : MW.getValue(g, 'parameter2');
    this.gHi.gain.value = kill('filterHighKill') ? 0 : MW.getValue(g, 'parameter3');
    this.trim.gain.value = MW.getValue(this.g, 'pregain');
  },
  applyFilter(){
    const q = '[QuickEffectRack1_' + this.g + ']', v = MW.getValue(q, 'super1'), on = MW.getValue(q, 'enabled');
    const t = A.ctx.currentTime;
    if (!on || Math.abs(v - 0.5) < 0.02){ this.fLP.frequency.setTargetAtTime(22000, t, 0.01); this.fHP.frequency.setTargetAtTime(10, t, 0.01); this.fLP.Q.value = this.fHP.Q.value = 0.7; return; }
    if (v < 0.5){ const k = (0.5 - v) / 0.5; this.fLP.frequency.setTargetAtTime(22000 * Math.pow(60 / 22000, k), t, 0.01); this.fHP.frequency.setTargetAtTime(10, t, 0.01); this.fLP.Q.value = 0.7 + k * 3; }
    else { const k = (v - 0.5) / 0.5; this.fHP.frequency.setTargetAtTime(10 * Math.pow(12000 / 10, k), t, 0.01); this.fLP.frequency.setTargetAtTime(22000, t, 0.01); this.fHP.Q.value = 0.7 + k * 3; }
  },
  applyFader(){
    const v = MW.getValue(this.g, 'volume');
    this.fader.gain.value = v <= 0 ? 0 : Math.pow(v, 2.2) * 1.0;
    const x = MW.getValue('[Master]', 'crossfader'), o = MW.getValue(this.g, 'orientation'); // 0 izquierda, 1 centro, 2 derecha
    let g = 1;
    if (o !== 1){
      const side = o === 0 ? -x : x;            // -1 = todo a mi lado, 1 = todo al otro
      const p = (side + 1) / 2;
      g = MW.settings.xfCurve === 'corte' ? (p > 0.96 ? 0 : 1) : Math.min(1, Math.cos(clamp(p, 0, 1) * Math.PI / 2) * Math.SQRT2);
    }
    if (MW.getValue(this.g, 'mute')) g = 0;
    this.xf.gain.setTargetAtTime(g, A.ctx.currentTime, 0.004);
    this.cue.gain.value = MW.getValue(this.g, 'pfl') ? 1 : 0;
  },
  vu(){
    this.an.getFloatTimeDomainData(this.anBuf); let p = 0;
    for (let i = 0; i < this.anBuf.length; i++){ const a = Math.abs(this.anBuf[i]); if (a > p) p = a; }
    return p;
  },
  quantOn(){ return MW.getValue(this.g, 'quantize') > 0 && !!this.grid; },
  nearestBeatT(t){ const b = Math.round(MW.beatAt(this.grid, t)); return MW.timeOfBeat(this.grid, b); },
  q(t){ return this.quantOn() ? this.nearestBeatT(t) : t; },
  // salto conservando el compás: con QUANTIZE la pista sigue "en el golpe"
  jumpTo(t){
    if (this.quantOn() && this.playing()){ const p = this.pos(); t += p - this.nearestBeatT(p); }
    this.seek(t);
  },
  beatLen(){ return 60 / (this.baseBpm() || 120); },
  double(o){
    const go = () => { const p = o.pos(); this.seek(p); MW.setValue(this.g, 'rate', MW.getValue(o.g, 'rate')); MW.setValue(this.g, 'rateRange', MW.getValue(o.g, 'rateRange')); if (o.playing()){ this.seek(o.pos()); MW.setValue(this.g, 'play', 1); } };
    this.afterLoad = go; this.load(o.track);
  },
  async load(track){
    const L = MW.lib;
    if (!track) return;
    const myReq = this.loadReq = (this.loadReq || 0) + 1;
    const file = await L.fileFor(track);
    if (!file){ MW.toast('No encuentro el archivo de «' + track.title + '». Elige la carpeta donde está tu música.', true); return; }
    this.loading = true; MW.setState(this.g, 'loading', 1);
    try {
      const ab = await file.arrayBuffer();
      const buf = await A.ctx.decodeAudioData(ab);
      const Lc = new Float32Array(buf.getChannelData(0));
      const Rc = buf.numberOfChannels > 1 ? new Float32Array(buf.getChannelData(1)) : null;
      const wave = await MW.analyseWave(Lc, Rc || Lc, buf.sampleRate);
      // grilla, cues y BPM: de rekordbox, o de lo que guardó la Mesa Web la última vez, o se mide ahora
      if (!track.size) track.size = file.size;
      const saved = await L.getSaved(track);
      let an = null;
      if (!(track.grid && track.grid.length) && !(saved && saved.grid)){
        MW.toast('Analizando «' + track.title + '» (BPM y grilla)…');
        an = await MW.analyzeBeats(Lc, Rc || Lc, buf.sampleRate, MW.analyzeOpts()).catch(e => { console.error(e); return null; });
      }
      if (myReq !== this.loadReq) return;      // mientras tanto pidieron otra pista
      this.stop(true);
      this.track = track; this.dur = buf.duration; this.sr = buf.sampleRate;
      this.wave = wave;
      this.L = true;
      this.post({t:'load', L: Lc, R: Rc}, Rc ? [Lc.buffer, Rc.buffer] : [Lc.buffer]);
      this.rep = {pos:0, t:A.ctx.currentTime, v:0, playing:false};
      // si la volviste a analizar aquí, manda ese análisis; si no, el de rekordbox
      this.regrid = !!(saved && saved.regrid);
      const segs = (this.regrid && saved.grid) || (track.grid && track.grid.length ? track.grid : (saved && saved.grid) || (an && an.grid));
      track.dur = track.dur || buf.duration;
      if (an){ track.bpm = an.bpm; }
      this.grid = mkGrid(segs);
      this.hot = new Array(8).fill(null); this.mem = [];
      // los cues guardados aquí solo mandan si los editaste en la Mesa Web; si no, los de rekordbox
      this.cuesEdited = !!(saved && saved.cuesEdited);
      const cues = (this.cuesEdited && saved.cues) || (track.cues && track.cues.length ? track.cues : (saved && saved.cuesEdited ? saved.cues : null)) || [];
      for (const c of cues){ if (c.num >= 0 && c.num < 8) this.hot[c.num] = {...c}; else this.mem.push({...c}); }
      this.mem.sort((a, b) => a.t - b.t);
        this.cuePt = saved && saved.cuePt != null && this.cuesEdited ? saved.cuePt : (this.mem.length ? this.mem[0].t : (this.grid ? Math.max(0, MW.timeOfBeat(this.grid, Math.ceil(MW.beatAt(this.grid, 0)))) : 0));
      this.loop = {on:false, a:0, b:0, beats:0};
      this.seek(this.cuePt);
      this.post({t:'loop', on:false});
      MW.setState(this.g, 'track_loaded', 1); MW.setState(this.g, 'duration', this.dur);
      MW.setState(this.g, 'track_samples', this.dur * this.sr * 2); MW.setState(this.g, 'track_samplerate', this.sr);
      MW.setState(this.g, 'loop_enabled', 0);
      for (let i = 0; i < 8; i++) MW.setState(this.g, 'hotcue_' + (i + 1) + '_enabled', this.hot[i] ? 1 : 0);
      this.applyRate(); this.indicators();
      L.markPlayed(track);
      if (an) this.save();
      const nh = this.hot.filter(Boolean).length, nm = this.mem.length;
      if (track.src === 'xml') MW.toast('«' + track.title + '»: ' + (nh || nm ? nh + ' hot cues y ' + nm + ' memory cues de rekordbox' : 'esta canción no tiene cues guardados en el XML de rekordbox') + '.');
      else if (MW.lib.tracks.some(t => t.src === 'xml')) MW.toast('«' + track.title + '» no está en tu XML de rekordbox: por eso no trae cues. Revisa que el nombre del archivo sea el mismo.', true);
      MW.emitDeck(this); MW.lib.changed();
      if (this.afterLoad){ const f = this.afterLoad; this.afterLoad = null; f(); }
    } catch(e){
      console.error(e); MW.toast('No pude abrir «' + track.title + '»: ' + (e && e.message || e), true);
    } finally { this.loading = false; MW.setState(this.g, 'loading', 0); }
  },
  // volver a analizar la pista cargada (con el rango de BPM y el modo de grilla de Ajustes)
  async reanalyze(){
    const track = this.track; if (!track) return;
    const file = await MW.lib.fileFor(track); if (!file) return;
    MW.toast('Analizando «' + track.title + '»…');
    const buf = await A.ctx.decodeAudioData(await file.arrayBuffer());
    const an = await MW.analyzeBeats(buf.getChannelData(0), buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0), buf.sampleRate, MW.analyzeOpts());
    if (!an || this.track !== track){ if (!an) MW.toast('No pude encontrar un pulso claro en esta pista.', true); return; }
    this.regrid = true; this.grid = mkGrid(an.grid); track.bpm = an.bpm;
    this.applyRate(); this.save(); MW.emitDeck(this); MW.lib.changed();
    MW.toast('«' + track.title + '»: ' + an.bpm.toFixed(2) + ' BPM' + (an.grid.length > 1 ? ' (grilla dinámica, ' + an.grid.length + ' tramos)' : '') + '.');
  },
  editCues(){ this.cuesEdited = true; this.save(); },
  save(){ if (this.track) MW.lib.save(this.track, {dur: this.dur, regrid: !!this.regrid, cuesEdited: !!this.cuesEdited, grid: this.grid ? this.grid.map(s => ({t:s.t, bpm:s.bpm, bar:s.bar})) : null, cues: [...this.hot.map((c, i) => c && {...c, num:i}).filter(Boolean), ...this.mem.map(c => ({...c, num:-1}))], cuePt: this.cuePt}); },
  stop(unload){
    MW.setValue(this.g, 'play', 0);
    if (unload){ this.post({t:'unload'}); this.L = null; this.track = null; this.wave = null; this.grid = null; this.dur = 0; MW.setState(this.g, 'track_loaded', 0); MW.emitDeck(this); }
  },
  onEnd(){ MW.setState(this.g, 'play', 0); this.rep.playing = false; this.indicators(); },
  setLoop(a, b, on, beats){
    this.loop = {on, a, b, beats: beats || 0};
    this.post({t:'loop', on, a: a * this.sr, b: b * this.sr, jump: on});
    MW.setState(this.g, 'loop_enabled', on ? 1 : 0);
    MW.setState(this.g, 'loop_start_position', a * this.sr * 2); MW.setState(this.g, 'loop_end_position', b * this.sr * 2);
    this.loopIndicators();
  },
  loopIndicators(){
    for (const s of ['0.03125','0.0625','0.125','0.25','0.5','1','2','4','8','16','32','64']) MW.setState(this.g, 'beatloop_' + s + '_enabled', this.loop.on && Math.abs(this.loop.beats - +s) < 1e-6 ? 1 : 0);
  },
  beatLoop(beats, toggle){
    if (!this.L) return;
    if (toggle && this.loop.on && Math.abs(this.loop.beats - beats) < 1e-6){ this.setLoop(this.loop.a, this.loop.b, false, beats); return; }
    const p = this.pos();
    let a;
    if (this.loop.on && this.loop.beats){ a = this.loop.a; }
    else if (this.grid){ const b = MW.beatAt(this.grid, p); a = MW.timeOfBeat(this.grid, MW.getValue(this.g, 'quantize') ? Math.floor(b + 1e-3) : b); }
    else a = p;
    const b = this.grid ? MW.timeOfBeat(this.grid, MW.beatAt(this.grid, a) + beats) : a + beats * 0.5;
    this.setLoop(a, b, true, beats);
    MW.setState(this.g, 'beatloop_size', beats);
  },
  indicators(){
    const loaded = !!this.L, pl = this.playing(), at = Math.abs(this.pos() - this.cuePt) < 0.02;
    MW.setState(this.g, 'play_indicator', pl ? 1 : (loaded && MW.blink ? 1 : 0));
    MW.setState(this.g, 'cue_indicator', !loaded ? 0 : pl ? (this.cueHeld ? 1 : 0) : (at ? 1 : (MW.blink ? 1 : 0)));
    MW.setState(this.g, 'cue_point', this.cuePt * this.sr * 2);
  },
  // CUE al estilo CDJ: en pausa fija el punto; si ya está ahí, suena mientras se mantiene
  cueButton(down){
    if (!this.L) return;
    if (down){
      this.cueHeld = true; this.playedDuringCue = false;
      if (this.playing()){ MW.setValue(this.g, 'play', 0); this.seek(this.cuePt); }
      else if (Math.abs(this.pos() - this.cuePt) < 0.02){ this.cuePreview = true; this.setPlay(true); MW.setState(this.g, 'play', 1); }
      else { this.cuePt = this.q(this.pos()); this.seek(this.cuePt); this.editCues(); }
    } else {
      this.cueHeld = false;
      if (this.cuePreview){ this.cuePreview = false; if (!this.playedDuringCue){ MW.setValue(this.g, 'play', 0); this.seek(this.cuePt); } }
    }
    this.indicators();
  },
  hotcue(i, down, mode){
    if (!this.L) return;
    const c = this.hot[i];
    if (mode === 'clear'){ if (down && c){ this.hot[i] = null; MW.setState(this.g, 'hotcue_' + (i + 1) + '_enabled', 0); this.editCues(); MW.emitDeck(this); } return; }
    if (!down){
      if (this.hotHeld === i && !this.playedDuringCue && this.hotPreview){ MW.setValue(this.g, 'play', 0); this.seek(c ? c.t : this.pos()); }
      this.hotHeld = -1; this.hotPreview = false; return;
    }
    if (!c || mode === 'set'){
      this.hot[i] = {t: this.q(this.pos()), num:i, name:'', color: MW.HOT_COLORS[i], type: this.loop.on ? 4 : 0, end: this.loop.on ? this.loop.b : undefined};
      if (this.loop.on) this.hot[i].t = this.loop.a;
      MW.setState(this.g, 'hotcue_' + (i + 1) + '_enabled', 1); this.editCues(); MW.emitDeck(this); return;
    }
    this.hotHeld = i; this.playedDuringCue = false;
    if (c.type === 4 && c.end > c.t){ this.seek(c.t); this.setLoop(c.t, c.end, true, this.grid ? Math.round((MW.beatAt(this.grid, c.end) - MW.beatAt(this.grid, c.t)) * 1000) / 1000 : 0); }
    else this.jumpTo(c.t);
    if (!this.playing()){ this.hotPreview = false; MW.setValue(this.g, 'play', 1); }
  },
  memJump(dir){
    if (!this.L || !this.mem.length) return;
    const p = this.pos();
    const list = dir > 0 ? this.mem.filter(c => c.t > p + 0.05) : this.mem.filter(c => c.t < p - 0.3).reverse();
    const c = list[0] || (dir > 0 ? null : this.mem[0]);
    if (!c) return;
    this.cuePt = c.t; this.seek(c.t); if (this.playing()) MW.setValue(this.g, 'play', 0);
    // memory loop guardado en rekordbox: queda armado y activo (se encienden IN, OUT y RELOOP/EXIT)
    if (c.type === 4 && c.end > c.t) this.setLoop(c.t, c.end, true, this.grid ? Math.round((MW.beatAt(this.grid, c.end) - MW.beatAt(this.grid, c.t)) * 1000) / 1000 : 0);
    else if (this.loop.on) this.setLoop(this.loop.a, this.loop.b, false, this.loop.beats);
    this.indicators();
  },
  addMemory(){ if (!this.L) return; const t = this.q(this.pos()); if (this.mem.some(c => Math.abs(c.t - t) < 0.05)) return; this.mem.push({t, num:-1, name:'', type:0}); this.mem.sort((a, b) => a.t - b.t); this.editCues(); MW.emitDeck(this); },
  delMemory(){ if (!this.L) return; const p = this.pos(); const i = this.mem.findIndex(c => Math.abs(c.t - p) < 0.06); if (i >= 0){ this.mem.splice(i, 1); this.editCues(); MW.emitDeck(this); } },
  beatjump(n){
    if (!this.L) return;
    const bl = this.beatLen(), dt = n * bl, p = this.pos();
    if (this.loop.on && Math.abs(n) <= (this.loop.b - this.loop.a) / bl + 1e-6 && Math.abs(n) >= 0){ // con loop activo: mueve el loop
      this.setLoop(this.loop.a + dt, this.loop.b + dt, true, this.loop.beats);
    }
    this.seek(p + dt);
  },
  // sincronizar con la bandeja maestra: tempo y fase (como BEAT SYNC de rekordbox)
  sync(phase){
    const m = MW.leader(this); if (!m || !m.L || !this.L) return;
    const mb = m.bpm(), ob = this.baseBpm(); if (!mb || !ob) return;
    let ratio = mb / ob; // también acepta medio o doble tempo
    if (ratio > 1.5) ratio /= 2; else if (ratio < 0.67) ratio *= 2;
    const range = MW.getValue(this.g, 'rateRange'); let r = (ratio - 1) / range;
    if (Math.abs(r) > 1){ const need = [0.06, 0.10, 0.16, 0.25, 0.5, 1].find(x => Math.abs(ratio - 1) <= x) || 1; MW.setValue(this.g, 'rateRange', need); r = (ratio - 1) / need; }
    MW.setValue(this.g, 'rate', pitchSign() * clamp(r, -1, 1), 'sync');
    if (phase !== false && m.grid && this.grid){
      const mf = MW.beatAt(m.grid, m.pos()), of = MW.beatAt(this.grid, this.pos());
      let d = (mf - Math.floor(mf)) - (of - Math.floor(of)); if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
      if (Math.abs(d) > 0.004) this.seek(this.pos() + d * this.beatLen());
    }
  },
};
MW.Deck = Deck;
MW.leader = function(except){
  const ds = MW.decks.filter(d => d !== except && d.L);
  const lead = ds.find(d => MW.getValue(d.g, 'sync_leader') || MW.getValue(d.g, 'sync_master'));
  if (lead) return lead;
  const pl = ds.filter(d => d.playing());
  return pl[0] || ds[0] || null;
};
// sincronía continua: la bandeja con SYNC encendido sigue el tempo (y la fase, suave) de la maestra
MW.syncTick = function(){
  for (const d of MW.decks){
    if (!d.L) continue;
    let bend = d.jogBend || 0;
    if (MW.getValue(d.g, 'sync_enabled') && !MW.getValue(d.g, 'sync_leader') && !d.scratching){
      const m = MW.leader(d);
      if (m && m.L && m !== d && m.bpm()){
        const want = m.bpm(), base = d.baseBpm();
        let ratio = want / base; if (ratio > 1.5) ratio /= 2; else if (ratio < 0.67) ratio *= 2;
        const range = MW.getValue(d.g, 'rateRange'), r = clamp((ratio - 1) / range, -1, 1) * pitchSign();
        if (Math.abs(MW.getValue(d.g, 'rate') - r) > 1e-5) MW.setValue(d.g, 'rate', r, 'sync');
        if (m.playing() && d.playing() && m.grid && d.grid){
          const mf = MW.beatAt(m.grid, m.pos()), of = MW.beatAt(d.grid, d.pos());
          let e = (mf - Math.floor(mf)) - (of - Math.floor(of)); if (e > 0.5) e -= 1; if (e < -0.5) e += 1;
          // corrección suave de fase (máx. ±0,8 % de velocidad) para que no se note como un tirón
          if (Math.abs(e) > 0.006) bend += clamp(e * 0.25, -0.008, 0.008);
        }
      }
    }
    const nb = (d.bendV || 0) + (bend - (d.bendV || 0)) * 0.25;   // sin saltos de velocidad entre cuadros
    if (Math.abs(nb - (d.bendV || 0)) > 2e-5 || (bend === 0 && d.bendV)){ d.bendV = Math.abs(nb) < 2e-5 ? 0 : nb; d.post({t:'bend', v: d.bendV}); }
    d.jogBend = (d.jogBend || 0) * 0.82; if (Math.abs(d.jogBend) < 1e-4) d.jogBend = 0;
  }
};

/* ---------- acciones de los controles ---------- */
MW.deckOf = g => { const m = /^\[Channel(\d+)\]$/.exec(g); return m ? MW.decks[m[1] - 1] : null; };
MW.onControl((c, v, prev, from) => {
  if (!A.ready) return;
  const g = c.group, k = c.key;
  if (g === '[Master]'){ applyMaster(); return; }
  let m;
  if ((m = /^\[EqualizerRack1_\[Channel(\d+)\]_Effect1\]$/.exec(g))){ MW.decks[m[1] - 1] && MW.decks[m[1] - 1].applyEq(); return; }
  if ((m = /^\[QuickEffectRack1_\[Channel(\d+)\]\]$/.exec(g))){ MW.decks[m[1] - 1] && MW.decks[m[1] - 1].applyFilter(); return; }
  if (/^\[EffectRack1_/.test(g)){ A.fx.control(c, v, prev); return; }
  if (/^\[Sampler\d+\]$/.test(g)){ MW.samplerControl(c, v); return; }
  if (g === '[Library]' || g === '[Playlist]'){ MW.lib && MW.lib.control(k, v); return; }
  const d = MW.deckOf(g); if (!d) return;
  const press = v > 0;
  switch (k){
    case 'play':
      if (!d.L){ c.v = 0; return; }
      if (d.cueHeld || d.hotHeld >= 0){ d.playedDuringCue = true; if (d.cuePreview && !(v > 0)){ c.v = 1; return; } }
      d.setPlay(v > 0); d.indicators(); return;
    case 'cue_default': d.cueButton(press); return;
    case 'cue_gotoandplay': if (press && d.L){ d.seek(d.cuePt); MW.setValue(g, 'play', 1); } return;
    case 'cue_gotoandstop': if (press && d.L){ MW.setValue(g, 'play', 0); d.seek(d.cuePt); } return;
    case 'cue_set': if (press && d.L){ d.cuePt = d.q(d.pos()); d.save(); d.indicators(); } return;
    case 'cue_goto': if (press && d.L) d.seek(d.cuePt); return;
    case 'start_play': if (press && d.L){ d.seek(0); MW.setValue(g, 'play', 1); } return;
    case 'start_stop': if (press && d.L){ MW.setValue(g, 'play', 0); d.seek(0); } return;
    case 'start': if (press) d.seek(0); return;
    case 'end': if (press) d.seek(d.dur - 1); return;
    case 'stop': if (press) MW.setValue(g, 'play', 0); return;
    case 'eject': if (press && !d.playing()) d.stop(true); return;
    case 'LoadSelectedTrack': if (press && MW.lib){
      if (d.playing()) { MW.toast('La bandeja ' + d.n + ' está sonando: ponla en pausa para cargar otra pista.', true); return; }
      const now = performance.now(), o = MW.decks.find(x => x !== d);
      // LOAD dos veces seguidas = Instant Doubles (la misma pista de la otra bandeja, en el mismo punto)
      if (now - (d.lastLoad || 0) < 600 && o && o.L){ d.lastLoad = 0; d.double(o); return; }
      d.lastLoad = now; d.load(MW.lib.selected());
    } return;
    case 'reverse': d.post({t:'reverse', on: press}); return;
    case 'reverseroll': if (press){ d.post({t:'slip', on:true}); d.post({t:'reverse', on:true}); } else { d.post({t:'reverse', on:false}); d.post({t:'slip', on:false}); } return;
    case 'back': case 'fwd': d.jogBend = press ? (k === 'fwd' ? 2 : -3) : 0; return;
    case 'pfl': d.applyFader(); return;
    case 'mute': d.applyFader(); return;
    case 'volume': case 'orientation': d.applyFader(); return;
    case 'pregain': case 'filterLow': case 'filterMid': case 'filterHigh': case 'filterLowKill': case 'filterMidKill': case 'filterHighKill': {
      const map = {filterLow:'parameter1', filterMid:'parameter2', filterHigh:'parameter3'};
      if (map[k]) MW.setState('[EqualizerRack1_' + g + '_Effect1]', map[k], v);
      d.applyEq(); return;
    }
    case 'keylock': d.post({t:'keylock', on: v > 0}); return;
    case 'rate': case 'rateRange': d.applyRate(); return;
    case 'rate_perm_up': case 'rate_perm_down': case 'rate_perm_up_small': case 'rate_perm_down_small':
      if (press){ const step = (k.includes('small') ? 0.0005 : 0.005) / MW.getValue(g, 'rateRange'); MW.setValue(g, 'rate', clamp(MW.getValue(g, 'rate') + (k.includes('up') ? step : -step), -1, 1)); } return;
    case 'rate_temp_up': case 'rate_temp_down': case 'rate_temp_up_small': case 'rate_temp_down_small':
      d.jogBend = press ? (k.includes('up') ? 1 : -1) * (k.includes('small') ? 0.01 : 0.04) : 0; return;
    case 'jog': case 'wheel':
      if (!d.L) return;
      if (!d.playing()) d.seek(d.pos() + v * 0.0025);
      else if (Math.abs(v) > 20) d.seek(d.pos() + v * 0.004);
      else d.jogBend = clamp((d.jogBend || 0) + v * 0.012, -0.5, 0.5);
      return;
    case 'sync_enabled':
      if (v > 0){
        // como rekordbox: si nadie es MASTER, la otra bandeja pasa a serlo
        if (!MW.decks.some(o => MW.getValue(o.g, 'sync_leader'))){ const o = MW.decks.find(x => x !== d && x.L); if (o) MW.setValue(o.g, 'sync_leader', 1); }
        d.sync(true);
      }
      return;
    case 'sync_leader': case 'sync_master': if (v > 0) for (const o of MW.decks) if (o !== d){ ctl(o.g, 'sync_leader').v = 0; ctl(o.g, 'sync_master').v = 0; emit(ctl(o.g, 'sync_leader')); emit(ctl(o.g, 'sync_master')); } return;
    case 'beatsync': if (press) d.sync(true); return;
    case 'beatsync_tempo': if (press) d.sync(false); return;
    case 'beatsync_phase': if (press){ const r = MW.getValue(g, 'rate'); d.sync(true); MW.setValue(g, 'rate', r); } return;
    case 'quantize': return;
    case 'loop_in': if (press && d.L){ const a = d.q(d.pos()); d.loop.a = a; d.loopInSet = true; if (d.loop.on) d.setLoop(a, Math.max(a + 0.01, d.loop.b), true, 0); } return;
    case 'loop_out': if (press && d.L){ const b = d.q(d.pos()); const a = d.loopInSet || d.loop.b ? d.loop.a : Math.max(0, b - 4 * d.beatLen()); if (b > a + 0.01){ d.setLoop(a, b, true, d.grid ? Math.round((MW.beatAt(d.grid, b) - MW.beatAt(d.grid, a)) * 1000) / 1000 : 0); d.loopInSet = false; } } return;
    case 'reloop_toggle': case 'reloop_exit':
      if (press && d.L){ if (d.loop.on) d.setLoop(d.loop.a, d.loop.b, false, d.loop.beats); else if (d.loop.b > d.loop.a){ d.setLoop(d.loop.a, d.loop.b, true, d.loop.beats); if (d.pos() > d.loop.b) d.seek(d.loop.a); } } return;
    case 'reloop_andstop': if (press && d.L && d.loop.b > d.loop.a){ MW.setValue(g, 'play', 0); d.seek(d.loop.a); d.setLoop(d.loop.a, d.loop.b, true, d.loop.beats); } return;
    case 'loop_halve': if (press) MW.setValue(g, 'loop_scale', 0.5); return;
    case 'loop_double': if (press) MW.setValue(g, 'loop_scale', 2); return;
    case 'loop_scale':
      if (d.loop.on && v > 0){ const len = (d.loop.b - d.loop.a) * v; if (len > 0.005 && len < d.dur){ const nb = (d.loop.beats || 0) * v; d.setLoop(d.loop.a, d.loop.a + len, true, nb); MW.setState(g, 'beatloop_size', nb || MW.getValue(g, 'beatloop_size')); } }
      else if (!d.loop.on && v > 0){ MW.setState(g, 'beatloop_size', clamp(MW.getValue(g, 'beatloop_size') * v, 1/32, 64)); }
      c.v = 1; return;
    case 'loop_start_position': if (from !== 'state' && d.L){ const a = v / 2 / d.sr; if (a < d.loop.b) d.setLoop(a, d.loop.b, d.loop.on, 0); } return;
    case 'loop_end_position': if (from !== 'state' && d.L){ const b = v / 2 / d.sr; if (b > d.loop.a) d.setLoop(d.loop.a, b, d.loop.on, 0); } return;
    case 'beatloop_activate': if (press) d.beatLoop(MW.getValue(g, 'beatloop_size'), false); return;
    case 'beatjump': if (v) d.beatjump(v); return;
    case 'beatjump_forward': if (press) d.beatjump(MW.getValue(g, 'beatjump_size')); return;
    case 'beatjump_backward': if (press) d.beatjump(-MW.getValue(g, 'beatjump_size')); return;
    case 'loop_move_forward': case 'loop_move_backward': if (press && d.loop.on){ const n = (k.endsWith('forward') ? 1 : -1) * (d.loop.beats || 1) * d.beatLen(); d.setLoop(d.loop.a + n, d.loop.b + n, true, d.loop.beats); } return;
    case 'playposition': if (from !== 'state' && d.L) d.seek(v * d.dur); return;
    case 'bpm_tap': if (press) MW.tap(d); return;
  }
  if ((m = /^hotcue_(\d)_(activate|clear|set|goto|gotoandplay|gotoandstop|gotoandloop)$/.exec(k))){
    const i = m[1] - 1, a = m[2];
    if (a === 'activate') d.hotcue(i, press, 'preview');
    else if (a === 'clear') d.hotcue(i, press, 'clear');
    else if (a === 'set') d.hotcue(i, press, 'set');
    else if (press && d.hot[i]){ d.jumpTo(d.hot[i].t); if (a === 'gotoandplay' || a === 'gotoandloop') MW.setValue(g, 'play', 1); if (a === 'gotoandstop') MW.setValue(g, 'play', 0); }
    return;
  }
  if ((m = /^beatloop_([\d.]+)_(toggle|activate)$/.exec(k))){ if (press) d.beatLoop(+m[1], m[2] === 'toggle'); return; }
  if ((m = /^beatlooproll_([\d.]+)_activate$/.exec(k))){
    if (press && d.L){ d.slipRoll = true; d.post({t:'slip', on:true}); d.loop.on = false; d.beatLoop(+m[1], false); }
    else if (!press && d.slipRoll){ d.slipRoll = false; d.setLoop(d.loop.a, d.loop.b, false, 0); d.post({t:'slip', on:false}); }
    return;
  }
  if ((m = /^beatjump_([\d.]+)_(forward|backward)$/.exec(k))){ if (press) d.beatjump((m[2] === 'forward' ? 1 : -1) * +m[1]); return; }
});
MW.tap = (function(){ const taps = {}; return d => { const now = performance.now(), t = taps[d.n] = (taps[d.n] || []).filter(x => now - x < 3000); t.push(now); if (t.length >= 4){ const iv = (t[t.length - 1] - t[0]) / (t.length - 1); const bpm = 60000 / iv; if (d.L){ const p = d.pos(); d.grid = mkGrid([{t: p, bpm: Math.round(bpm * 10) / 10}]); d.applyRate(); d.save(); MW.emitDeck(d); } } }; })();

/* ---------- scratch (jog wheel tocado por arriba) ---------- */
MW.scratchEnable = (deckN, intervals, rpm) => { const d = MW.decks[deckN - 1]; if (!d || !d.L) return; d.scratching = true; d.scratchK = (60 / (rpm || 33.333)) / (intervals || 720); d.post({t:'scratch', on:true}); };
MW.scratchTick = (deckN, ticks) => { const d = MW.decks[deckN - 1]; if (!d || !d.scratching) return; d.post({t:'scratchMove', d: ticks * d.scratchK * d.sr}); };
MW.scratchDisable = deckN => { const d = MW.decks[deckN - 1]; if (!d || !d.scratching) return; d.scratching = false; d.post({t:'scratch', on:false}); };
MW.isScratching = deckN => { const d = MW.decks[deckN - 1]; return !!(d && d.scratching); };

/* ---------- efectos de ritmo (Beat FX) ---------- */
// una unidad con 3 ranuras, como en Mixxx; la DDJ-400 la usa al estilo rekordbox (un efecto a la vez, ◀ ▶ cambia los golpes)
const FX_TYPES = [
  {id:'echo', name:'Echo', beats:[0.25, 0.5, 0.75, 1, 2], def:0.5, add:true},
  {id:'delay', name:'Delay', beats:[0.125, 0.25, 0.5, 0.75, 1, 2, 4], def:0.5, add:true},
  {id:'reverb', name:'Reverb', beats:[1], def:0.5, add:true},
  {id:'flanger', name:'Flanger', beats:[1, 2, 4, 8, 16, 32], def:4, add:false},
  {id:'phaser', name:'Phaser', beats:[1, 2, 4, 8, 16, 32], def:4, add:false},
  {id:'filter', name:'Filter', beats:[1, 2, 4, 8, 16, 32], def:8, add:false},
  {id:'trans', name:'Trans', beats:[0.125, 0.25, 0.5, 1], def:0.5, add:false},
];
MW.FX_TYPES = FX_TYPES;
function makeFxUnit(ctx){
  const U = {input: ctx.createGain(), out: ctx.createGain(), slots: [], target: null, wet: ctx.createGain(), dryTargets: new Set()};
  U.wet.connect(U.out);
  // eco y delay
  const dl = ctx.createDelay(4), fb = ctx.createGain(), dlF = biq(ctx, 'highpass', 200), dlL = biq(ctx, 'lowpass', 7000);
  U.input.connect(dl); chain(dl, dlF, dlL, fb, dl);
  const dlOut = ctx.createGain(); dlL.connect(dlOut);
  // reverb: respuesta al impulso generada (ruido que decae)
  const conv = ctx.createConvolver(), rvLen = 2.8, ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * rvLen), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++){ const b = ir.getChannelData(ch); for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / b.length, 3.2); }
  conv.buffer = ir; const rvOut = ctx.createGain(); U.input.connect(conv); conv.connect(rvOut);
  // flanger y phaser: retardo / filtros modulados por un LFO al ritmo
  const fl = ctx.createDelay(0.05), flFb = ctx.createGain(), lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  fl.delayTime.value = 0.004; lfo.type = 'triangle'; lfoG.gain.value = 0.003; lfo.connect(lfoG); lfoG.connect(fl.delayTime); lfo.start();
  U.input.connect(fl); fl.connect(flFb); flFb.connect(fl); flFb.gain.value = 0.6;
  const flOut = ctx.createGain(); fl.connect(flOut); U.input.connect(flOut);
  const ph = [0, 1, 2, 3].map(() => biq(ctx, 'allpass', 800, 0.7)); let last = U.input;
  for (const p of ph){ last.connect(p); last = p; }
  const phOut = ctx.createGain(); last.connect(phOut); U.input.connect(phOut);
  const phLfo = ctx.createOscillator(), phLfoG = ctx.createGain(); phLfo.type = 'sine'; phLfoG.gain.value = 600; phLfo.connect(phLfoG); ph.forEach(p => phLfoG.connect(p.frequency)); phLfo.start();
  // filtro barrido
  const sw = biq(ctx, 'bandpass', 1000, 2.5), swLfo = ctx.createOscillator(), swG = ctx.createGain(); swLfo.type = 'sine'; swG.gain.value = 900; swLfo.connect(swG); swG.connect(sw.frequency); swLfo.start();
  const swOut = ctx.createGain(); U.input.connect(sw); sw.connect(swOut);
  // trans: corta el sonido a ritmo
  const tr = ctx.createGain(), trLfo = ctx.createOscillator(), trG = ctx.createGain(); trLfo.type = 'square'; trG.gain.value = 0.5; tr.gain.value = 0.5; trLfo.connect(trG); trG.connect(tr.gain); trLfo.start();
  const trOut = ctx.createGain(); U.input.connect(tr); tr.connect(trOut);
  const outs = {echo: dlOut, delay: dlOut, reverb: rvOut, flanger: flOut, phaser: phOut, filter: swOut, trans: trOut};
  for (const k in outs){ outs[k].gain.value = 0; try { outs[k].connect(U.wet); } catch(e){} }
  const uniq = [...new Set(Object.values(outs))];
  U.state = {type: 0, beatIdx: 3, enabled: false, mix: 0.5, target: 'm'};
  try { const s = JSON.parse(localStorage.getItem('mesa-fx') || 'null'); if (s) Object.assign(U.state, s, {enabled:false}); } catch(e){}
  U.slotType = [0, 2, 3];
  U.apply = function(){
    const S = U.state, T = FX_TYPES[S.type], t = ctx.currentTime;
    const bpm = (MW.leader() && MW.leader().bpm()) || 120, beat = 60 / bpm;
    const beats = T.beats[clamp(S.beatIdx, 0, T.beats.length - 1)];
    uniq.forEach(o => o.gain.setTargetAtTime(0, t, 0.02));
    const on = S.enabled, mix = S.mix;
    if (on){
      const o = outs[T.id];
      if (T.id === 'echo' || T.id === 'delay'){ dl.delayTime.setTargetAtTime(Math.min(3.9, beat * beats), t, 0.03); fb.gain.value = T.id === 'echo' ? 0.55 : 0.25; }
      if (T.id === 'flanger') lfo.frequency.value = 1 / (beat * beats);
      if (T.id === 'phaser') phLfo.frequency.value = 1 / (beat * beats);
      if (T.id === 'filter') swLfo.frequency.value = 1 / (beat * beats);
      if (T.id === 'trans') trLfo.frequency.value = 1 / (beat * beats);
      o.gain.setTargetAtTime(T.add ? mix * 1.1 : mix, t, 0.02);
    } else fb.gain.value = 0.35; // al apagar, el eco se va apagando solo (como en rekordbox)
    // los efectos que reemplazan el sonido bajan el seco del canal elegido
    const dryG = on && !T.add ? 1 - mix : 1;
    for (const d of MW.decks){ const sel = S.target === String(d.n); d.send.gain.setTargetAtTime(sel || S.target === 'm' ? 1 : 0, t, 0.01); d.dry.gain.setTargetAtTime(sel || S.target === 'm' ? dryG : 1, t, 0.01); }
    MW.setState('[EffectRack1_EffectUnit1]', 'mix', mix);
    MW.setState('[EffectRack1_EffectUnit1_Effect1]', 'enabled', on ? 1 : 0);
    ['1', '2', 'm'].forEach(x => MW.setState('[EffectRack1_EffectUnit1]', 'group_[' + (x === 'm' ? 'Master' : 'Channel' + x) + ']_enable', S.target === x ? 1 : 0));
    try { localStorage.setItem('mesa-fx', JSON.stringify({type:S.type, beatIdx:S.beatIdx, mix:S.mix, target:S.target})); } catch(e){}
    MW.emitFx && MW.emitFx();
  };
  U.out.connect(A.master);
  U.label = () => { const T = FX_TYPES[U.state.type]; const b = T.beats[clamp(U.state.beatIdx, 0, T.beats.length - 1)]; return {name: T.name, beats: b}; };
  U.next = n => { U.state.type = (U.state.type + n + FX_TYPES.length) % FX_TYPES.length; const T = FX_TYPES[U.state.type]; U.state.beatIdx = Math.max(0, T.beats.indexOf(T.def)); U.apply(); };
  U.beat = n => { const T = FX_TYPES[U.state.type]; U.state.beatIdx = clamp(U.state.beatIdx + n, 0, T.beats.length - 1); U.apply(); };
  U.toggle = on => { U.state.enabled = on == null ? !U.state.enabled : !!on; U.apply(); };
  U.setMix = m => { U.state.mix = clamp(m, 0, 1); U.apply(); };
  U.setTarget = x => { U.state.target = x; U.apply(); };
  // controles estilo Mixxx (para mapeos genéricos)
  U.control = function(c, v){
    const k = c.key, g = c.group;
    if (/_Effect\d+\]$/.test(g)){
      const slot = +/_Effect(\d+)\]$/.exec(g)[1];
      if (k === 'enabled'){ if (slot !== 1){ U.state.type = U.slotType[slot - 1]; } U.toggle(v > 0); }
      else if (k === 'next_effect' && v > 0) U.next(1);
      else if (k === 'prev_effect' && v > 0) U.next(-1);
      else if (k === 'effect_selector') U.next(v > 0 ? 1 : -1);
      else if (k === 'meta' || k === 'parameter1'){ const T = FX_TYPES[U.state.type]; U.state.beatIdx = Math.round(v * (T.beats.length - 1)); U.apply(); }
      return;
    }
    if (k === 'mix') U.setMix(v);
    else if (k === 'super1'){ const T = FX_TYPES[U.state.type]; U.state.beatIdx = Math.round(v * (T.beats.length - 1)); U.apply(); }
    else if (/^group_\[(Channel(\d)|Master)\]_enable$/.test(k) && v > 0){ const mm = /Channel(\d)/.exec(k); U.setTarget(mm ? mm[1] : 'm'); }
  };
  setTimeout(() => U.apply(), 0);
  return U;
}

/* ---------- sampler: 16 sonidos listos para los pads ---------- */
function synthSamples(ctx){
  const sr = ctx.sampleRate, mk = (sec, fn) => { const b = ctx.createBuffer(2, Math.floor(sr * sec), sr); const L = b.getChannelData(0), R = b.getChannelData(1); for (let i = 0; i < L.length; i++){ const t = i / sr; const v = fn(t, i); L[i] = R[i] = v; } return b; };
  const env = (t, a, d) => t < a ? t / a : Math.exp(-(t - a) / d);
  let ph = 0;
  const horn = f => { ph = 0; return mk(1.6, t => { const fr = f * (1 + 0.02 * Math.sin(t * 30)); ph += fr / sr; const s = ((ph % 1) * 2 - 1) * 0.5 + Math.sign(Math.sin(ph * 2 * Math.PI)) * 0.3; return s * Math.min(1, t * 20) * (t > 1.3 ? (1.6 - t) / 0.3 : 1) * 0.35; }); };
  const siren = () => { ph = 0; return mk(2.4, t => { const fr = 600 + 400 * Math.sin(t * 2 * Math.PI * 1.2); ph += fr / sr; return Math.sin(ph * 2 * Math.PI) * 0.35 * Math.min(1, t * 10) * Math.min(1, (2.4 - t) * 4); }); };
  const laser = () => { ph = 0; return mk(0.5, t => { const fr = 2400 * Math.exp(-t * 7) + 120; ph += fr / sr; return Math.sign(Math.sin(ph * 2 * Math.PI)) * 0.25 * env(t, 0.003, 0.18); }); };
  const kick = () => { ph = 0; return mk(0.6, t => { const fr = 150 * Math.exp(-t * 18) + 45; ph += fr / sr; return Math.sin(ph * 2 * Math.PI) * env(t, 0.002, 0.2) * 0.9; }); };
  const clap = () => mk(0.4, t => (Math.random() * 2 - 1) * (env(t, 0.001, 0.012) * (t < 0.03 ? 1 : 0) + env(Math.max(0, t - 0.03), 0.001, 0.09)) * 0.5);
  const riser = () => { ph = 0; return mk(4, t => { ph += (200 + t * t * 300) / sr; return ((Math.random() * 2 - 1) * 0.25 + Math.sin(ph * 2 * Math.PI) * 0.2) * (t / 4) * Math.min(1, (4 - t) * 10); }); };
  const impact = () => { ph = 0; return mk(3, t => { ph += (60 * Math.exp(-t * 2) + 30) / sr; return (Math.sin(ph * 2 * Math.PI) * 0.8 + (Math.random() * 2 - 1) * 0.4 * Math.exp(-t * 6)) * env(t, 0.002, 0.8); }); };
  const snare = () => { ph = 0; return mk(0.35, t => { ph += 190 / sr; return ((Math.random() * 2 - 1) * 0.6 + Math.sin(ph * 2 * Math.PI) * 0.4) * env(t, 0.001, 0.07) * 0.7; }); };
  const names = ['Bocina', 'Sirena', 'Láser', 'Bombo', 'Palmas', 'Subida', 'Impacto', 'Caja'];
  const list = [horn(440), siren(), laser(), kick(), clap(), riser(), impact(), snare()];
  const list2 = [horn(330), siren(), laser(), kick(), clap(), riser(), impact(), snare()];
  return {names, bufs: [...list, ...list2]};
}
function makeSamplers(ctx){
  const S = synthSamples(ctx);
  const bus = ctx.createGain(); bus.gain.value = 0.8; bus.connect(A.master); A.samplerBus = bus;
  for (let i = 0; i < 16; i++){
    MW.samplers.push({n: i + 1, g: '[Sampler' + (i + 1) + ']', buf: S.bufs[i], name: S.names[i % 8], src: null});
    MW.setState('[Sampler' + (i + 1) + ']', 'track_loaded', 1);
  }
  MW.samplerNames = S.names;
}
MW.samplerControl = function(c, v){
  const s = MW.samplers[(+/\d+/.exec(c.group)[0]) - 1]; if (!s) return;
  const ctx = A.ctx;
  const stop = () => { if (s.src){ try { s.src.stop(); } catch(e){} s.src = null; } MW.setState(s.g, 'play', 0); };
  const play = () => { stop(); const src = ctx.createBufferSource(); src.buffer = s.buf; src.connect(A.samplerBus); src.onended = () => { if (s.src === src){ s.src = null; MW.setState(s.g, 'play', 0); } }; src.start(); s.src = src; MW.setState(s.g, 'play', 1); };
  switch (c.key){
    case 'cue_gotoandplay': case 'start_play': if (v > 0) play(); break;
    case 'cue_gotoandstop': case 'stop': case 'start_stop': if (v > 0) stop(); break;
    case 'play': c.v = 0; if (v > 0) play(); else stop(); break;
    case 'eject': if (v > 0) stop(); break;
    case 'LoadSelectedTrack': if (v > 0) play(); break;
  }
};

/* ---------- pulso del motor: indicadores que parpadean, vúmetros, sincronía ---------- */
MW.blink = false;
let blinkT = 0;
MW.tick = function(){
  if (!A.ready) return;
  const now = performance.now();
  if (now - blinkT > 500){ blinkT = now; MW.blink = !MW.blink; }
  MW.syncTick();
  for (const d of MW.decks){
    d.indicators();
    const v = d.vu(); d.vuS = Math.max(v, (d.vuS || 0) * 0.9);
    MW.setState(d.g, 'vu_meter', Math.round(Math.min(1, d.vuS) * 40) / 40);
    MW.setState(d.g, 'VuMeter', Math.round(Math.min(1, d.vuS) * 40) / 40);
    if (d.L) MW.setState(d.g, 'playposition', Math.round(d.pos() / d.dur * 2000) / 2000);
  }
};
})();

/* Mesa Web · análisis de BPM y grilla
   1. Envolvente de ataques ("punch"): cuánto sube la energía de los graves (bombo) y de los agudos en cada ~6 ms.
   2. BPM: autocorrelación de esa envolvente, solo dentro del rango elegido (como el "rango de BPM" de rekordbox).
   3. Ajuste fino: un peine de golpes recorre toda la pista y se queda con el BPM y la fase que caen justo
      sobre los ataques; si el BPM queda a menos de 0,05 de un número entero, se usa el entero.
   4. Compás: el golpe 1 es el que junta más energía de bombo cada 4 golpes.
   5. Modo dinámico: revisa la pista por tramos de 32 golpes y crea un punto de tempo nuevo donde el tempo cambia. */
(function(){
'use strict';
const MW = window.MW = window.MW || {};
MW.BPM_RANGES = [[58, 115], [68, 135], [78, 155], [88, 175], [98, 195], [108, 215], [120, 235]];

MW.analyzeBeats = async function(Lc, Rc, sr, opt){
  opt = opt || {};
  const lo = opt.min || 88, hi = opt.max || 175;
  const hop = Math.max(64, Math.round(sr / 172.27)), fps = sr / hop, n = Math.floor(Lc.length / hop);
  if (n < fps * 8) return null;
  const low = new Float32Array(n), high = new Float32Array(n);
  const aL = 1 - Math.exp(-2 * Math.PI * 150 / sr), aH = 1 - Math.exp(-2 * Math.PI * 3000 / sr);
  let l1 = 0, l2 = 0, h1 = 0;
  for (let f = 0; f < n; f++){
    let eL = 0, eH = 0;
    const s0 = f * hop, s1 = s0 + hop;
    for (let i = s0; i < s1; i++){
      const x = (Lc[i] + Rc[i]) * 0.5;
      l1 += aL * (x - l1); l2 += aL * (l1 - l2); h1 += aH * (x - h1);
      eL += l2 * l2; const y = x - h1; eH += y * y;
    }
    low[f] = Math.log(1 + 2000 * eL / hop); high[f] = Math.log(1 + 2000 * eH / hop);
    if ((f & 8191) === 0) await new Promise(r => setTimeout(r, 0));
  }
  // novedad: solo las subidas (ataques), el bombo pesa más
  const nov = new Float32Array(n), kick = new Float32Array(n);
  for (let f = 1; f < n; f++){ const k = Math.max(0, low[f] - low[f - 1]); kick[f] = k; nov[f] = k + 0.45 * Math.max(0, high[f] - high[f - 1]); }
  // quitar la tendencia (media móvil de ~0,4 s)
  const W = Math.round(fps * 0.4), env = new Float32Array(n); let acc = 0;
  for (let f = 0; f < n; f++){ acc += nov[f]; if (f >= W) acc -= nov[f - W]; env[f] = Math.max(0, nov[f] - acc / Math.min(f + 1, W)); }
  const at = (a, x) => { const i = Math.floor(x); if (i < 0 || i + 1 >= a.length) return 0; const fr = x - i; return a[i] * (1 - fr) + a[i + 1] * fr; };
  // autocorrelación en los periodos del rango (y sus múltiplos)
  const lagMax = Math.ceil(fps * 60 / lo * 4) + 2, acf = new Float32Array(lagMax + 1);
  for (let L = Math.floor(fps * 60 / hi) - 1; L <= lagMax; L++){
    let s = 0; for (let f = L; f < n; f++) s += env[f] * env[f - L];
    acf[L] = s;
    if ((L & 31) === 0) await new Promise(r => setTimeout(r, 0));
  }
  const cand = [];
  for (let b = lo; b <= hi; b += 0.1){
    const L = fps * 60 / b;
    cand.push([b, at(acf, L) + 0.5 * at(acf, 2 * L) + 0.33 * at(acf, 3 * L) + 0.25 * at(acf, 4 * L)]);
  }
  const peaks = cand.filter((c, i) => i > 0 && i < cand.length - 1 && c[1] >= cand[i - 1][1] && c[1] >= cand[i + 1][1]).sort((a, b) => b[1] - a[1]).slice(0, 4);
  // peine sobre toda la pista: BPM + fase que caen justo en los ataques
  const comb = (bpm, f0, f1) => {
    const P = fps * 60 / bpm; let best = -1, bp = 0;
    const a = f0 || 0, b = f1 || n;
    for (let ph = 0; ph < P; ph += 0.5){
      let s = 0, c = 0;
      for (let x = a + ph; x < b; x += P){ s += at(env, x); c++; }
      s /= Math.max(1, c); if (s > best){ best = s; bp = ph; }
    }
    return [best, bp + a];
  };
  let best = null;
  for (const [b] of peaks){
    for (let d = -0.3; d <= 0.3001; d += 0.05){ const bb = b + d; if (bb < lo || bb > hi) continue; const [s, ph] = comb(bb); if (!best || s > best.s) best = {bpm: bb, s, ph}; }
    await new Promise(r => setTimeout(r, 0));
  }
  if (!best) return null;
  for (let d = -0.05; d <= 0.05001; d += 0.005){ const bb = best.bpm + d; const [s, ph] = comb(bb); if (s > best.s) best = {bpm: bb, s, ph}; }
  const r = Math.round(best.bpm);
  if (Math.abs(best.bpm - r) < 0.05){ const [s, ph] = comb(r); if (s >= best.s * 0.97) best = {bpm: r, s, ph}; }
  const bpm = Math.round(best.bpm * 100) / 100, P = fps * 60 / bpm;
  // golpe 1 del compás: el que más bombo junta cada 4 golpes
  const bar = [0, 0, 0, 0]; let k = 0;
  for (let x = best.ph; x < n; x += P, k++) bar[k % 4] += at(kick, x);
  const j = bar.indexOf(Math.max(...bar));
  let t0 = (best.ph + j * P) * hop / sr;
  const per = 60 / bpm; t0 = t0 - Math.floor(t0 / (per * 4)) * per * 4;   // primer golpe 1 desde el inicio
  let grid = [{t: Math.round(t0 * 1000) / 1000, bpm, bar: 1}];
  if (opt.dynamic){
    // tramos de 32 golpes: si el tempo local se aleja, nuevo punto de tempo (en un golpe 1)
    const segs = [{t: t0, bpm}];
    let cur = bpm, tCur = t0, beatsDone = 0;
    while (true){
      const tStart = tCur + beatsDone * 60 / cur, f0 = Math.round(tStart * fps), f1 = Math.min(n, Math.round((tStart + 32 * 60 / cur) * fps));
      if (f1 - f0 < 32 * 60 / cur * fps * 0.9) break;
      let lb = null;
      for (let d = -2.5; d <= 2.5001; d += 0.1){ const bb = cur + d; const [s, ph] = comb(bb, f0 - 0.15 * fps * 60 / bb, f1); if (!lb || s > lb.s) lb = {bpm: bb, s, ph}; }
      if (Math.abs(lb.bpm - cur) > 0.15){
        // el nuevo tramo parte en el golpe que el peine encontró, redondeado al compás
        const tNew = lb.ph * hop / sr;
        cur = Math.round(lb.bpm * 100) / 100; segs.push({t: tNew, bpm: cur}); tCur = tNew; beatsDone = 32;
      } else beatsDone += 32;
      if ((beatsDone & 127) === 0) await new Promise(r => setTimeout(r, 0));
      if (tCur + beatsDone * 60 / cur > n / fps) break;
    }
    if (segs.length > 1) grid = segs.map(s => ({t: Math.round(s.t * 1000) / 1000, bpm: s.bpm, bar: 1}));
  }
  return {bpm, t0: grid[0].t, grid, conf: best.s};
};
})();

// Mesa Web: reproductor de una bandeja (corre en el hilo de audio del navegador).
// Lee la pista decodificada a velocidad variable (pitch, scratch, reversa) con interpolación cúbica,
// hace los loops con precisión de muestra y, con Master Tempo, cambia el tempo sin cambiar el tono (WSOLA).
class MesaDeck extends AudioWorkletProcessor {
  constructor(){
    super();
    this.L = null; this.R = null; this.len = 0;
    this.pos = 0;            // posición en muestras (cuadros)
    this.playing = false;
    this.rate = 1;           // tempo (1 = original)
    this.bend = 0;           // empujón del jog (se suma al tempo)
    this.dir = 1;            // 1 adelante, -1 reversa
    this.v = 0;              // velocidad real del cabezal
    this.scratch = false; this.target = 0;
    this.loopOn = false; this.la = 0; this.lb = 0;
    this.slip = false; this.slipPos = 0;
    this.keylock = false;
    this.ramp = 0;           // fundido corto tras un salto (evita clics)
    this.n = 0;
    // WSOLA (Master Tempo): ventanas de 2048 con 75 % de traslape, sumadas en un acumulador
    this.N = 2048; this.Hs = 512; this.win = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) this.win[i] = (0.5 - 0.5 * Math.cos(2 * Math.PI * i / this.N)) * 0.5;   // 4 ventanas Hann traslapadas suman 2
    this.olaL = new Float32Array(this.N); this.olaR = new Float32Array(this.N);
    this.fifoL = new Float32Array(8192); this.fifoR = new Float32Array(8192); this.fifoN = 0; this.fifoR0 = 0; this.prevStart = -1; this.warm = 0;
    this.port.onmessage = e => this.msg(e.data);
  }
  msg(m){
    switch (m.t){
      case 'load': this.L = m.L; this.R = m.R || m.L; this.len = this.L.length; this.pos = 0; this.playing = false; this.loopOn = false; this.resetStretch(); break;
      case 'unload': this.L = this.R = null; this.len = 0; this.playing = false; break;
      case 'play': this.playing = !!m.on; if (m.on) this.ramp = 64; break;
      case 'seek': this.pos = Math.max(0, Math.min(this.len - 1, m.pos)); this.target = this.pos; this.ramp = 128; this.prevStart = -1; this.send(); break;
      case 'rate': this.rate = m.r; break;
      case 'bend': this.bend = m.v; break;
      case 'keylock': this.keylock = !!m.on; this.resetStretch(); break;
      case 'loop': this.loopOn = !!m.on; if (m.a != null){ this.la = m.a; this.lb = m.b; } if (this.loopOn && m.jump && (this.pos > this.lb || this.pos < this.la)){ this.pos = this.la; this.ramp = 128; this.resetStretch(); } break;
      case 'scratch': this.scratch = !!m.on; this.target = this.pos; if (!m.on) this.resetStretch(); break;
      case 'scratchMove': this.target += m.d; break;
      case 'reverse': this.dir = m.on ? -1 : 1; break;
      case 'slip': if (m.on){ this.slip = true; this.slipPos = this.pos; } else if (this.slip){ this.slip = false; this.pos = Math.min(this.len - 1, this.slipPos); this.ramp = 128; this.resetStretch(); } break;
    }
  }
  resetStretch(){ this.fifoN = 0; this.fifoR0 = 0; this.prevStart = -1; this.olaL.fill(0); this.olaR.fill(0); this.warm = 0; }
  send(){ this.port.postMessage({pos: this.pos, playing: this.playing, v: this.v, t: currentTime}); }
  sample(arr, p){
    const i = Math.floor(p), f = p - i, n = this.len;
    const a = arr[i - 1 < 0 ? 0 : i - 1], b = arr[i] || 0, c = i + 1 < n ? arr[i + 1] : 0, d = i + 2 < n ? arr[i + 2] : 0;
    const c1 = 0.5 * (c - a), c2 = a - 2.5 * b + 2 * c - 0.5 * d, c3 = 0.5 * (d - a) + 1.5 * (b - c);
    return ((c3 * f + c2) * f + c1) * f + b;
  }
  wrapLoop(){
    if (!this.loopOn || this.lb <= this.la) return;
    const L = this.lb - this.la;
    if (this.v >= 0 && this.pos >= this.lb){ this.pos = this.la + ((this.pos - this.lb) % L); }
    else if (this.v < 0 && this.pos < this.la){ this.pos = this.lb - ((this.la - this.pos) % L); }
  }
  // WSOLA: busca el trozo que mejor empalma con lo que ya sonó y lo suma con una ventana
  stretchHop(){
    const N = this.N, Hs = this.Hs, L = this.L, R = this.R, w = this.win, len = this.len;
    let start = Math.round(this.pos);
    if (this.prevStart >= 0){
      // busca el trozo que mejor empalma con la continuación natural del anterior
      const nat = this.prevStart + Hs, D = 320;
      let best = -1e30, bd = 0;
      const tryD = (d, step) => {
        const s0 = start + d; if (s0 < 0 || s0 + 1024 >= len || nat + 1024 >= len) return;
        let c = 0, e = 1e-9;
        for (let k = 0; k < 1024; k += step){ const x = L[s0 + k] + R[s0 + k], y = L[nat + k] + R[nat + k]; c += x * y; e += x * x; }
        c /= Math.sqrt(e); if (c > best){ best = c; bd = d; }
      };
      for (let d = -D; d <= D; d += 4) tryD(d, 8);
      const c0 = bd; best = -1e30; for (let d = c0 - 3; d <= c0 + 3; d++) tryD(d, 2);
      start += bd;
    }
    start = Math.max(0, Math.min(len - N - 1, start));
    const oL = this.olaL, oR = this.olaR;
    for (let k = 0; k < N; k++){ const wk = w[k]; oL[k] += (L[start + k] || 0) * wk; oR[k] += (R[start + k] || 0) * wk; }
    // sale el primer tramo ya completo (al empezar, la ventana misma hace un fundido corto)
    const o = this.fifoN;
    for (let k = 0; k < Hs; k++){ this.fifoL[o + k] = oL[k]; this.fifoR[o + k] = oR[k]; }
    oL.copyWithin(0, Hs); oR.copyWithin(0, Hs); oL.fill(0, N - Hs); oR.fill(0, N - Hs);
    this.fifoN += Hs;
    this.prevStart = start;
  }
  process(_in, outputs){
    const out = outputs[0], oL = out[0], oR = out[1] || out[0], n = oL.length;
    if (!this.L || !this.len){ oL.fill(0); if (oR !== oL) oR.fill(0); this.v = 0; return true; }
    const sr = sampleRate;
    if (this.scratch){
      const want = (this.target - this.pos) / (n * 2.5);
      this.v += (Math.max(-6, Math.min(6, want)) - this.v) * 0.45;
      if (Math.abs(this.v) < 1e-4 && Math.abs(this.target - this.pos) < 0.5) this.v = 0;
    } else {
      const goal = this.playing ? (this.rate + this.bend) * this.dir : 0;
      this.v += (goal - this.v) * (this.playing ? 0.35 : 0.5);
      if (!this.playing && Math.abs(this.v) < 0.002) this.v = 0;
    }
    // con Master Tempo se usa siempre el mismo camino (también a tempo 0 %): cambiar de camino daba saltos de ~20 ms
    const stretch = this.keylock && !this.scratch && this.playing && this.dir > 0 && this.v > 0.05 && this.len > this.N * 2;
    if (stretch){
      // el cabezal avanza a "v" pero el sonido sale a su tono original
      while (this.fifoN - this.fifoR0 < n){
        if (this.fifoR0 > 0){ this.fifoL.copyWithin(0, this.fifoR0, this.fifoN); this.fifoR.copyWithin(0, this.fifoR0, this.fifoN); this.fifoN -= this.fifoR0; this.fifoR0 = 0; }
        this.stretchHop();
        this.pos += this.Hs * this.v; this.wrapLoop();
        if (this.pos >= this.len - 1){ this.pos = this.len - 1; this.playing = false; this.port.postMessage({end: true}); break; }
      }
      for (let i = 0; i < n; i++){
        const k = this.fifoR0 + i;
        oL[i] = k < this.fifoN ? this.fifoL[k] : 0; oR[i] = k < this.fifoN ? this.fifoR[k] : 0;
      }
      this.fifoR0 = Math.min(this.fifoN, this.fifoR0 + n);
    } else {
      if (this.fifoN) this.resetStretch();
      for (let i = 0; i < n; i++){
        if (this.v === 0){ oL[i] = 0; oR[i] = 0; continue; }
        this.pos += this.v; this.wrapLoop();
        if (this.pos >= this.len - 1){ this.pos = this.len - 1; this.v = 0; if (this.playing){ this.playing = false; this.port.postMessage({end: true}); } }
        if (this.pos < 0){ this.pos = 0; this.v = 0; }
        let g = 1; if (this.ramp > 0){ g = 1 - this.ramp / 128; this.ramp--; }
        // a velocidad muy baja (scratch lento) el sonido se apaga suave, como un vinilo
        const sp = Math.abs(this.v); if (sp < 0.05) g *= sp / 0.05;
        oL[i] = this.sample(this.L, this.pos) * g; oR[i] = this.sample(this.R, this.pos) * g;
      }
    }
    if (this.slip && this.playing) this.slipPos += (this.rate + this.bend) * n;
    if (++this.n % 6 === 0) this.send();
    return true;
  }
}
registerProcessor('mesa-deck', MesaDeck);

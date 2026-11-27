/* Mesa Web · arranque. La página del juego entrega su motor de audio (MESA_HOST) y la mesa se conecta a él:
   el master entra directo al analizador de la sala, así las luces, el baile y la transmisión
   reciben el sonido sin capturar la pantalla ni el audio del computador. */
(function(){
'use strict';
const MW = window.MW;
let opened = false;
MW.open = async function(){
  const H = MW.host = window.MESA_HOST;
  if (!H){ alert('Mesa Web necesita la sala.'); return; }
  const {actx, analyser} = await H.audio();
  if (!actx.audioWorklet){ alert('Este navegador no puede correr la Mesa Web. Usa Chrome o Edge actualizados en un computador.'); return; }
  await MW.initAudio(actx, analyser);
  MW.buildUI();
  H.activate(); MW.setActive(true);
  MW.minimize(false);
  if (!opened){
    opened = true;
    MW.lib.restore().then(() => MW.emitLib());
    MW.midi.start();
  } else MW.midi.start();
};
MW.powerOff = function(){
  for (const d of MW.decks) MW.setValue(d.g, 'play', 0);
  for (const s of MW.samplers) MW.setValue(s.g, 'stop', 1);
  MW.A.fx && MW.A.fx.toggle(false);
  MW.setActive(false);
  MW.host && MW.host.deactivate();
  document.getElementById('mesa').hidden = true; document.getElementById('mwMini').hidden = true; window.MESA_COVER = false;
};
MW.isOn = () => !!(MW.A && MW.A.on);
// lo que necesita la sala: la grilla de la bandeja que manda (para que bailen exacto en el golpe) y el nombre de la pista
MW.roomGrid = function(){
  const d = MW.leaderPlaying();
  if (!d || !d.grid) return null;
  const bpm = d.bpm(); if (!bpm) return null;
  const b = MW.beatAt(d.grid, d.pos());
  return {bpm, t0: MW.A.ctx.currentTime - b * 60 / bpm};
};
MW.leaderPlaying = function(){
  const pl = MW.decks.filter(d => d.L && d.playing());
  if (!pl.length) return null;
  const lead = pl.find(d => MW.getValue(d.g, 'sync_leader'));
  if (lead) return lead;
  // la que más se escucha (fader × crossfader)
  return pl.sort((a, b) => b.xf.gain.value * b.fader.gain.value - a.xf.gain.value * a.fader.gain.value)[0];
};
MW.nowPlaying = function(){ const d = MW.leaderPlaying(); return d && d.track ? (d.track.artist ? d.track.artist + ' – ' : '') + d.track.title : ''; };
})();

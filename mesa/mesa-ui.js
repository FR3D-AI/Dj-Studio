/* Mesa Web · interfaz (2 bandejas + mezclador + biblioteca, al estilo del modo Performance de rekordbox) */
(function(){
'use strict';
const MW = window.MW = window.MW || {};
const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const clamp = MW.clamp;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'})[c]);
const DECK_COL = ['#38b6ff', '#ff7a3d'];

const CSS = `
.mw{position:fixed;inset:0;z-index:60;background:#0d0c12;color:#e9e6f0;font-family:var(--body,system-ui);font-size:13px;display:grid;
  grid-template-rows:44px auto minmax(300px,auto) minmax(170px,1fr);overflow:auto;user-select:none;-webkit-user-select:none}
.mw[hidden]{display:none}
.mw *{box-sizing:border-box}
.mw button{font:inherit;color:inherit;cursor:pointer}
.mw-top{display:flex;align-items:center;gap:10px;padding:0 10px;background:#16141d;border-bottom:1px solid #2a2635;min-width:0;overflow-x:auto}
.mw-logo{font-family:var(--display,Impact);font-weight:400;font-size:17px;letter-spacing:.04em;color:#ffb347;white-space:nowrap}
.mw-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;background:#221f2c;border:1px solid #332e42;white-space:nowrap;font-size:12.5px}
.mw-pill.ok{border-color:#2f7d58;background:#13271e}.mw-pill.warn{border-color:#7d5a2f;background:#2a2013}
.mw-pill i{width:8px;height:8px;border-radius:50%;background:#666}.mw-pill.ok i{background:#5fe0a0;box-shadow:0 0 6px #5fe0a0}.mw-pill.warn i{background:#ffb347}
.mw-pill.act i{background:#ffef5a}
.mw-top select{background:#221f2c;color:#e9e6f0;border:1px solid #332e42;border-radius:6px;padding:3px 4px;max-width:170px;font:inherit;font-size:12px}
.mw-sp{flex:1}
.mw-tb{background:#221f2c;border:1px solid #3a3449;border-radius:7px;padding:5px 10px;white-space:nowrap}
.mw-tb:hover{background:#2c2838}.mw-tb.pri{background:#ffb347;color:#2a1a05;border-color:#ffb347;font-weight:700}
.mw-waves{display:grid;grid-template-rows:62px 62px;gap:2px;background:#050507;padding:2px 0;position:relative}
.mw-waves canvas{width:100%;height:100%;display:block;cursor:grab}
.mw-zoom{position:absolute;right:6px;top:4px;display:flex;gap:4px;z-index:2;align-items:center}.mw-zoom span{background:#000a;border-radius:5px;padding:1px 6px;font-size:11px;font-weight:700}.mw-zoom button{background:#0009;border:1px solid #444;border-radius:5px;width:24px;height:22px;padding:0}
.mw-main{display:grid;grid-template-columns:minmax(330px,1fr) 340px minmax(330px,1fr);gap:6px;padding:6px;background:#0d0c12}
.mw-deck{background:#17151e;border:1px solid #262231;border-radius:10px;padding:7px;display:grid;gap:6px;
  grid-template-columns:150px minmax(0,1fr) 50px;grid-template-rows:auto 30px 150px auto;grid-template-areas:"head head head" "ov ov ov" "jog pads tempo" "tr pads tempo";min-width:0;position:relative}
.mw-deck.r{grid-template-columns:50px minmax(0,1fr) 150px;grid-template-areas:"head head head" "ov ov ov" "tempo pads jog" "tempo pads tr"}
.mw-deck.drop{outline:2px dashed #ffb347;outline-offset:-3px}
.mw-head{grid-area:head;display:flex;align-items:center;gap:8px;min-width:0}
.mw-num{font-family:var(--display,Impact);font-size:20px;width:30px;height:30px;display:grid;place-items:center;border-radius:7px;color:#0d0c12;flex:none}
.mw-ti{min-width:0;flex:1}.mw-ti b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mw-ti span{display:block;color:#9e97b0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mw-bpm{text-align:right;flex:none;line-height:1.05}.mw-bpm b{font-family:var(--display,Impact);font-weight:400;font-size:21px}.mw-bpm span{display:block;font-size:11.5px;color:#9e97b0}
.mw-key{flex:none;padding:2px 7px;border-radius:5px;background:#26223a;font-weight:700;font-size:12px}
.mw-load{flex:none;background:#221f2c;border:1px solid #3a3449;border-radius:6px;padding:3px 7px;font-size:12px}
.mw-ov{grid-area:ov;position:relative;background:#09080c;border-radius:5px;overflow:hidden;cursor:pointer}
.mw-ov canvas{width:100%;height:100%;display:block}
.mw-time{position:absolute;inset:0 6px;display:flex;justify-content:space-between;align-items:flex-start;pointer-events:none;font-variant-numeric:tabular-nums;font-size:11.5px;font-weight:700;text-shadow:0 1px 2px #000}
.mw-jog{grid-area:jog;position:relative}.mw-jog canvas{width:150px;height:150px;display:block;cursor:grab;touch-action:none}
.mw-tr{grid-area:tr;display:grid;grid-template-columns:1fr 1fr;gap:5px;align-content:start}
.mw-big{height:40px;border-radius:50%;border:2px solid #3a3449;background:#1d1a26;font-weight:800;font-size:13px;letter-spacing:.03em;aspect-ratio:1;justify-self:center}
.mw-big.cue.on{border-color:#ffa000;color:#ffa000;box-shadow:0 0 10px #ffa00066}.mw-big.play.on{border-color:#5fe0a0;color:#5fe0a0;box-shadow:0 0 10px #5fe0a066}
.mw-sm{height:24px;border-radius:5px;border:1px solid #3a3449;background:#1d1a26;font-size:11px;font-weight:700;padding:0 4px}
.mw-sm.on{background:#2b3f5c;border-color:#38b6ff;color:#bfe6ff}.mw-sm.on.y{background:#4a3c12;border-color:#ffcf3d;color:#ffe9a0}.mw-sm.on.g{background:#173b2a;border-color:#5fe0a0;color:#c7ffe2}
.mw-pads{grid-area:pads;display:flex;flex-direction:column;gap:5px;min-width:0}
.mw-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:3px}
.mw-modes button{height:22px;border-radius:5px;border:1px solid #332e42;background:#1a1822;font-size:10.5px;font-weight:700;letter-spacing:.02em;padding:0}
.mw-modes button.on{background:#ffb347;color:#2a1a05;border-color:#ffb347}
.mw-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.mw-pad{height:38px;border-radius:6px;border:1px solid #332e42;background:#1d1a26;font-size:11px;font-weight:700;position:relative;overflow:hidden;padding:2px 4px;text-align:left;display:flex;flex-direction:column;justify-content:space-between}
.mw-pad i{font-style:normal;opacity:.8;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mw-pad.set{color:#0d0c12;border-color:transparent}.mw-pad.hit{filter:brightness(1.5)}
.mw-row{display:flex;gap:4px;flex-wrap:wrap}.mw-row .mw-sm{flex:1 1 auto;min-width:34px}
.mw-lsz{min-width:42px;text-align:center;align-self:center;font-weight:800;font-variant-numeric:tabular-nums}
.mw-tempo{grid-area:tempo;display:flex;flex-direction:column;align-items:center;gap:4px}
.mw-tempo .mw-sm{width:100%}
.mw-tv{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;text-align:center}
.mw-fd{position:relative;width:26px;flex:1;min-height:80px;touch-action:none;cursor:ns-resize}
.mw-fd::before{content:"";position:absolute;left:50%;top:6px;bottom:6px;width:4px;margin-left:-2px;background:#08070b;border-radius:2px;box-shadow:inset 0 0 0 1px #2c2838}
.mw-fd b{position:absolute;left:0;right:0;height:14px;margin-top:-7px;border-radius:3px;background:linear-gradient(#ddd,#888);box-shadow:0 2px 4px #000;border:1px solid #222}
.mw-fd b::after{content:"";position:absolute;left:2px;right:2px;top:6px;height:1px;background:#222}
.mw-fd.h{width:auto;height:26px;min-height:0;flex:none;cursor:ew-resize}.mw-fd.h::before{left:6px;right:6px;top:50%;bottom:auto;height:4px;width:auto;margin:-2px 0 0}
.mw-fd.h b{top:0;bottom:0;width:16px;height:auto;margin:0 0 0 -8px}.mw-fd.h b::after{left:7px;right:auto;top:2px;bottom:2px;width:1px;height:auto}
.mw-fd .c{position:absolute;left:3px;right:3px;top:50%;height:1px;background:#5a5470}
.mw-mix{background:#17151e;border:1px solid #262231;border-radius:10px;padding:7px;display:grid;grid-template-columns:minmax(0,1fr) 108px minmax(0,1fr);grid-template-rows:1fr auto;gap:6px}
.mw-strip{display:grid;grid-template-columns:38px 8px 1fr;gap:5px;min-height:0}
.mw-strip.r{grid-template-columns:1fr 8px 38px}.mw-strip.r .mw-kcol{order:3}.mw-strip.r .mw-vu{order:2}.mw-strip.r .mw-fcol{order:1}
.mw-kcol{display:flex;flex-direction:column;align-items:center;gap:3px}
.mw-k{display:flex;flex-direction:column;align-items:center;gap:0;font-size:9.5px;color:#9e97b0;font-weight:700;letter-spacing:.03em}
.mw-knob{width:32px;height:32px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#4a4558,#1d1a26 70%);border:1px solid #0a090d;position:relative;touch-action:none;cursor:ns-resize;--a:0deg}
.mw-knob::after{content:"";position:absolute;left:50%;top:3px;width:3px;height:11px;margin-left:-1.5px;border-radius:2px;background:#fff;transform-origin:50% 13px;transform:rotate(var(--a))}
.mw-knob.f::before{content:"";position:absolute;inset:-3px;border-radius:50%;border:2px solid transparent;border-top-color:var(--fc,#38b6ff);opacity:0;transform:rotate(var(--a))}.mw-knob.f.act::before{opacity:1}
.mw-vu{background:#08070b;border-radius:3px;position:relative;overflow:hidden}.mw-vu i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(to top,#2fd36f 0 65%,#e8e23a 65% 85%,#ff4b3a 85%);height:0}
.mw-fcol{display:flex;flex-direction:column;align-items:center;gap:4px}.mw-fcol .mw-fd{width:30px}
.mw-cue{width:100%;height:24px;border-radius:5px;border:1px solid #3a3449;background:#1d1a26;font-size:11px;font-weight:800}.mw-cue.on{background:#4a3c12;border-color:#ffcf3d;color:#ffe9a0}
.mw-ctr{display:flex;flex-direction:column;gap:6px;align-items:stretch}
.mw-box{background:#100f15;border:1px solid #262231;border-radius:7px;padding:5px;display:flex;flex-direction:column;gap:4px;align-items:center}
.mw-box h4{margin:0;font-size:9.5px;letter-spacing:.06em;color:#9e97b0;font-weight:800}
.mw-fxn{display:flex;align-items:center;gap:3px;width:100%}.mw-fxn b{flex:1;text-align:center;font-size:12px;white-space:nowrap;overflow:hidden}
.mw-fxn button{width:20px;height:20px;padding:0;border-radius:4px;border:1px solid #3a3449;background:#1d1a26;font-size:10px}
.mw-ch{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;width:100%}.mw-ch button{height:20px;padding:0;border-radius:4px;border:1px solid #3a3449;background:#1d1a26;font-size:10.5px;font-weight:700}.mw-ch button.on{background:#2b3f5c;border-color:#38b6ff}
.mw-fxon{width:100%;height:24px;border-radius:5px;border:1px solid #3a3449;background:#1d1a26;font-weight:800;font-size:11.5px}.mw-fxon.on{background:#5c1f1f;border-color:#ff5a4a;color:#ffd2cc;animation:mwb .5s steps(1) infinite alternate}@keyframes mwb{to{background:#3a1616}}
.mw-kr{display:flex;justify-content:space-around;width:100%}
.mw-mvu{display:flex;gap:2px;height:8px;width:100%}.mw-mvu .mw-vu{flex:1}.mw-mvu .mw-vu i{top:0;bottom:0;height:auto;width:0;right:auto;background:linear-gradient(to right,#2fd36f 0 65%,#e8e23a 65% 85%,#ff4b3a 85%)}
.mw-xf{grid-column:1/-1;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;color:#9e97b0}.mw-xf .mw-fd{flex:1}
.mw-lib{display:grid;grid-template-columns:220px 1fr;min-height:0;border-top:1px solid #262231;background:#121118}
.mw-tree{overflow:auto;border-right:1px solid #262231;padding:6px 0}
.mw-tree div{padding:4px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;display:flex;gap:6px}
.mw-tree div.on{background:#2b2539;color:#ffcf8a}.mw-tree div.hd{color:#7d7690;font-size:11px;font-weight:800;letter-spacing:.05em;cursor:default;margin-top:6px}.mw-tree div.fo{color:#b8b0c8;cursor:default}
.mw-tree div small{margin-left:auto;color:#7d7690}.mw-tree.focus div.on{outline:1px solid #ffb347;outline-offset:-1px}
.mw-lr{display:flex;flex-direction:column;min-height:0;min-width:0}
.mw-bar{display:flex;gap:6px;padding:6px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #262231}
.mw-bar input[type=search]{flex:1;min-width:140px;background:#1d1a26;border:1px solid #3a3449;border-radius:7px;color:#e9e6f0;padding:5px 9px;font:inherit}
.mw-bar small{color:#9e97b0}
.mw-list{flex:1;overflow:auto;position:relative;min-height:0;outline:none}
.mw-list .hd,.mw-list .tr{display:grid;grid-template-columns:22px minmax(180px,2.4fr) 62px minmax(120px,1.6fr) minmax(90px,1.1fr) 46px 54px minmax(60px,.8fr);gap:8px;align-items:center;padding:0 8px;height:26px;white-space:nowrap}
.mw-list .hd{position:sticky;top:0;background:#1a1822;color:#9e97b0;font-size:11px;font-weight:800;z-index:1;cursor:pointer}
.mw-list .tr{position:absolute;left:0;right:0;cursor:default;border-bottom:1px solid #18161f}
.mw-list .tr span{overflow:hidden;text-overflow:ellipsis}
.mw-list .tr.on{background:#2b3f5c}.mw-list .tr.miss{color:#6d6680}.mw-list .tr:hover{background:#1f1c29}.mw-list .tr.on:hover{background:#2f4566}
.mw-list .tr .n{font-variant-numeric:tabular-nums;text-align:right}
.mw-dot{width:9px;height:9px;border-radius:50%;background:#3a3449;justify-self:center}.mw-dot.ok{background:#5fe0a0}
.mw-empty{padding:26px;color:#9e97b0;line-height:1.5;max-width:640px}
.mw-empty b{color:#e9e6f0}
.mw-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#221f2c;border:1px solid #3a3449;border-radius:9px;padding:8px 14px;z-index:70;max-width:min(92vw,620px);box-shadow:0 8px 30px #000a;font-size:13.5px}
.mw-toast.warn{border-color:#a0612a;background:#2a1d12}
.mw-set{position:absolute;right:10px;top:48px;z-index:65;background:#1a1822;border:1px solid #3a3449;border-radius:10px;padding:12px;width:min(360px,94vw);box-shadow:0 10px 40px #000c;display:flex;flex-direction:column;gap:9px;font-size:13px}
.mw-set label{display:flex;gap:8px;align-items:center;justify-content:space-between}.mw-set select{background:#221f2c;color:#e9e6f0;border:1px solid #3a3449;border-radius:6px;padding:3px}
.mw-set pre{margin:0;max-height:150px;overflow:auto;background:#0d0c12;border-radius:6px;padding:6px;font-size:11px;white-space:pre-wrap;color:#b8b0c8}
.mw-set p{margin:0;color:#9e97b0;font-size:12px;line-height:1.4}
.mw-mini{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:60;display:flex;gap:10px;align-items:center;background:#16141dee;border:1px solid #3a3449;border-radius:12px;padding:7px 10px;box-shadow:0 8px 30px #000a;max-width:94vw}
.mw-mini[hidden]{display:none}.mw-mini span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;font-size:12.5px}.mw-mini b{font-family:var(--display,Impact);font-weight:400}
/* ---- Vista mesa: abajo de la pantalla, como la DDJ-400; la sala queda arriba ---- */
body.mesa-dock .app{height:calc(100% - var(--mesa-dock-h,0px))}
.mw-st{display:flex;gap:3px;flex:none}.mw-st b{font-size:10px;font-weight:800;padding:2px 5px;border-radius:4px;background:#1f1c29;color:#5d576e;letter-spacing:.02em}
.mw-st b.on{background:#173b2a;color:#7dffb9}.mw-st b.y.on{background:#4a3c12;color:#ffe9a0}.mw-st b.o.on{background:#4a2a10;color:#ffc27a}.mw-st b.b.on{background:#1b3150;color:#a9dcff}
.mw:not(.dock) .mw-st,.mw:not(.dock) .mw-dk{display:none}
.mw-grip{display:none}
.dock .mw-grip{display:block;height:12px;cursor:ns-resize;touch-action:none;background:#16141d;position:relative}.dock .mw-grip i{position:absolute;left:50%;top:4px;width:56px;height:4px;margin-left:-28px;border-radius:2px;background:#5a5470}.dock .mw-grip:hover i,.dock .mw-grip.drag i{background:#ffb347}
.mw.dock{inset:auto 0 0 0;max-height:calc(100vh - 90px);grid-template-rows:auto auto auto auto auto;border-top:2px solid #ffb347;box-shadow:0 -12px 30px #000b}
.dock .mw-top{height:32px;gap:6px;padding:0 6px}.dock .mw-fo{display:none!important}
.dock .mw-tb{padding:3px 8px;font-size:12px}.dock .mw-logo{font-size:14px}.dock .mw-pill{padding:2px 8px;font-size:11.5px}
.dock .mw-waves{grid-template-rows:34px 34px}
.dock .mw-main{grid-template-columns:minmax(0,1fr) 300px minmax(0,1fr);gap:4px;padding:4px}
.dock .mw-deck{grid-template-columns:108px minmax(0,1fr);grid-template-rows:auto 20px auto;grid-template-areas:"head head" "ov ov" "jog pads";padding:5px;gap:5px}
.dock .mw-deck.r{grid-template-columns:minmax(0,1fr) 108px;grid-template-areas:"head head" "ov ov" "pads jog"}
.dock .mw-tr,.dock .mw-tempo,.dock .mw-pads .mw-row,.dock .mw-load{display:none}
.dock .mw-jog canvas{width:108px;height:108px}
.dock .mw-head{gap:6px}.dock .mw-num{width:24px;height:24px;font-size:15px;border-radius:6px}
.dock .mw-ti b{font-size:13.5px}.dock .mw-ti span{font-size:11px}
.dock .mw-bpm b{font-size:19px}.dock .mw-bpm span{font-size:10.5px}.dock .mw-key{font-size:11.5px;padding:1px 6px}
.dock .mw-time{font-size:10.5px}
.dock .mw-modes button{height:18px;font-size:9.5px}
.dock .mw-grid{gap:4px}.dock .mw-pad{height:38px}
.dock .mw-mix{padding:5px;gap:4px;grid-template-columns:minmax(0,1fr) 104px minmax(0,1fr)}
.dock .mw-strip{grid-template-columns:26px 6px 1fr;gap:3px}.dock .mw-strip.r{grid-template-columns:1fr 6px 26px}
.dock .mw-kcol{gap:3px}.dock .mw-k{font-size:0}.dock .mw-knob{width:24px;height:24px}.dock .mw-knob::after{top:2px;height:8px;width:2px;margin-left:-1px;transform-origin:50% 10px}
.dock .mw-cue{height:18px;font-size:9.5px}.dock .mw-fcol .mw-fd{width:24px}
.dock .mw-ctr{gap:4px}.dock .mw-box{padding:3px;gap:3px}.dock .mw-box h4{display:none}
.dock .mw-box.fx{display:grid;grid-template-columns:28px 1fr;align-items:center}.dock .mw-box.fx>*{grid-column:1/-1}.dock .mw-box.fx>.mw-kr{grid-column:1}.dock .mw-box.fx>.mw-ch{grid-column:2}
.dock .mw-fxn b{font-size:11px}.dock .mw-fxn button{width:18px;height:18px}.dock .mw-ch button{height:18px}.dock .mw-fxon{height:20px;font-size:10.5px}
.dock .mw-box.hp,.dock .mw-box.ms{flex-direction:row;justify-content:space-around}.dock .mw-box.ms .mw-mvu{flex:1;height:6px}
.dock .mw-xf{font-size:10px}.dock .mw-xf .mw-fd{height:18px}.dock .mw-xf .mw-fd b{margin-left:-7px;width:14px}
.dock .mw-lib{grid-template-columns:1fr}.dock .mw-tree{display:none}.dock .mw-list{height:var(--mw-list-h,108px);flex:none}
.dock .mw-bar{padding:4px;gap:4px}.dock .mw-bar .mw-tb{padding:3px 8px;font-size:12px}.dock .mw-bar input[type=search]{padding:3px 8px}
.mw-bar select{background:#1d1a26;color:#e9e6f0;border:1px solid #3a3449;border-radius:7px;padding:3px 6px;font:inherit;font-size:12px;max-width:200px}
.dock.nolib .mw-lib{display:none}
@media (max-height:820px){.dock .mw-jog canvas{width:96px;height:96px}.dock .mw-deck{grid-template-columns:96px minmax(0,1fr)}.dock .mw-deck.r{grid-template-columns:minmax(0,1fr) 96px}.dock .mw-pad{height:33px}}
@media (max-width:1100px){.mw-main{grid-template-columns:1fr 1fr}.mw-mix{grid-column:1/-1;grid-row:2}.mw-deck.r{grid-column:2;grid-row:1}}
@media (max-width:760px){.mw-main{grid-template-columns:1fr}.mw-deck.r{grid-column:1;grid-row:auto}.mw-mix{grid-row:auto}.mw-lib{grid-template-columns:1fr}.mw-tree{max-height:120px;border-right:0;border-bottom:1px solid #262231}.mw{grid-template-rows:auto auto auto minmax(300px,auto)}}
`;

function deckHTML(n){
  const r = n === 2 ? ' r' : '', g = '[Channel' + n + ']';
  return `<div class="mw-deck${r}" data-deck="${n}">
    <div class="mw-head"><span class="mw-num" style="background:${DECK_COL[n - 1]}">${n}</span>
      <div class="mw-ti"><b data-f="title">Sin pista</b><span data-f="artist">Arrastra una canción aquí o usa LOAD en la controladora</span></div>
      <span class="mw-st" data-f="st"></span>
      <span class="mw-key" data-f="key">—</span>
      <div class="mw-bpm"><b data-f="bpm">—</b><span data-f="pitch">0.00%</span></div>
      <button class="mw-load" data-act="load" title="Cargar la pista seleccionada en la biblioteca">⤓ Cargar</button></div>
    <div class="mw-ov"><canvas></canvas><div class="mw-time"><span data-f="el">0:00.0</span><span data-f="rem">-0:00.0</span></div></div>
    <div class="mw-jog"><canvas width="300" height="300"></canvas></div>
    <div class="mw-tr">
      <button class="mw-big cue" data-g="${g}" data-k="cue_default" data-mode="push" data-led="cue_indicator">CUE</button>
      <button class="mw-big play" data-g="${g}" data-k="play" data-mode="toggle" data-led="play_indicator">▶︎❚❚</button>
      <button class="mw-sm g" data-g="${g}" data-k="sync_enabled" data-mode="toggle" title="Sincroniza tempo y golpe con la bandeja MASTER y se queda así (el tono no cambia con MT)">SYNC</button>
      <button class="mw-sm y" data-g="${g}" data-k="sync_leader" data-mode="toggle" title="Esta bandeja manda el tempo">MASTER</button>
      <button class="mw-sm" data-g="${g}" data-k="quantize" data-mode="toggle" title="Cues y loops caen justo en el golpe">Q</button>
      <button class="mw-sm" data-g="${g}" data-k="slip_enabled" data-mode="toggle" title="Slip: al soltar un loop o un scratch, la pista sigue donde iba" hidden>SLIP</button>
    </div>
    <div class="mw-pads">
      <div class="mw-modes"><button data-pm="hot" class="on">HOT CUE</button><button data-pm="loop">BEAT LOOP</button><button data-pm="jump">BEAT JUMP</button><button data-pm="smp">SAMPLER</button></div>
      <div class="mw-grid">${[0,1,2,3,4,5,6,7].map(i => `<button class="mw-pad" data-pad="${i}"><span></span><i></i></button>`).join('')}</div>
      <div class="mw-row">
        <button class="mw-sm" data-g="${g}" data-k="loop_in" data-mode="push">IN</button>
        <button class="mw-sm" data-g="${g}" data-k="loop_out" data-mode="push">OUT</button>
        <button class="mw-sm g" data-g="${g}" data-k="reloop_toggle" data-mode="push" data-led="loop_enabled">RELOOP/EXIT</button>
        <button class="mw-sm" data-g="${g}" data-k="loop_halve" data-mode="push">½</button>
        <span class="mw-lsz" data-f="lsz">4</span>
        <button class="mw-sm" data-g="${g}" data-k="loop_double" data-mode="push">2×</button>
        <button class="mw-sm" data-g="${g}" data-k="beatloop_activate" data-mode="push" title="Loop automático del tamaño elegido">AUTO</button>
      </div>
      <div class="mw-row">
        <button class="mw-sm" data-act="mem-1" title="Memory cue anterior (CUE/LOOP CALL ◀)">◀ MEM</button>
        <button class="mw-sm" data-act="mem+1" title="Memory cue siguiente (CUE/LOOP CALL ▶)">MEM ▶</button>
        <button class="mw-sm" data-act="memadd" title="Guardar un memory cue aquí">+ MEMORY</button>
        <button class="mw-sm" data-act="memdel" title="Borrar el memory cue de esta posición">BORRAR</button>
        <button class="mw-sm" data-g="${g}" data-k="keylock" data-mode="toggle" title="Master Tempo: cambia el tempo sin cambiar el tono">MT</button>
        <button class="mw-sm" data-act="analyze" title="Volver a analizar BPM y grilla (rango y modo en Ajustes)">ANALIZAR</button>
      </div>
    </div>
    <div class="mw-tempo">
      <button class="mw-sm" data-act="range" title="Rango del pitch">±10%</button>
      <div class="mw-fd" data-g="${g}" data-k="rate" data-tempo="1"><i class="c"></i><b></b></div>
      <div class="mw-tv" data-f="tv">0.0%</div>
      <button class="mw-sm" data-act="reset-rate" title="Volver al tempo original">0</button>
    </div>
  </div>`;
}
function stripHTML(n){
  const g = '[Channel' + n + ']', eq = '[EqualizerRack1_' + g + '_Effect1]', q = '[QuickEffectRack1_' + g + ']';
  const k = (lab, gg, kk, f) => `<div class="mw-k"><div class="mw-knob${f ? ' f' : ''}" title="${lab}" data-g="${gg}" data-k="${kk}" style="--fc:${DECK_COL[n - 1]}"></div>${lab}</div>`;
  return `<div class="mw-strip${n === 2 ? ' r' : ''}">
    <div class="mw-kcol">${k('TRIM', g, 'pregain')}${k('HI', eq, 'parameter3')}${k('MID', eq, 'parameter2')}${k('LOW', eq, 'parameter1')}${k('FILTER', q, 'super1', true)}</div>
    <div class="mw-vu" data-vu="${n}"><i></i></div>
    <div class="mw-fcol"><button class="mw-cue" data-g="${g}" data-k="pfl" data-mode="toggle">CUE 🎧</button><div class="mw-fd" data-g="${g}" data-k="volume"><b></b></div></div>
  </div>`;
}
const HTML = () => `<div class="mw" id="mesa" hidden role="dialog" aria-label="Mesa Web">
  <div class="mw-grip" id="mwGrip" title="Arrastra hacia arriba para ver más canciones, o hacia abajo para ver más público"><i></i></div>
  <header class="mw-top">
    <span class="mw-logo">MESA WEB</span>
    <span class="mw-pill" id="mwCtl"><i></i><span>Sin controladora</span></span>
    <span class="mw-pill" id="mwRoom" title="Lo que suena en el master llega a la sala (luces, baile y transmisión)"><i></i><span>La sala escucha el master</span></span>
    <label class="mw-pill mw-fo" title="Por dónde sale el master">🔊 <select id="mwOut"><option value="">Salida del sistema</option></select></label>
    <label class="mw-pill mw-fo" title="Por dónde salen los audífonos (CUE)">🎧 <select id="mwHp"><option value="">Audífonos…</option></select></label>
    <span class="mw-sp"></span>
    <button class="mw-tb mw-dk" id="mwLibT" title="Mostrar u ocultar la biblioteca">📚 Biblioteca</button>
    <button class="mw-tb" id="mwView" title="Cambiar entre la mesa en pantalla completa y la mesa abajo con la sala arriba">▭ Vista mesa</button>
    <button class="mw-tb" id="mwSetB" title="Ajustes">⚙︎ Ajustes</button>
    <button class="mw-tb" id="mwMin" title="Ver la sala; la mesa sigue sonando">▾ Ver la sala</button>
    <button class="mw-tb" id="mwOff" title="Detener la Mesa Web y devolver el audio a la sala">⏻ Apagar</button>
  </header>
  <section class="mw-waves"><canvas id="mwW1"></canvas><canvas id="mwW2"></canvas><div class="mw-zoom"><span id="mwZoomT" hidden></span><button id="mwZo" title="Alejar (SHIFT + girar BROWSE en la DDJ-400)">−</button><button id="mwZi" title="Acercar (SHIFT + girar BROWSE en la DDJ-400)">+</button></div></section>
  <section class="mw-main">${deckHTML(1)}
    <div class="mw-mix">${stripHTML(1)}
      <div class="mw-ctr">
        <div class="mw-box fx"><h4>BEAT FX</h4>
          <div class="mw-fxn"><button data-fx="prev">◀</button><b id="mwFxN">Echo</b><button data-fx="next">▶</button></div>
          <div class="mw-fxn"><button data-fx="b-">◀</button><b id="mwFxB">1/2</b><button data-fx="b+">▶</button></div>
          <div class="mw-kr"><div class="mw-k"><div class="mw-knob" id="mwFxMix"></div>LEVEL/DEPTH</div></div>
          <div class="mw-ch"><button data-fxt="1">1</button><button data-fxt="2">2</button><button data-fxt="m">M</button></div>
          <button class="mw-fxon" id="mwFxOn">ON / OFF</button></div>
        <div class="mw-box hp"><h4>AUDÍFONOS</h4><div class="mw-kr"><div class="mw-k"><div class="mw-knob" data-g="[Master]" data-k="headMix"></div>MIX</div><div class="mw-k"><div class="mw-knob" data-g="[Master]" data-k="headGain"></div>LEVEL</div></div></div>
        <div class="mw-box ms"><h4>MASTER</h4><div class="mw-k"><div class="mw-knob" data-g="[Master]" data-k="gain"></div>LEVEL</div><div class="mw-mvu"><div class="mw-vu" data-vu="ml"><i></i></div></div></div>
      </div>
      ${stripHTML(2)}
      <div class="mw-xf">1<div class="mw-fd h" data-g="[Master]" data-k="crossfader"><i class="c" style="left:50%;right:auto;top:3px;bottom:3px;width:1px;height:auto"></i><b></b></div>2</div>
    </div>
  ${deckHTML(2)}</section>
  <section class="mw-lib">
    <div class="mw-tree" id="mwTree"></div>
    <div class="mw-lr">
      <div class="mw-bar">
        <label class="mw-tb pri" title="En rekordbox: Archivo → Exportar colección en formato xml">📥 Importar XML de rekordbox<input type="file" id="mwXml" accept=".xml,text/xml,application/xml" hidden></label>
        <button class="mw-tb" id="mwDir">📁 Carpeta de música</button>
        <button class="mw-tb" id="mwPerm" hidden>🔓 Volver a abrir «<span></span>»</button>
        <select class="mw-dk" id="mwSrc" aria-label="Lista"></select>
        <label class="mw-tb mw-fo" title="Agregar canciones sueltas">＋ Canciones<input type="file" id="mwFiles" accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.aiff,.aif,.ogg" multiple hidden></label>
        <input type="search" id="mwQ" placeholder="Buscar título, artista, género, BPM o tono" aria-label="Buscar en la biblioteca">
        <select id="mwSort" aria-label="Ordenar"><option value="">Orden de la lista</option><option value="fileName">Nombre del archivo (A-Z)</option><option value="title">Título</option><option value="artist">Artista</option><option value="bpm">BPM</option><option value="key">Tono</option><option value="genre">Género</option></select>
        <button class="mw-tb" id="mwAna" title="Analiza BPM y grilla de las canciones de esta lista que todavía no los tienen">📈 Analizar</button>
        <button class="mw-tb mw-fo" id="mwExp" title="Descarga un XML para importar en rekordbox con los cues y la grilla que hiciste aquí">📤 Exportar XML</button>
        <small class="mw-fo" id="mwLibInfo"></small>
      </div>
      <div class="mw-list" id="mwList" tabindex="0"></div>
    </div>
  </section>
</div>
<div class="mw-mini" id="mwMini" hidden><b>MESA WEB</b><span id="mwMini1"></span><span id="mwMini2"></span><button class="mw-tb pri" id="mwMax">▴ Abrir la mesa</button></div>
<div class="mw-set" id="mwSet" hidden></div>`;

/* ---------- arranque de la interfaz ---------- */
let root, built = false, waveZoom = 8, padMode = ['hot', 'hot'], toastT = 0;
const binds = new Map();       // id de control → [{el, kind}]
function bind(el, g, k, kind){ const id = g + ',' + k; if (!binds.has(id)) binds.set(id, []); binds.get(id).push({el, kind}); }
MW.toast = function(text, warn){
  let t = $('.mw-toast'); if (!t){ t = document.createElement('div'); t.className = 'mw-toast'; document.body.appendChild(t); }
  t.textContent = text; t.classList.toggle('warn', !!warn); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, warn ? 7000 : 4200);
};
MW.buildUI = function(){
  if (built) return; built = true;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const wrap = document.createElement('div'); wrap.innerHTML = HTML(); while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
  root = $('#mesa');
  // perillas
  for (const el of $$('.mw-knob[data-g]', root)) setupKnob(el, el.dataset.g, el.dataset.k);
  setupKnobFx($('#mwFxMix'));
  for (const el of $$('.mw-fd[data-g]', root)) setupFader(el, el.dataset.g, el.dataset.k);
  for (const el of $$('button[data-g]', root)) setupButton(el);
  for (const dk of $$('.mw-deck', root)) setupDeck(dk);
  setupFx(); setupLib(); setupTop();
  for (let i = 0; i < 2; i++) setupWave($('#mwW' + (i + 1)), i);
  window.addEventListener('resize', () => { for (const d of MW.decks) d.ovImg = null; });
  requestAnimationFrame(frame);
};
function setupKnob(el, g, k){
  bind(el, g, k, 'knob');
  let y0 = 0, p0 = 0;
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); y0 = e.clientY; p0 = MW.getParameter(g, k); e.preventDefault(); });
  el.addEventListener('pointermove', e => { if (!el.hasPointerCapture(e.pointerId)) return; const p = clamp(p0 + (y0 - e.clientY) / (e.shiftKey ? 600 : 160), 0, 1); MW.setParameter(g, k, p, 'ui'); });
  el.addEventListener('dblclick', () => MW.reset(g, k));
  el.addEventListener('wheel', e => { e.preventDefault(); MW.setParameter(g, k, clamp(MW.getParameter(g, k) - Math.sign(e.deltaY) * 0.02, 0, 1), 'ui'); }, {passive:false});
  drawKnob(el, MW.getParameter(g, k), g, k);
}
function drawKnob(el, p, g, k){ el.style.setProperty('--a', ((p - 0.5) * 270).toFixed(1) + 'deg'); if (el.classList.contains('f')) el.classList.toggle('act', Math.abs(p - 0.5) > 0.02); }
function setupKnobFx(el){
  let y0 = 0, p0 = 0;
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); y0 = e.clientY; p0 = MW.A.fx.state.mix; });
  el.addEventListener('pointermove', e => { if (!el.hasPointerCapture(e.pointerId)) return; MW.A.fx.setMix(clamp(p0 + (y0 - e.clientY) / 160, 0, 1)); });
  el.addEventListener('wheel', e => { e.preventDefault(); MW.A.fx.setMix(clamp(MW.A.fx.state.mix - Math.sign(e.deltaY) * 0.03, 0, 1)); }, {passive:false});
}
function setupFader(el, g, k){
  bind(el, g, k, 'fader');
  const h = el.classList.contains('h'), inv = el.dataset.inv === '1';
  const at = e => { const r = el.getBoundingClientRect(); let p = h ? (e.clientX - r.left - 8) / (r.width - 16) : 1 - (e.clientY - r.top - 7) / (r.height - 14); p = clamp(p, 0, 1); return inv ? 1 - p : p; };
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); MW.setParameter(g, k, at(e), 'ui'); e.preventDefault(); });
  el.addEventListener('pointermove', e => { if (el.hasPointerCapture(e.pointerId)) MW.setParameter(g, k, at(e), 'ui'); });
  el.addEventListener('dblclick', () => MW.reset(g, k));
  drawFader(el, MW.getParameter(g, k));
}
function drawFader(el, p){
  const b = el.firstElementChild && el.firstElementChild.tagName === 'B' ? el.firstElementChild : $('b', el);
  if (el.dataset.inv === '1') p = 1 - p;
  if (el.classList.contains('h')) b.style.left = 'calc(8px + ' + (p * 100).toFixed(2) + '% - ' + (p * 16).toFixed(2) + 'px)';
  else b.style.top = 'calc(7px + ' + ((1 - p) * 100).toFixed(2) + '% - ' + ((1 - p) * 14).toFixed(2) + 'px)';
}
function setupButton(el){
  const g = el.dataset.g, k = el.dataset.k, mode = el.dataset.mode, led = el.dataset.led || k;
  bind(el, g, led, 'led');
  let longT = 0;
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    if (mode === 'toggle') MW.setValue(g, k, MW.getValue(g, k) > 0 ? 0 : 1, 'ui');
    else if (el.dataset.long && MW.getValue(g, el.dataset.long) > 0){ MW.setValue(g, el.dataset.long, 0, 'ui'); el.__skip = true; }
    else { MW.setValue(g, k, 1, 'ui'); if (el.dataset.long){ longT = setTimeout(() => { longT = 0; MW.setValue(g, el.dataset.long, MW.getValue(g, el.dataset.long) > 0 ? 0 : 1, 'ui'); }, 600); } }
  });
  const up = () => { if (el.__skip){ el.__skip = false; return; } if (mode !== 'toggle') MW.setValue(g, k, 0, 'ui'); if (longT){ clearTimeout(longT); longT = 0; } };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.classList.toggle('on', MW.getValue(g, led) > 0);
}

/* ---------- bandejas ---------- */
const RANGES = [0.06, 0.10, 0.16, 0.25, 0.5, 1];
function setupDeck(el){
  const n = +el.dataset.deck, d = MW.decks[n - 1], g = d.g;
  d.ui = el;
  el.querySelector('[data-act=load]').addEventListener('click', () => { if (d.playing()) return MW.toast('La bandeja ' + n + ' está sonando: ponla en pausa para cargar otra.', true); d.load(MW.lib.selected()); });
  el.querySelector('[data-act=range]').addEventListener('click', () => { const r = MW.getValue(g, 'rateRange'); const i = RANGES.findIndex(x => Math.abs(x - r) < 1e-6); MW.setValue(g, 'rateRange', RANGES[(i + 1) % RANGES.length]); });
  el.querySelector('[data-act=reset-rate]').addEventListener('click', () => MW.setValue(g, 'rate', 0));
  el.querySelector('[data-act="mem-1"]').addEventListener('click', () => d.memJump(-1));
  el.querySelector('[data-act="mem+1"]').addEventListener('click', () => d.memJump(1));
  el.querySelector('[data-act=memadd]').addEventListener('click', () => d.addMemory());
  el.querySelector('[data-act=memdel]').addEventListener('click', () => d.delMemory());
  el.querySelector('[data-act=analyze]').addEventListener('click', () => d.reanalyze());
  bind(el, g, 'rateRange', 'range'); bind(el, g, 'beatloop_size', 'lsz');
  for (const b of $$('.mw-modes button', el)) b.addEventListener('click', () => { padMode[n - 1] = b.dataset.pm; drawPads(d); });
  for (const p of $$('.mw-pad', el)){
    const i = +p.dataset.pad;
    const down = e => {
      e.preventDefault(); p.setPointerCapture(e.pointerId); p.classList.add('hit');
      const m = padMode[n - 1];
      if (m === 'hot') MW.setValue(g, 'hotcue_' + (i + 1) + (e.shiftKey || e.button === 2 ? '_clear' : '_activate'), 1, 'ui');
      else if (m === 'loop') MW.setValue(g, 'beatloop_' + ['0.25','0.5','1','2','4','8','16','32'][i] + '_toggle', 1, 'ui');
      else if (m === 'jump') MW.setValue(g, 'beatjump', [-1, 1, -2, 2, -4, 4, -8, 8][i] * (d.jumpMul || 1), 'ui');
      else { const s = '[Sampler' + (i + 1 + (n - 1) * 8) + ']'; MW.setValue(s, (e.shiftKey || e.button === 2) ? 'cue_gotoandstop' : 'cue_gotoandplay', 1, 'ui'); }
    };
    const up = () => { p.classList.remove('hit'); const m = padMode[n - 1]; if (m === 'hot'){ MW.setValue(g, 'hotcue_' + (i + 1) + '_activate', 0, 'ui'); MW.setValue(g, 'hotcue_' + (i + 1) + '_clear', 0, 'ui'); } };
    p.addEventListener('pointerdown', down); p.addEventListener('pointerup', up); p.addEventListener('pointercancel', up);
    p.addEventListener('contextmenu', e => e.preventDefault());
  }
  // arrastrar una pista de la biblioteca (o un archivo) a la bandeja
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop'); });
  el.addEventListener('dragleave', () => el.classList.remove('drop'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('drop');
    if (d.playing()) return MW.toast('La bandeja ' + n + ' está sonando: ponla en pausa para cargar otra.', true);
    const id = e.dataTransfer.getData('text/x-mesa');
    if (id){ d.load(MW.lib.byId.get(id)); return; }
    const fs = [...(e.dataTransfer.files || [])]; if (fs.length){ MW.lib.addFiles(fs); const t = MW.lib.tracks.find(x => x.fname === fs[0].name.toLowerCase()); if (t) d.load(t); }
  });
  setupJog(el.querySelector('.mw-jog canvas'), d);
  const ov = el.querySelector('.mw-ov');
  ov.addEventListener('pointerdown', e => { if (!d.L) return; const r = ov.getBoundingClientRect(); d.seek(clamp((e.clientX - r.left) / r.width, 0, 1) * d.dur); });
  drawPads(d);
}
function setupJog(cv, d){
  let last = null, touching = false;
  const ang = e => { const r = cv.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2); };
  cv.addEventListener('pointerdown', e => { if (!d.L) return; cv.setPointerCapture(e.pointerId); last = ang(e); touching = true; MW.scratchEnable(d.n, 720, 33.333); e.preventDefault(); });
  cv.addEventListener('pointermove', e => { if (!touching) return; const a = ang(e); let da = a - last; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; last = a; MW.scratchTick(d.n, da / (2 * Math.PI) * 720); });
  const up = () => { if (!touching) return; touching = false; MW.scratchDisable(d.n); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); if (!d.L) return; MW.setValue(d.g, 'jog', -Math.sign(e.deltaY) * (e.shiftKey ? 30 : 3), 'ui'); }, {passive:false});
}
function drawJog(d){
  const cv = d.ui.querySelector('.mw-jog canvas'), c = cv.getContext('2d'), W = 300, R = 140;
  c.clearRect(0, 0, W, W);
  const col = DECK_COL[d.n - 1], p = d.pos(), a = (p / 1.8) * Math.PI * 2 - Math.PI / 2;
  const gr = c.createRadialGradient(150, 130, 20, 150, 150, R); gr.addColorStop(0, '#3a3546'); gr.addColorStop(1, '#141219');
  c.fillStyle = gr; c.beginPath(); c.arc(150, 150, R, 0, 7); c.fill();
  c.strokeStyle = '#000'; c.lineWidth = 4; c.stroke();
  // anillo de progreso de la pista
  if (d.L){ c.strokeStyle = col; c.lineWidth = 7; c.globalAlpha = 0.9; c.beginPath(); c.arc(150, 150, R - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p / d.dur)); c.stroke(); c.globalAlpha = 1; }
  for (let i = 0; i < 60; i++){ const t = i / 60 * Math.PI * 2; c.strokeStyle = i % 5 ? '#2d2938' : '#4a4558'; c.lineWidth = 2; c.beginPath(); c.moveTo(150 + Math.cos(t) * (R - 14), 150 + Math.sin(t) * (R - 14)); c.lineTo(150 + Math.cos(t) * (R - 22), 150 + Math.sin(t) * (R - 22)); c.stroke(); }
  c.strokeStyle = d.scratching ? '#fff' : col; c.lineWidth = 6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(150 + Math.cos(a) * 40, 150 + Math.sin(a) * 40); c.lineTo(150 + Math.cos(a) * (R - 26), 150 + Math.sin(a) * (R - 26)); c.stroke();
  c.fillStyle = '#0d0c12'; c.beginPath(); c.arc(150, 150, 46, 0, 7); c.fill();
  c.fillStyle = '#e9e6f0'; c.font = '700 22px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(d.L ? MW.fmtTime(d.dur - p).replace(/\.\d$/, '') : '—', 150, 142);
  c.font = '600 14px system-ui'; c.fillStyle = '#9e97b0'; c.fillText(d.L && d.grid ? 'compás ' + (Math.floor(MW.beatAt(d.grid, p) / 4) + 1) : '', 150, 166);
}
function drawPads(d){
  const el = d.ui, m = padMode[d.n - 1];
  for (const b of $$('.mw-modes button', el)) b.classList.toggle('on', b.dataset.pm === m);
  $$('.mw-pad', el).forEach((p, i) => {
    let lab = '', sub = '', bg = '', set = false;
    if (m === 'hot'){ const c = d.hot[i]; lab = 'ABCDEFGH'[i]; if (c){ set = true; bg = c.color || MW.HOT_COLORS[i]; sub = c.name || (c.type === 4 ? 'LOOP ' : '') + MW.fmtTime(c.t).replace(/\.\d$/, ''); } }
    else if (m === 'loop'){ const s = ['1/4','1/2','1','2','4','8','16','32'][i], v = [0.25,0.5,1,2,4,8,16,32][i]; lab = s; sub = 'golpes'; if (d.loop.on && Math.abs(d.loop.beats - v) < 1e-6){ set = true; bg = '#5fe0a0'; } }
    else if (m === 'jump'){ const v = [-1, 1, -2, 2, -4, 4, -8, 8][i] * (d.jumpMul || 1); lab = (v > 0 ? '▶ ' : '◀ ') + Math.abs(v); sub = 'golpes'; }
    else { const s = MW.samplers[i + (d.n - 1) * 8]; lab = s ? s.name : ''; sub = 'sampler'; if (s && MW.getValue(s.g, 'play')){ set = true; bg = '#c33fff'; } }
    p.classList.toggle('set', set); p.style.background = set ? bg : ''; p.firstElementChild.textContent = lab; p.lastElementChild.textContent = sub;
  });
}
MW.emitDeck = d => { if (!built || !d.ui) return; d.ovImg = null; drawPads(d); drawHead(d); };
function drawHead(d){
  const el = d.ui, t = d.track;
  el.querySelector('[data-f=title]').textContent = t ? t.title : 'Sin pista';
  el.querySelector('[data-f=artist]').textContent = t ? (t.artist || '—') + (t.genre ? ' · ' + t.genre : '') : 'Arrastra una canción aquí o usa LOAD en la controladora';
  el.querySelector('[data-f=key]').textContent = t && t.key ? t.key : '—';
}

/* ---------- formas de onda ---------- */
function fitCanvas(cv){ const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr)); if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; } return [w, h, dpr]; }
function setupWave(cv, i){
  // arrastrar la onda = mover la pista (como tocar el plato con la pista en pausa)
  let x0 = null;
  cv.addEventListener('pointerdown', e => { const d = MW.decks[i]; if (!d.L) return; cv.setPointerCapture(e.pointerId); x0 = e.clientX; MW.scratchEnable(d.n, 720, 33.333); });
  cv.addEventListener('pointermove', e => { if (x0 == null) return; const d = MW.decks[i]; const r = cv.getBoundingClientRect(); const ds = -(e.clientX - x0) / r.width * waveZoom; x0 = e.clientX; MW.scratchTick(d.n, ds / d.scratchK); });
  const up = () => { if (x0 == null) return; x0 = null; MW.scratchDisable(i + 1); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); MW.waveZoomBy(e.deltaY > 0 ? 1 : -1); }, {passive:false});
}
function drawWave(i){
  const cv = $('#mwW' + (i + 1)), [W, H, dpr] = fitCanvas(cv), c = cv.getContext('2d'), d = MW.decks[i], col = DECK_COL[i];
  c.fillStyle = '#050507'; c.fillRect(0, 0, W, H);
  if (!d.L || !d.wave){ c.fillStyle = '#3a3449'; c.font = (12 * dpr) + 'px system-ui'; c.fillText('Bandeja ' + d.n + ' · sin pista', 10 * dpr, H / 2 + 4 * dpr); return; }
  // la onda corre en tiempo real: con el pitch cambiado, los golpes de las dos bandejas quedan alineados
  const wv = d.wave, p = d.pos(), sec = waveZoom * (W / dpr) / 1400 * Math.max(0.05, d.tempo()), spp = sec / W, mid = H / 2;
  const t0 = p - W / 2 * spp;
  // loop activo
  // loops guardados (hot cues y memory loops de rekordbox): franja fina abajo
  for (const q of [...d.hot.filter(Boolean), ...d.mem]){ if (q.type === 4 && q.end > q.t){ const xa = (q.t - t0) / spp, xb = (q.end - t0) / spp; if (xb > 0 && xa < W){ c.fillStyle = q.color || 'rgba(255,170,0,.55)'; c.globalAlpha = 0.55; c.fillRect(xa, H - 4 * dpr, xb - xa, 4 * dpr); c.globalAlpha = 1; } } }
  // loop activo: zona marcada de punta a punta, con líneas IN y OUT
  if (d.loop.b > d.loop.a){
    const xa = (d.loop.a - t0) / spp, xb = (d.loop.b - t0) / spp;
    if (xb > 0 && xa < W){
      c.fillStyle = d.loop.on ? 'rgba(255,170,0,.24)' : 'rgba(255,170,0,.07)'; c.fillRect(xa, 0, xb - xa, H);
      c.fillStyle = d.loop.on ? '#ffb000' : 'rgba(255,176,0,.45)';
      c.fillRect(xa - dpr, 0, 2 * dpr, H); c.fillRect(xb - dpr, 0, 2 * dpr, H);
      if (d.loop.on){ c.font = '800 ' + (9 * dpr) + 'px system-ui'; c.fillText('IN', xa + 3 * dpr, H - 6 * dpr); c.fillText('OUT', xb - 22 * dpr, H - 6 * dpr); if (d.loop.beats){ const lab = 'LOOP ' + fracTxt(d.loop.beats); c.fillText(lab, Math.max(xa + 3 * dpr, Math.min(xb - 60 * dpr, (xa + xb) / 2 - 18 * dpr)), 11 * dpr); } }
    }
  }
  const step = Math.max(1, Math.floor(dpr));
  for (let x = 0; x < W; x += step){
    const t = t0 + x * spp; if (t < 0 || t > d.dur) continue;
    const a = Math.floor(t * wv.rate), b = Math.max(a + 1, Math.floor((t + spp * step) * wv.rate));
    let lo = 0, mi = 0, hi = 0;
    for (let k = a; k < b && k < wv.n; k++){ if (wv.lo[k] > lo) lo = wv.lo[k]; if (wv.mid[k] > mi) mi = wv.mid[k]; if (wv.hi[k] > hi) hi = wv.hi[k]; }
    const past = t < p;
    let h = lo / 255 * mid * 0.95; c.fillStyle = past ? '#123a8c' : '#2a6cff'; c.fillRect(x, mid - h, step, h * 2);
    h = mi / 255 * mid * 0.8; c.fillStyle = past ? '#7a4a12' : '#ffa53a'; c.fillRect(x, mid - h, step, h * 2);
    h = hi / 255 * mid * 0.6; c.fillStyle = past ? '#8a8a8a' : '#ffffff'; c.fillRect(x, mid - h, step, h * 2);
  }
  // grilla de golpes (el primero del compás en rojo, como en rekordbox)
  if (d.grid){
    const b0 = Math.ceil(MW.beatAt(d.grid, Math.max(0, t0))), b1 = MW.beatAt(d.grid, t0 + W * spp);
    for (let b = b0; b <= b1; b++){ const x = (MW.timeOfBeat(d.grid, b) - t0) / spp; const db = MW.isDownbeat(d.grid, b); c.fillStyle = db ? 'rgba(255,60,60,.85)' : 'rgba(255,255,255,.28)'; c.fillRect(x, 0, db ? 2 * dpr : 1, db ? H : H * 0.18); if (!db) c.fillRect(x, H * 0.82, 1, H * 0.18); }
  }
  const mark = (t, color, label, top) => { const x = (t - t0) / spp; if (x < -20 || x > W + 20) return; c.fillStyle = color; c.beginPath(); if (top){ c.moveTo(x - 6 * dpr, 0); c.lineTo(x + 6 * dpr, 0); c.lineTo(x, 8 * dpr); } else { c.moveTo(x - 6 * dpr, H); c.lineTo(x + 6 * dpr, H); c.lineTo(x, H - 8 * dpr); } c.fill(); c.fillRect(x, 0, 1, H); if (label){ c.font = '700 ' + (10 * dpr) + 'px system-ui'; c.fillText(label, x + 3 * dpr, top ? 18 * dpr : H - 10 * dpr); } };
  for (const m of d.mem) mark(m.t, '#ff3b30', '', false);
  d.hot.forEach((h, k) => { if (h) mark(h.t, h.color || MW.HOT_COLORS[k], 'ABCDEFGH'[k], true); });
  mark(d.cuePt, '#ffa000', '', false);
  c.fillStyle = '#ff2a2a'; c.fillRect(W / 2 - dpr, 0, 2 * dpr, H);
  c.fillStyle = col; c.font = '700 ' + (11 * dpr) + 'px system-ui'; c.fillText(String(d.n), 6 * dpr, 14 * dpr);
}
function drawOverview(d){
  const cv = d.ui.querySelector('.mw-ov canvas'), [W, H, dpr] = fitCanvas(cv), c = cv.getContext('2d');
  if (!d.L || !d.wave){ c.fillStyle = '#09080c'; c.fillRect(0, 0, W, H); return; }
  if (!d.ovImg || d.ovImg.width !== W || d.ovImg.height !== H){
    const o = d.ovImg = document.createElement('canvas'); o.width = W; o.height = H; const oc = o.getContext('2d'), wv = d.wave, mid = H / 2;
    oc.fillStyle = '#09080c'; oc.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x++){
      const a = Math.floor(x / W * wv.n), b = Math.max(a + 1, Math.floor((x + 1) / W * wv.n)); let lo = 0, mi = 0, hi = 0;
      for (let k = a; k < b; k++){ if (wv.lo[k] > lo) lo = wv.lo[k]; if (wv.mid[k] > mi) mi = wv.mid[k]; if (wv.hi[k] > hi) hi = wv.hi[k]; }
      let h = lo / 255 * mid; oc.fillStyle = '#2a6cff'; oc.fillRect(x, mid - h, 1, h * 2);
      h = mi / 255 * mid * 0.8; oc.fillStyle = '#ffa53a'; oc.fillRect(x, mid - h, 1, h * 2);
      h = hi / 255 * mid * 0.55; oc.fillStyle = '#fff'; oc.fillRect(x, mid - h, 1, h * 2);
    }
  }
  c.drawImage(d.ovImg, 0, 0);
  const p = d.pos() / d.dur;
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, p * W, H);
  if (d.loop.b > d.loop.a){ c.fillStyle = d.loop.on ? 'rgba(255,170,0,.35)' : 'rgba(255,170,0,.15)'; c.fillRect(d.loop.a / d.dur * W, 0, Math.max(2, (d.loop.b - d.loop.a) / d.dur * W), H); }
  for (const q of [...d.hot.filter(Boolean), ...d.mem]){ if (q.type === 4 && q.end > q.t){ c.fillStyle = q.color || '#ffaa00'; c.globalAlpha = 0.7; c.fillRect(q.t / d.dur * W, H - 3 * dpr, Math.max(2, (q.end - q.t) / d.dur * W), 3 * dpr); c.globalAlpha = 1; } }
  for (const m of d.mem){ c.fillStyle = '#ff3b30'; c.fillRect(m.t / d.dur * W, H - 6 * dpr, 2 * dpr, 6 * dpr); }
  d.hot.forEach((h, k) => { if (h){ c.fillStyle = h.color || MW.HOT_COLORS[k]; c.fillRect(h.t / d.dur * W - dpr, 0, 2 * dpr, 7 * dpr); } });
  c.fillStyle = '#fff'; c.fillRect(p * W - dpr, 0, 2 * dpr, H);
  // aviso de final de pista (los últimos 30 s parpadean)
  if (d.playing() && d.dur - d.pos() < 30 && MW.blink){ c.strokeStyle = '#ff3b30'; c.lineWidth = 3 * dpr; c.strokeRect(0, 0, W, H); }
}

/* ---------- efectos ---------- */
function setupFx(){
  const F = () => MW.A.fx;
  for (const b of $$('[data-fx]', root)) b.addEventListener('click', () => { const a = b.dataset.fx; if (a === 'next') F().next(1); else if (a === 'prev') F().next(-1); else F().beat(a === 'b+' ? 1 : -1); });
  for (const b of $$('[data-fxt]', root)) b.addEventListener('click', () => F().setTarget(b.dataset.fxt));
  $('#mwFxOn').addEventListener('click', () => { F().toggle(); MW.onFxLight && MW.onFxLight(); });
  MW.emitFx();
}
const fracTxt = b => b >= 1 ? String(b) : ({0.125:'1/8', 0.25:'1/4', 0.5:'1/2', 0.75:'3/4', 0.0625:'1/16'})[b] || b.toFixed(2);
MW.emitFx = function(){
  if (!built || !MW.A.fx) return; const F = MW.A.fx, L = F.label();
  $('#mwFxN').textContent = L.name; $('#mwFxB').textContent = fracTxt(L.beats) + (L.name === 'Reverb' ? '' : ' golpe' + (L.beats > 1 ? 's' : ''));
  $('#mwFxOn').classList.toggle('on', F.state.enabled);
  for (const b of $$('[data-fxt]', root)) b.classList.toggle('on', b.dataset.fxt === F.state.target);
  drawKnob($('#mwFxMix'), F.state.mix);
};

/* ---------- biblioteca ---------- */
const ROW = 26;
function setupLib(){
  const L = MW.lib;
  $('#mwXml').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; await L.importXml(await f.text(), f.name); e.target.value = ''; });
  $('#mwDir').addEventListener('click', () => L.pickFolder());
  $('#mwPerm').addEventListener('click', () => L.regrant());
  $('#mwFiles').addEventListener('change', e => { const n = L.addFiles([...e.target.files]); MW.toast(n + ' canciones agregadas.'); e.target.value = ''; });
  $('#mwExp').addEventListener('click', () => { if (!L.tracks.length) return MW.toast('La biblioteca está vacía.', true); L.exportXml(); MW.toast('Listo: en rekordbox ve a Preferencias → Avanzado → Base de datos → rekordbox xml, elige este archivo y arrastra las pistas desde «rekordbox xml» a tu colección.'); });
  $('#mwSort').addEventListener('change', e => { L.sortKey = e.target.value || null; L.sortDir = 1; L.changed(); });
  $('#mwAna').addEventListener('click', () => L.analyzeList());
  let qT = 0; $('#mwQ').addEventListener('input', e => { clearTimeout(qT); qT = setTimeout(() => { L.query = e.target.value; L.sel = 0; L.changed(); }, 120); });
  const list = $('#mwList');
  list.addEventListener('scroll', () => drawList());
  list.addEventListener('click', e => {
    const h = e.target.closest('.hd [data-s]'); if (h){ const k = h.dataset.s; if (L.sortKey === k) L.sortDir = -L.sortDir; else { L.sortKey = k; L.sortDir = 1; } L.changed(); return; }
    const r = e.target.closest('.tr'); if (r){ L.sel = +r.dataset.i; L.focus = 'list'; drawList(); }
  });
  list.addEventListener('dblclick', e => { const r = e.target.closest('.tr'); if (!r) return; L.sel = +r.dataset.i; const d = MW.decks.find(x => !x.playing() && !x.L) || MW.decks.find(x => !x.playing()); if (d) d.load(L.selected()); else MW.toast('Las dos bandejas están sonando.', true); });
  list.addEventListener('dragstart', e => { const r = e.target.closest('.tr'); if (!r) return; const t = L.list[+r.dataset.i]; if (t) e.dataTransfer.setData('text/x-mesa', t.id); });
  list.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown'){ L.move(1); e.preventDefault(); } else if (e.key === 'ArrowUp'){ L.move(-1); e.preventDefault(); }
    else if (e.key === 'PageDown'){ L.move(15); e.preventDefault(); } else if (e.key === 'PageUp'){ L.move(-15); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ const d = MW.decks[e.key === 'ArrowLeft' ? 0 : 1]; if (e.shiftKey && !d.playing()) d.load(L.selected()); }
  });
  $('#mwTree').addEventListener('click', e => { const r = e.target.closest('[data-v]'); if (r) L.setView(r.dataset.v); });
  root.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault(); });
  root.addEventListener('drop', e => { if (e.target.closest('.mw-deck')) return; const fs = [...(e.dataTransfer.files || [])]; if (!fs.length) return; e.preventDefault(); const xml = fs.find(f => /\.xml$/i.test(f.name)); if (xml) xml.text().then(t => L.importXml(t, xml.name)); const au = fs.filter(f => !/\.xml$/i.test(f.name)); if (au.length){ const n = L.addFiles(au); MW.toast(n + ' canciones agregadas.'); } });
  MW.emitLib();
}
MW.emitLib = function(scrollOnly){
  if (!built) return; const L = MW.lib;
  if (!scrollOnly){
    const tree = $('#mwTree'); tree.classList.toggle('focus', L.focus === 'tree');
    tree.innerHTML = L.sources().map(s => s.head ? `<div class="hd">${esc(s.name)}</div>` : s.folder ? `<div class="fo" style="padding-left:${10 + s.depth * 12}px">📂 ${esc(s.name)}</div>` : `<div data-v="${s.id}" class="${s.id === L.view ? 'on' : ''}" style="padding-left:${10 + s.depth * 12}px">${s.id === 'all' ? '🎵' : s.id === 'hist' ? '🕘' : '♫'} ${esc(s.name)}<small>${s.n != null ? s.n : ''}</small></div>`).join('');
    $('#mwSrc').innerHTML = L.sources().filter(x => !x.head && !x.folder).map(x => `<option value="${x.id}"${x.id === L.view ? ' selected' : ''}>${'  '.repeat(Math.max(0, x.depth - 1))}${esc(x.name)}${x.n != null ? ' (' + x.n + ')' : ''}</option>`).join('');
    const xmlN = L.tracks.filter(t => t.src === 'xml').length, have = L.tracks.filter(t => L.hasFile(t)).length;
    $('#mwLibInfo').textContent = (L.xmlName ? L.xmlName + ' · ' : '') + (L.folderName ? '📁 ' + L.folderName + ' · ' : '') + (L.files.size ? have + ' canciones disponibles' + (L.tracks.length > have ? ' (se ocultan ' + (L.tracks.length - have) + ' que no están en la carpeta)' : '') : L.tracks.length + ' canciones: elige la carpeta de música');
    const so = $('#mwSort'); if (so && so.value !== (L.sortKey || '')) so.value = L.sortKey || '';
    const ab = $('#mwAna'); if (ab) ab.textContent = L.analyzing ? '⏹ Analizando ' + L.analyzing + '…' : '📈 Analizar';
    const pb = $('#mwPerm'); pb.hidden = !L.needPerm; if (L.needPerm) pb.querySelector('span').textContent = L.folderName;
    $('#mwDir').classList.toggle('pri', !!xmlN && !L.files.size);
  }
  // que la fila elegida quede a la vista
  const list = $('#mwList'), top = L.sel * ROW, h = list.clientHeight - ROW;
  if (top < list.scrollTop) list.scrollTop = top; else if (top + ROW > list.scrollTop + h) list.scrollTop = top + ROW - h;
  drawList();
};
function drawList(){
  const L = MW.lib, list = $('#mwList');
  if (!L.tracks.length){
    list.innerHTML = `<div class="mw-empty"><b>Tu música de rekordbox, aquí.</b><br>1. En rekordbox: <b>Archivo → Exportar colección en formato xml</b>.<br>2. Toca <b>📥 Importar XML de rekordbox</b> y elige ese archivo: llegan tus pistas con sus BPM, grillas, memory cues, hot cues (con color) y listas.<br>3. Toca <b>📁 Carpeta de música</b> y elige la carpeta donde están las canciones (no se suben a ningún lado: suenan desde tu computador).<br><br>¿Sin rekordbox? Toca <b>＋ Canciones</b> o arrástralas aquí: la Mesa Web mide el BPM sola.</div>`;
    return;
  }
  const sorted = k => L.sortKey === k ? (L.sortDir > 0 ? ' ▲' : ' ▼') : '';
  const hd = `<div class="hd"><span></span><span data-s="fileName">Archivo${sorted('fileName')}</span><span data-s="bpm" class="n">BPM${sorted('bpm')}</span><span data-s="title">Título${sorted('title')}</span><span data-s="artist">Artista${sorted('artist')}</span><span data-s="key">Tono${sorted('key')}</span><span data-s="dur" class="n">Tiempo${sorted('dur')}</span><span data-s="genre">Género${sorted('genre')}</span></div>`;
  const vh = list.clientHeight || 300, s = Math.max(0, Math.floor(list.scrollTop / ROW) - 4), e = Math.min(L.list.length, s + Math.ceil(vh / ROW) + 8);
  let rows = '';
  const loaded = new Set(MW.decks.map(d => d.track && d.track.id));
  for (let i = s; i < e; i++){
    const t = L.list[i], ok = L.hasFile(t);
    rows += `<div class="tr${i === L.sel ? ' on' : ''}${ok ? '' : ' miss'}" data-i="${i}" draggable="true" style="top:${ROW + i * ROW}px" title="${ok ? 'Doble clic para cargar · arrastra a una bandeja' : 'No encuentro el archivo: elige la carpeta de música'}"><span class="mw-dot${ok ? ' ok' : ''}" style="${t.color ? 'background:' + t.color : ''}"></span><span title="${esc(t.path || '')}">${loaded.has(t.id) ? '▶ ' : ''}${esc(t.fileName || t.title)}</span><span class="n">${t.bpm ? t.bpm.toFixed(2) : '—'}</span><span>${esc(t.title)}</span><span>${esc(t.artist)}</span><span>${esc(t.key || '')}</span><span class="n">${t.dur ? MW.fmtTime(t.dur).replace(/\.\d$/, '') : ''}</span><span>${esc(t.genre || '')}</span></div>`;
  }
  list.innerHTML = hd + `<div style="height:${L.list.length * ROW}px"></div>` + rows;
}

/* ---------- barra superior, salidas de audio y ajustes ---------- */
async function listOutputs(){
  let devs = [];
  try { devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput'); } catch(e){}
  const named = devs.some(d => d.label);
  for (const [id, cur, first] of [['#mwOut', MW.A.sink || '', 'Salida del sistema'], ['#mwHp', MW.settings.hpDev || '', MW.A.fourCh ? 'Por la mesa (canales 3-4)' : 'Audífonos: sin salida aparte']]){
    const sel = $(id);
    sel.innerHTML = `<option value="">${first}</option>` + devs.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications').map((d, i) => `<option value="${esc(d.deviceId)}"${d.deviceId === cur ? ' selected' : ''}>${esc(d.label || 'Salida ' + (i + 1))}</option>`).join('') + (named ? '' : '<option value="?">Mostrar los nombres…</option>');
  }
  return devs;
}
MW.listOutputs = listOutputs;
// con una DDJ conectada, se elige sola su tarjeta de sonido (master a los parlantes de la mesa)
MW.autoOutput = async function(){
  if (!MW.settings.autoOut) return;
  const devs = await listOutputs(), names = MW.midi.devices.map(d => d.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const hit = devs.find(d => d.label && d.deviceId !== 'default' && names.some(n => d.label.toLowerCase().replace(/[^a-z0-9]/g, '').includes(n.slice(0, 6))));
  if (hit && MW.A.sink !== hit.deviceId){ if (await MW.setOutput(hit.deviceId)){ MW.toast('Sonido por la ' + hit.label + (MW.A.fourCh ? ': master por MASTER OUT y CUE por los audífonos de la mesa.' : '.')); listOutputs(); } }
};
function setupTop(){
  $('#mwOut').addEventListener('change', async e => {
    if (e.target.value === '?'){ try { const s = await navigator.mediaDevices.getUserMedia({audio:true}); s.getTracks().forEach(t => t.stop()); } catch(err){} listOutputs(); return; }
    if (!await MW.setOutput(e.target.value)) MW.toast('Este navegador no deja elegir la salida de audio. Usa Chrome o Edge.', true);
    listOutputs();
  });
  $('#mwHp').addEventListener('change', async e => {
    if (e.target.value === '?'){ try { const s = await navigator.mediaDevices.getUserMedia({audio:true}); s.getTracks().forEach(t => t.stop()); } catch(err){} listOutputs(); return; }
    MW.settings.hpDev = e.target.value; MW.settings.hpMode = e.target.value ? 'otra' : 'auto'; MW.saveSettings(); MW.route(); listOutputs();
  });
  navigator.mediaDevices && navigator.mediaDevices.addEventListener && navigator.mediaDevices.addEventListener('devicechange', () => { listOutputs(); setTimeout(() => MW.autoOutput(), 800); });
  $('#mwMin').addEventListener('click', () => MW.minimize(true));
  $('#mwView').addEventListener('click', () => MW.setView(MW.settings.view === 'dock' ? 'full' : 'dock'));
  $('#mwLibT').addEventListener('click', () => { MW.settings.dockLib = MW.settings.dockLib === false; MW.saveSettings(); MW.setView(MW.settings.view); });
  $('#mwSrc').addEventListener('change', e => MW.lib.setView(e.target.value));
  new ResizeObserver(() => dockSize()).observe(root);
  // divisor entre la sala y la mesa: arriba = más canciones, abajo = más público
  const grip = $('#mwGrip'); let gy = null, gh = 0;
  grip.addEventListener('pointerdown', e => { grip.setPointerCapture(e.pointerId); grip.classList.add('drag'); gy = e.clientY; gh = MW.settings.dockLib === false ? 0 : $('#mwList').offsetHeight; e.preventDefault(); });
  grip.addEventListener('pointermove', e => {
    if (gy == null) return;
    const h = gh + (gy - e.clientY), rest = root.offsetHeight - (MW.settings.dockLib === false ? 0 : $('#mwList').offsetHeight + $('.mw-bar').offsetHeight);
    if (h < 36){ if (MW.settings.dockLib !== false){ MW.settings.dockLib = false; MW.setView('dock'); } return; }
    if (MW.settings.dockLib === false){ MW.settings.dockLib = true; MW.setView('dock'); }
    MW.settings.dockListH = Math.round(Math.max(56, Math.min(h, window.innerHeight - 110 - rest - 40)));
    root.style.setProperty('--mw-list-h', MW.settings.dockListH + 'px');
  });
  const gup = () => { if (gy == null) return; gy = null; grip.classList.remove('drag'); MW.saveSettings(); MW.emitLib(); };
  grip.addEventListener('pointerup', gup); grip.addEventListener('pointercancel', gup);
  if (MW.settings.dockListH) root.style.setProperty('--mw-list-h', MW.settings.dockListH + 'px');
  $('#mwMax').addEventListener('click', () => MW.minimize(false));
  $('#mwOff').addEventListener('click', () => MW.powerOff());
  $('#mwZi').addEventListener('click', () => MW.waveZoomBy(-2));
  $('#mwZo').addEventListener('click', () => MW.waveZoomBy(2));
  $('#mwSetB').addEventListener('click', () => { const s = $('#mwSet'); s.hidden = !s.hidden; if (!s.hidden) drawSettings(); });
  $('#mwCtl').addEventListener('click', () => MW.midi.start());
  listOutputs();
}
function drawSettings(){
  const s = $('#mwSet'), S = MW.settings, M = MW.midi;
  s.innerHTML = `<b>Ajustes de la Mesa Web</b>
    <label>Curva del crossfader <select data-s="xfCurve"><option value="suave">Suave (mezcla larga)</option><option value="corte">Corte (scratch)</option></select></label>
    <label>Dirección del pitch <select data-s="pitchUp"><option value="false">Abajo = más BPM (como rekordbox)</option><option value="true">Arriba = más BPM</option></select></label>
    <label>Rango de BPM del análisis <select data-s="bpmRange">${(MW.BPM_RANGES || []).map((r, i) => `<option value="${i}">${r[0]} – ${r[1]} BPM</option>`).join('')}</select></label>
    <label>Grilla del análisis <select data-s="gridMode"><option value="fija">Normal (tempo fijo)</option><option value="dinamica">Dinámica (tempo variable)</option></select></label>
    <p>El análisis sirve para las canciones que no traen grilla de rekordbox. Con <b>ANALIZAR</b> en cada bandeja vuelves a analizar la pista cargada.</p>
    <label>Elegir la tarjeta de sonido de la mesa sola <select data-s="autoOut"><option value="true">Sí</option><option value="false">No</option></select></label>
    <p>Controladora: ${M.devices.length ? M.devices.map(d => esc(d.name) + ' → ' + esc(d.entry.n)).join(', ') : 'ninguna'}${M.sysex ? '' : ' · sin permiso SysEx (las perillas toman su posición al moverlas)'}.</p>
    <p>Mapeos del proyecto <a href="https://github.com/mixxxdj/mixxx/tree/main/res/controllers" target="_blank" rel="noopener" style="color:#ffb347">Mixxx</a> (GPL-2.0). La DDJ-400 viene incluida; otras ${M.index ? M.index.length : 140}+ se descargan al conectarlas.</p>
    <pre>${esc(M.log.join('\n')) || 'Sin mensajes.'}</pre>
    <button class="mw-tb" id="mwForget">Olvidar la biblioteca guardada en este navegador</button>`;
  for (const sel of $$('select[data-s]', s)){ sel.value = String(S[sel.dataset.s]); sel.addEventListener('change', () => { const v = sel.value; S[sel.dataset.s] = v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? +v : v; MW.saveSettings(); for (const d of MW.decks){ d.applyFader(); d.applyRate(); } }); }
  $('#mwForget').addEventListener('click', () => { MW.lib.forget(); s.hidden = true; MW.toast('Biblioteca olvidada.'); });
}
MW.emitMidi = function(){
  if (!built) return; const M = MW.midi, el = $('#mwCtl');
  const ok = M.devices.filter(d => d.ok);
  el.className = 'mw-pill' + (ok.length ? ' ok' : M.status === 'denied' || M.status === 'nosupport' ? ' warn' : '');
  el.querySelector('span').textContent = ok.length ? '🎛️ ' + ok.map(d => d.name.replace(/\s*MIDI\s*\d*$/i, '')).join(', ') : M.devices.length ? 'Conectando ' + M.devices[0].name + '…' : M.status === 'denied' ? 'Sin permiso MIDI (toca para reintentar)' : M.status === 'nosupport' ? 'Sin Web MIDI en este navegador' : 'Conecta tu controladora por USB';
  el.title = M.log.slice(0, 4).join('\n');
  if (ok.length) setTimeout(() => MW.autoOutput(), 300);
  if (!$('#mwSet').hidden) drawSettings();
};

/* ---------- cuadro a cuadro ---------- */
let lastLib = 0;
function frame(){
  requestAnimationFrame(frame);
  if (!MW.A.ready) return;
  MW.tick();
  MW.host && MW.host.frame && MW.host.frame();
  const vis = root && !root.hidden;
  // controles que cambiaron (desde la controladora o el motor)
  const dirty = MW.uiDirty();
  if (vis) for (const id of dirty){
    const list = binds.get(id); if (!list) continue;
    const c = MW.CO.get(id);
    for (const b of list){
      if (b.kind === 'knob') drawKnob(b.el, MW.toParam(c.s, c.v));
      else if (b.kind === 'fader') drawFader(b.el, MW.toParam(c.s, c.v));
      else if (b.kind === 'led') b.el.classList.toggle('on', c.v > 0);
      else if (b.kind === 'range') b.el.querySelector('[data-act=range]').textContent = c.v >= 1 ? 'WIDE' : '±' + Math.round(c.v * 100) + '%';
      else if (b.kind === 'lsz') b.el.querySelector('[data-f=lsz]').textContent = fracTxt(c.v);
    }
    if (/hotcue_\d_enabled|beatloop_.*_enabled|\[Sampler\d+\],play/.test(id)){ for (const d of MW.decks) drawPads(d); }
  }
  if (!vis){ updateMini(); return; }
  for (const d of MW.decks){
    drawWave(d.n - 1); drawOverview(d); drawJog(d);
    const el = d.ui, p = d.pos();
    el.querySelector('[data-f=el]').textContent = d.L ? MW.fmtTime(p) : '0:00.0';
    el.querySelector('[data-f=rem]').textContent = d.L ? '-' + MW.fmtTime(d.dur - p) : '-0:00.0';
    const bpm = d.bpm(), pct = (d.tempo() - 1) * 100;
    el.querySelector('[data-f=bpm]').textContent = bpm ? bpm.toFixed(1) : '—';
    el.querySelector('[data-f=pitch]').textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%' + (d.baseBpm() ? ' · ' + d.baseBpm().toFixed(1) : '');
    const st = '<b class="' + (d.playing() ? 'on' : '') + '">' + (d.playing() ? '▶' : '❚❚') + '</b><b class="b' + (MW.getValue(d.g, 'sync_enabled') ? ' on' : '') + '">SYNC</b><b class="y' + (MW.getValue(d.g, 'sync_leader') ? ' on' : '') + '">MASTER</b><b class="o' + (d.loop.on ? ' on' : '') + '">' + (d.loop.on ? 'LOOP ' + (d.loop.beats ? fracTxt(d.loop.beats) : '') : 'LOOP') + '</b><b class="' + (MW.getValue(d.g, 'keylock') ? 'on' : '') + '">MT</b>';
    if (d.stHtml !== st){ d.stHtml = st; el.querySelector('[data-f=st]').innerHTML = st; }
    el.querySelector('[data-f=tv]').textContent = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
    const vu = root.querySelector('[data-vu="' + d.n + '"] i'); if (vu) vu.style.height = Math.round(Math.min(1, d.vuS || 0) * 100) + '%';
    if (d.lastMode !== MW.padModeHw[d.n - 1]){ d.lastMode = MW.padModeHw[d.n - 1]; if (d.lastMode){ padMode[d.n - 1] = d.lastMode; drawPads(d); } }
  }
  const an = MW.A.masterAn; if (an){ const b = MW.A.mBuf || (MW.A.mBuf = new Float32Array(an.fftSize)); an.getFloatTimeDomainData(b); let pk = 0; for (let i = 0; i < b.length; i++){ const a = Math.abs(b[i]); if (a > pk) pk = a; } MW.A.mPk = Math.max(pk, (MW.A.mPk || 0) * 0.92); root.querySelector('[data-vu=ml] i').style.width = Math.round(Math.min(1, MW.A.mPk) * 100) + '%'; }
  const room = $('#mwRoom'); room.classList.toggle('ok', MW.A.on); room.classList.toggle('act', MW.A.on && !!(MW.host && MW.host.casting && MW.host.casting()));
  room.querySelector('span').textContent = !MW.A.on ? 'La sala no escucha la mesa' : MW.host && MW.host.casting && MW.host.casting() ? '🔴 Transmitiendo a la sala' : 'La sala escucha el master';
  const ctl = $('#mwCtl i'); if (ctl && MW.midiActivity) ctl.style.background = performance.now() - MW.midiActivity < 90 ? '#ffef5a' : '';
  if (performance.now() - lastLib > 1000){ lastLib = performance.now(); }
}
// zoom de las formas de onda (+ = alejar: se ve más de lo que viene)
let zoomTip = 0;
MW.waveZoomBy = n => { waveZoom = clamp(waveZoom * Math.pow(1.15, n), 2, 64); try { localStorage.setItem('mesa-zoom', waveZoom); } catch(e){} const z = $('#mwZoomT'); if (z){ z.textContent = Math.round(waveZoom * 10) / 10 + ' s'; z.hidden = false; clearTimeout(zoomTip); zoomTip = setTimeout(() => { z.hidden = true; }, 1200); } };
try { const z = +localStorage.getItem('mesa-zoom'); if (z) waveZoom = clamp(z, 2, 64); } catch(e){}
// los pads de la DDJ-400 dicen en qué modo están (cada modo manda notas distintas)
MW.padModeHw = [null, null];
function updateMini(){
  const m = $('#mwMini'); if (m.hidden) return;
  MW.decks.forEach((d, i) => { $('#mwMini' + (i + 1)).innerHTML = '<b style="color:' + DECK_COL[i] + '">' + (i + 1) + '</b> ' + (d.track ? esc(d.track.title) + ' · ' + (d.bpm() ? d.bpm().toFixed(1) : '') + (d.playing() ? ' ▶' : ' ❚❚') : '—'); });
}
// la sala se achica para quedar justo encima de la mesa (así la cámara encuadra bien)
function dockSize(){
  const dock = !root.hidden && root.classList.contains('dock');
  document.body.classList.toggle('mesa-dock', dock);
  document.documentElement.style.setProperty('--mesa-dock-h', dock ? root.offsetHeight + 'px' : '0px');
  window.MESA_COVER = !root.hidden && !dock;
}
MW.setView = function(v){
  MW.settings.view = v === 'dock' ? 'dock' : 'full'; MW.saveSettings();
  const dock = MW.settings.view === 'dock';
  root.classList.toggle('dock', dock); root.classList.toggle('nolib', dock && MW.settings.dockLib === false);
  $('#mwView').textContent = dock ? '⛶ Pantalla completa' : '▭ Vista mesa';
  $('#mwLibT').classList.toggle('pri', MW.settings.dockLib !== false);
  for (const d of MW.decks) d.ovImg = null;
  dockSize(); MW.emitLib();
};
MW.minimize = function(on){ root.hidden = !!on; $('#mwMini').hidden = !on; $('#mwSet').hidden = true; if (!on){ MW.setView(MW.settings.view); MW.emitLib(); } dockSize(); updateMini(); };
MW.hideAll = function(){ root.hidden = true; $('#mwMini').hidden = true; dockSize(); };
})();

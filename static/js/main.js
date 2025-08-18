// main.js (ES module) - submission + socket wiring only
// Assumes socket.io script loaded globally providing io()

export let socket = null;

function initSocket(){
  if(socket) return socket;
  socket = io();
  attachHandlers();
  window.socket = socket; // transitional global
  return socket;
}

function attachHandlers(){
  socket.on('on_finish_audio', data => {
    if(!data || !data.filename || !data.json_filename) return;
    if(data.prompt){ window.__promptFileMap = window.__promptFileMap || {}; window.__promptFileMap[data.prompt] = { filename:data.filename, json:data.json_filename }; }
    fetch(data.json_filename).then(r=>r.json()).then(json=>{ if(window.renderDetail) try{ window.renderDetail(json, data.filename); }catch(e){ console.warn('renderDetail failed', e); } });
    if(window.addChatMessage){
      const safeFile=(data.filename||'').split('/').pop();
      const promptText=(data.prompt||'').replace(/</g,'&lt;');
      const html=`<div style="font-weight:500; margin-bottom:4px;">${promptText}</div>${safeFile?'<span class="chat-audio-link" data-audio-json="'+data.json_filename+'" data-audio-file="'+data.filename+'" style="color:#6fa8ff; cursor:pointer; text-decoration:underline;">'+safeFile+'</span>':''}`;
      window.addChatMessage('assistant', html);
    }
    // Finish UI cleanup
    if(window.clearProgressMessage) window.clearProgressMessage();
    window.__genInFlight=false; const btn=document.getElementById('submit-btn'); if(btn) btn.disabled=false;
  });
  socket.on('progress', d=>{ const pct=(d && typeof d.progress==='number')? (d.progress*100).toFixed(1) : '0.0'; if(window.onGenerationProgress) window.onGenerationProgress(pct); });
  socket.on('update_seed', d=>{ try { if(window.__autoSeedEnabled && window.__autoSeedEnabled()) return; const s=d.seed; const r=document.getElementById('seed'); const n=document.getElementById('seed-text'); if(r&&n&&typeof s==='number'){ r.value=s; n.value=s; } } catch(e){} });
  socket.on('seed_updated', d=>{ const seedInput=document.getElementById('seed'); if(seedInput && d && typeof d.seed!=='undefined') seedInput.value=d.seed; });
  socket.on('generation_progress', data=>{ if(!window.onGenerationProgress) return; if(data && typeof data.step==='number' && typeof data.total==='number' && data.total>0){ const pct=((data.step/data.total)*100).toFixed(1); window.onGenerationProgress(pct); } else if(data && typeof data.progress==='number'){ window.onGenerationProgress((data.progress*100).toFixed(1)); } });
  socket.on('generation_finished', data=>{ if(window.clearProgressMessage) window.clearProgressMessage(); if(data && data.meta && data.meta.filename){ if(window.addChatMessage){ window.addChatMessage({ role:'user', content:'(Авто) Сгенерировано: '+(data.meta.prompt||''), audio_file:data.meta.filename, seed:data.meta.seed }); } if(window.renderDetail){ window.renderDetail(data.meta, data.meta.filename); } } });
  socket.on('mbd_progress', data=>{ if(!data) return; const detail=document.getElementById('audio-detail'); if(!detail) return; const card=detail.querySelector('.audio-item'); if(!card) return; let barWrap=card.querySelector('.mbd-progress'); if(!barWrap){ barWrap=document.createElement('div'); barWrap.className='mbd-progress'; barWrap.style.cssText='margin:6px 0 4px; background:#262a30; border:1px solid #333; height:12px; border-radius:6px; position:relative; overflow:hidden;'; const inner=document.createElement('div'); inner.className='mbd-progress-inner'; inner.style.cssText='position:absolute; left:0; top:0; height:100%; width:0%; background:linear-gradient(90deg,#5fd4ff,#9f6bff); transition:width .2s;'; barWrap.appendChild(inner); const label=document.createElement('div'); label.className='mbd-progress-label'; label.style.cssText='font-size:11px; opacity:.75; margin-top:2px;'; label.textContent='MBD 0%'; card.appendChild(barWrap); card.appendChild(label); } const inner=barWrap.querySelector('.mbd-progress-inner'); if(inner) inner.style.width=((data.progress||0)*100).toFixed(1)+'%'; const lbl=card.querySelector('.mbd-progress-label'); if(lbl) lbl.textContent='MBD '+((data.progress||0)*100).toFixed(0)+'%'; if(data.progress>=1){ setTimeout(()=>{ try{ barWrap.remove(); const l=card.querySelector('.mbd-progress-label'); if(l) l.remove(); }catch(_){} }, 1200); }});
}

export function submitSliders(){
  if(window.__genInFlight) return; // guard
  const textEl=document.getElementById('text');
  const prompt=(textEl && textEl.value)||'';
  if(!prompt.trim()){ console.warn('Пустой промпт'); return; }
  const modelSel=document.getElementById('modelSelector');
  const model=modelSel?modelSel.value:'small';
  const formatSel=document.getElementById('formatSelect');
  const outFormat=formatSel?formatSel.value:'wav';
  const sampleSel=document.getElementById('sampleRateSelect');
  const outSampleRate=sampleSel?sampleSel.value:'original';
  const artistEnabled=document.getElementById('artist-enable');
  const artistInput=document.getElementById('artist-input');
  const artistName=(artistEnabled && artistEnabled.checked && artistInput && artistInput.value.trim())?artistInput.value.trim():null;
  const audioEl=document.getElementById('audio-preview');
  const audioSrc=audioEl && audioEl.src || '';
  const appendCb=document.getElementById('append-continuation');
  const contAudio=document.getElementById('continuation-preview');
  const contSrc=(appendCb && appendCb.checked && contAudio && contAudio.src)?contAudio.src:null;
  const mbd=document.getElementById('mbd_checkbox');
  const mbdStrengthEl=document.getElementById('mbd_strength');
  const stemSel=document.getElementById('stem_split_select');
  const mbdEnabled=mbd?!!mbd.checked:false;
  const mbdStrength=(mbdEnabled && mbdStrengthEl)?parseFloat(mbdStrengthEl.value):null;
  const slidersData={};
  document.querySelectorAll('input[type="range"]').forEach(sl=>{ slidersData[sl.id]=sl.value; });
  // Melody special handling
  const isMelody = model==='melody' && audioSrc;
  if(isMelody && audioSrc){
    const old=document.getElementById('analysis-wait-msg'); if(old) old.remove();
    const chatBox=document.getElementById('chat-messages'); if(chatBox){ const wrap=document.createElement('div'); wrap.className='chat-msg system'; wrap.id='analysis-wait-msg'; wrap.innerHTML='<div class="msg-inner">Ожидайте: идёт анализ аудио...</div>'; chatBox.appendChild(wrap); chatBox.scrollTop=chatBox.scrollHeight; window.__analysisWaitActive=true; }
  }
  window.__genInFlight=true; const btn=document.getElementById('submit-btn'); if(btn) btn.disabled=true;
  // Показать системное сообщение прогресса сразу (0%), если нет анализа
  if(!isMelody && window.onGenerationProgress){ window.onGenerationProgress('0.0'); }
  const payload={ values:slidersData, prompt, model, format:outFormat, sample_rate:outSampleRate, appendContinuation:!!contSrc, continuationUrl:contSrc, mbd:mbdEnabled, mbd_strength:mbdStrength, stem_split: (stemSel?stemSel.value:''), artist:artistName };
  if(isMelody) payload.audioPromptUrl=audioSrc; else if(audioSrc && model!=='melody') payload.audioPromptUrl=audioSrc; // keep consistency
  try{ initSocket().emit('submit_sliders', payload); }catch(e){ console.error('submit emit failed', e); window.__genInFlight=false; if(btn) btn.disabled=false; }
}

function bindSubmit(){ const btn=document.getElementById('submit-btn'); if(btn){ btn.addEventListener('click', submitSliders); }
  const ta=document.getElementById('text'); if(ta){ ta.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); submitSliders(); }}); }
}

function init(){ initSocket(); bindSubmit(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

// Backward compat
window.submitSliders = submitSliders;

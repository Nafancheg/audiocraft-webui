// Chat module: persistence, export, compact mode, progress & analysis messages

const LS_KEY='chat_history_v1';
let __chatProgressMsgEl = null;

export function addChatMessage(role, html){
	const chatBox = document.getElementById('chat-messages'); if(!chatBox) return;
	const wrap = document.createElement('div');
	wrap.className='chat-msg '+role;
	wrap.innerHTML='<div class="msg-inner">'+html+'</div>';
	chatBox.appendChild(wrap);
	chatBox.scrollTop = chatBox.scrollHeight;
	persist();
}

function persist(){
	try {
		const chatBox=document.getElementById('chat-messages'); if(!chatBox) return;
		const data = Array.from(chatBox.querySelectorAll('.chat-msg')).map(m=>({role:[...m.classList].filter(c=>c!=='chat-msg')[0]||'user', html:m.querySelector('.msg-inner')?.innerHTML||''}));
		localStorage.setItem(LS_KEY, JSON.stringify(data));
	} catch(e){}
}

function restore(){
	try { const raw=localStorage.getItem(LS_KEY); if(!raw) return; const arr=JSON.parse(raw); if(!Array.isArray(arr)) return; arr.forEach(it=>{ const chatBox=document.getElementById('chat-messages'); if(!chatBox) return; const wrap=document.createElement('div'); wrap.className='chat-msg '+it.role; wrap.innerHTML='<div class="msg-inner">'+it.html+'</div>'; chatBox.appendChild(wrap); }); const chatBox=document.getElementById('chat-messages'); if(chatBox) chatBox.scrollTop=chatBox.scrollHeight; } catch(e){}
}

function migrateAnchors(){
	const chatBox=document.getElementById('chat-messages'); if(!chatBox) return;
	chatBox.querySelectorAll('.chat-msg a[href*="static/"]').forEach(a=>{
		const file=a.getAttribute('href'); if(!file) return; const span=document.createElement('span'); span.className='chat-audio-link'; span.textContent=a.textContent; span.style.cssText='color:#6fa8ff; cursor:pointer; text-decoration:underline;'; span.setAttribute('data-audio-file', file); span.setAttribute('data-audio-json', file.replace(/\.[a-z0-9]+$/i, '.json')); a.replaceWith(span); persist();
	});
}

function setupDelegates(){
	const chatBox=document.getElementById('chat-messages'); if(!chatBox) return;
	chatBox.addEventListener('click', e=>{
		const t=e.target.closest('.chat-audio-link'); if(!t) return; const jsonPath=t.getAttribute('data-audio-json'); const audioFile=t.getAttribute('data-audio-file'); if(jsonPath && audioFile){ fetch(jsonPath).then(r=>r.json()).then(j=>{ window.renderDetail && window.renderDetail(j, audioFile); }); }
	});
}

function exportJSON(){
	const chatBox=document.getElementById('chat-messages'); if(!chatBox) return;
	const data = Array.from(chatBox.querySelectorAll('.chat-msg')).map(m=>({role:[...m.classList].filter(c=>c!=='chat-msg')[0]||'user', html:m.querySelector('.msg-inner')?.innerHTML||''}));
	const blob = new Blob([JSON.stringify({exported_at:new Date().toISOString(), messages:data}, null, 2)], {type:'application/json'});
	const tag=new Date().toISOString().replace(/[:.]/g,'');
	download('chat_'+tag+'.json', blob);
}
function exportTXT(){
	const chatBox=document.getElementById('chat-messages'); if(!chatBox) return;
	const lines=[]; chatBox.querySelectorAll('.chat-msg').forEach(m=>{ const role=[...m.classList].filter(c=>c!=='chat-msg')[0]||'user'; const text=m.querySelector('.msg-inner')?.innerText||''; lines.push('['+role+'] '+text.replace(/\n+/g,'\n')); });
	const blob=new Blob([lines.join('\n\n')], {type:'text/plain'}); const tag=new Date().toISOString().replace(/[:.]/g,''); download('chat_'+tag+'.txt', blob);
}
function download(name, blob){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},1500); }

function toggleCompact(){
	const root=document.getElementById('chat-messages'); if(!root) return; root.classList.toggle('compact'); const btn=document.getElementById('compact-toggle-btn'); const lang=(document.getElementById('lang-select')||{value:'en'}).value; const dict=(window.I18N_STRINGS && window.I18N_STRINGS[lang]) || (window.I18N_STRINGS && window.I18N_STRINGS.en) || {}; if(btn){ btn.textContent = root.classList.contains('compact') ? (dict.compact_off||'Normal chat') : (dict.compact_on||'Compact chat'); }
}

function initButtons(){
	const j=document.getElementById('export-json-btn'); if(j) j.addEventListener('click', exportJSON);
	const t=document.getElementById('export-txt-btn'); if(t) t.addEventListener('click', exportTXT);
	const c=document.getElementById('compact-toggle-btn'); if(c) c.addEventListener('click', toggleCompact);
	if(!document.getElementById('compact-chat-style')){ const st=document.createElement('style'); st.id='compact-chat-style'; st.textContent=`#chat-messages.compact{gap:4px;}#chat-messages.compact .chat-msg .msg-inner{padding:6px 8px; font-size:13px; line-height:1.25;}#chat-messages.compact .chat-msg{max-width:780px;}#chat-messages.compact .chat-msg.user .msg-inner{background:#284274;}#chat-messages.compact .chat-msg.assistant .msg-inner{background:#242424;}`; document.head.appendChild(st); }
}

export function initChatModule(){
	restore();
	migrateAnchors();
	setupDelegates();
	initButtons();
	// Enter submits (no Shift)
	const ta=document.getElementById('text'); const submitBtn=document.getElementById('submit-btn');
	if(ta && submitBtn){ ta.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); window.submitSliders && window.submitSliders(); }}); }
	// Artist enable toggle
	const artistEnable=document.getElementById('artist-enable'); const artistInput=document.getElementById('artist-input');
	if(artistEnable && artistInput){ artistEnable.addEventListener('change', ()=>{ artistInput.disabled=!artistEnable.checked; if(!artistEnable.checked){ artistInput.value=''; } }); }
	// Clear chat modal
	const clearBtn=document.getElementById('clear-chat-btn'); if(clearBtn){ clearBtn.addEventListener('click', ()=>showConfirmModal()); }
	function showConfirmModal(){ let modal=document.getElementById('confirm-clear-modal'); if(modal) return; modal=document.createElement('div'); modal.id='confirm-clear-modal'; modal.style.cssText='position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000;'; modal.innerHTML='<div style="background:#232527; padding:24px 26px; border-radius:10px; width:420px; max-width:90%; font-size:14px; line-height:1.5;">'+ '<div style="font-weight:600; font-size:16px; margin-bottom:10px;">Подтверждение</div>'+ '<div style="margin-bottom:16px;">Точно очистить чат? <br>Все песни и их стемы тоже будут удалены.</div>'+ '<div style="display:flex; gap:12px; justify-content:flex-end;">'+ '<button id="ccm-no" style="background:#444; padding:8px 14px; border:none; border-radius:4px; cursor:pointer;">Нет</button>'+ '<button id="ccm-yes" style="background:#d14848; padding:8px 14px; border:none; border-radius:4px; cursor:pointer;">ДА</button>'+ '</div>'+ '</div>'; document.body.appendChild(modal); modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(); }); modal.querySelector('#ccm-no').addEventListener('click', closeModal); modal.querySelector('#ccm-yes').addEventListener('click', doClearAll); }
	function closeModal(){ const m=document.getElementById('confirm-clear-modal'); if(m) m.remove(); }
	function doClearAll(){ fetch('/delete_all_audio',{method:'POST'}).then(r=>r.json()).then(()=>{ try{ localStorage.removeItem(LS_KEY); }catch(e){} const chatBox=document.getElementById('chat-messages'); if(chatBox) chatBox.innerHTML=''; const detail=document.getElementById('audio-detail'); if(detail){ const host=detail.querySelector('.audio-card-host'); const stems=detail.querySelector('.stems-side-panel'); if(host) host.innerHTML=''; if(stems){ stems.querySelectorAll('.stems-container,.stems-progress-placeholder,.stems-toggle-btn').forEach(n=>n.remove()); } else { const newStems=document.createElement('div'); newStems.className='stems-side-panel'; newStems.style.cssText='flex:0 0 420px; display:flex; flex-direction:column; gap:12px; min-height:100%;'; detail.appendChild(newStems); } if(!host){ const newHost=document.createElement('div'); newHost.className='audio-card-host'; newHost.style.cssText='flex:1 1 auto; min-width:0;'; detail.insertBefore(newHost, detail.firstChild); } } closeModal(); }).catch(()=>closeModal()); }
	window.addChatMessage = addChatMessage; // legacy
	window.removeChatByFile = function(file){ if(!file) return; const normalized=file.replace(/\\/g,'/'); let changed=false; const chatBox=document.getElementById('chat-messages'); if(!chatBox) return; chatBox.querySelectorAll('.chat-audio-link').forEach(el=>{ const f=(el.getAttribute('data-audio-file')||'').replace(/\\/g,'/'); if(f===normalized || f.endsWith('/'+normalized.split('/').pop())){ const msg=el.closest('.chat-msg'); if(msg){ msg.remove(); changed=true; } } }); if(changed) persist(); };
}

// Progress & analysis hooks (called from socket events)
export function onGenerationProgress(pct){
	const chatBox=document.getElementById('chat-messages'); if(!chatBox) return;
	if(window.__analysisWaitActive){ const aw=document.getElementById('analysis-wait-msg'); if(aw) try{aw.remove();}catch(_){ } window.__analysisWaitActive=false; }
	if(!__chatProgressMsgEl){ __chatProgressMsgEl=document.createElement('div'); __chatProgressMsgEl.className='chat-msg system'; __chatProgressMsgEl.innerHTML='<div class="msg-inner">Генерация: '+pct+'%</div>'; chatBox.appendChild(__chatProgressMsgEl); chatBox.scrollTop=chatBox.scrollHeight; } else { const inner=__chatProgressMsgEl.querySelector('.msg-inner'); if(inner) inner.textContent='Генерация: '+pct+'%'; }
}
export function clearProgressMessage(){ if(__chatProgressMsgEl){ try{ __chatProgressMsgEl.remove(); }catch(e){} __chatProgressMsgEl=null; } }

// Expose for legacy
window.initChatModule = initChatModule;

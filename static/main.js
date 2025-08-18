// Entry (legacy) still non-module: we keep global but will gradually migrate to ES modules loaded separately.
var socket = io.connect('http://' + document.domain + ':' + location.port);
window.socket = socket;

// -------- I18N (EN/RU) basic dictionary --------
const I18N_STRINGS = {
    en: {
        language_label: 'Language',
        format: 'Format',
        sample_rate: 'Sample Rate',
        audio_prompt: 'Audio Prompt',
        append_continuation: 'Append continuation',
        seed_mode: 'Seed Mode',
        auto: 'Auto',
        roll: 'Roll',
        submit: 'Submit',
        advanced: 'Advanced (placeholders)',
        stem_split: 'Stem Split',
        none: 'None',
        demucs_any: 'Demucs: Arbitrary File',
    separate: 'Separate',
    rerun: 'Rerun',
    export_json: 'Export JSON',
    export_txt: 'Export TXT',
    compact_on: 'Compact chat',
    compact_off: 'Normal chat'
    },
    ru: {
        language_label: 'Язык',
        format: 'Формат',
        sample_rate: 'Частота дискретизации',
        audio_prompt: 'Аудио промпт',
        append_continuation: 'Добавить продолжение',
        seed_mode: 'Режим Seed',
        auto: 'Авто',
        roll: 'Случайный',
        submit: 'Сгенерировать',
        advanced: 'Дополнительно (заглушки)',
        stem_split: 'Разделение стемов',
        none: 'Нет',
        demucs_any: 'Demucs: любой файл',
    separate: 'Разделить',
    rerun: 'Повтор',
    export_json: 'Экспорт JSON',
    export_txt: 'Экспорт TXT',
    compact_on: 'Компактный чат',
    compact_off: 'Обычный чат'
    }
};

function applyI18n(lang){
    const dict = I18N_STRINGS[lang] || I18N_STRINGS.en;
    document.querySelectorAll('[data-i18n]').forEach(el=>{
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
    });
    // Options inside selects
    document.querySelectorAll('option[data-i18n]').forEach(opt=>{
        const k = opt.getAttribute('data-i18n'); if (dict[k]) opt.textContent = dict[k];
    });
}

document.addEventListener('DOMContentLoaded', ()=>{
    const sel = document.getElementById('lang-select');
    if (sel){
        sel.addEventListener('change', ()=>{ applyI18n(sel.value); });
        applyI18n(sel.value);
    }
    // Чистим возможные дубликаты карточек, оставшихся после прошлых версий
    const detail = document.getElementById('audio-detail');
    if (detail){
        const host = detail.querySelector('.audio-card-host');
        if (host){ host.querySelectorAll('.audio-item').forEach(n=>n.remove()); }
        // Удаляем карточки, ошибочно лежащие прямо в detail (вне host)
        detail.querySelectorAll(':scope > .audio-item').forEach(ch=>ch.remove());
    }
});
// SLIDERS

document.addEventListener("DOMContentLoaded", function() {
    document.querySelectorAll('input[type="range"]').forEach(function(slider) {
        updateSliderValue(slider.id, slider.value);
    });
});

function submitSliders() {
    var slidersData = {};
    var textData = document.getElementById('text').value;
    var artistEnabled = document.getElementById('artist-enable');
    var artistInput = document.getElementById('artist-input');
    var artistName = (artistEnabled && artistEnabled.checked && artistInput && artistInput.value.trim()) ? artistInput.value.trim() : null;

    var modelSelector = document.getElementById('modelSelector');
    var modelSize = modelSelector.value;

    var formatSel = document.getElementById('formatSelect');
    var sampleRateSel = document.getElementById('sampleRateSelect');
    var outFormat = formatSel ? formatSel.value : 'wav';
    var outSampleRate = sampleRateSel ? sampleRateSel.value : 'original';

    var audioElement = document.getElementById('audio-preview');
    var audioSrc = (audioElement && audioElement.src) ? audioElement.src : '';
    var appendCb = document.getElementById('append-continuation');
    var contAudio = document.getElementById('continuation-preview');
    var continuationSrc = (appendCb && appendCb.checked && contAudio && contAudio.src) ? contAudio.src : null;
    var mbd = document.getElementById('mbd_checkbox');
    var mbdStrengthEl = document.getElementById('mbd_strength');
    var stemSel = document.getElementById('stem_split_select');
    var mbdEnabled = mbd ? !!mbd.checked : false;
    var mbdStrength = (mbdEnabled && mbdStrengthEl) ? parseFloat(mbdStrengthEl.value) : null;
    // Удаляем предыдущие карточки (на случай если что-то осталось)
    (function(){
        const detail = document.getElementById('audio-detail');
        const host = detail && detail.querySelector('.audio-card-host');
        if (host){ host.querySelectorAll('.audio-item').forEach(n=>n.remove()); }
    })();
    var stemValue = stemSel ? stemSel.value : '';

    if (!textData || !textData.trim()) {
        console.warn('Пустой промпт: генерация не отправлена');
        return;
    }

    if (modelSize !== "melody" || audioSrc === "") {
        document.querySelectorAll('input[type="range"]').forEach(function(slider) {
            slidersData[slider.id] = slider.value;
        });
        try {
            socket.emit('submit_sliders', {values: slidersData, prompt:textData, model:modelSize, format: outFormat, sample_rate: outSampleRate, appendContinuation: !!continuationSrc, continuationUrl: continuationSrc, mbd: mbdEnabled, mbd_strength: mbdStrength, stem_split: stemValue, artist: artistName});
        } catch(e){ console.error('Emit submit_sliders failed', e); }
        return;
    }

    document.querySelectorAll('input[type="range"]').forEach(function(slider) {
        slidersData[slider.id] = slider.value;
    });
    // Melody + audio prompt: показать сообщение анализа до первого прогресса
    try {
        if (audioSrc) {
            // Удаляем старое, если есть
            const old = document.getElementById('analysis-wait-msg'); if (old) old.remove();
            const chatBox = document.getElementById('chat-messages');
            if (chatBox) {
                const wrap = document.createElement('div');
                wrap.className='chat-msg system';
                wrap.id='analysis-wait-msg';
                wrap.innerHTML='<div class="msg-inner">Ожидайте: идёт анализ аудио...</div>';
                chatBox.appendChild(wrap);
                chatBox.scrollTop = chatBox.scrollHeight;
            }
            window.__analysisWaitActive = true;
        }
    } catch(e){ console.warn('analysis wait msg failed', e); }
    try {
    socket.emit('submit_sliders', {values: slidersData, prompt:textData, model:modelSize, audioPromptUrl:audioSrc, format: outFormat, sample_rate: outSampleRate, appendContinuation: !!continuationSrc, continuationUrl: continuationSrc, mbd: mbdEnabled, mbd_strength: mbdStrength, stem_split: stemValue, artist: artistName});
    } catch(e){ console.error('Emit submit_sliders (melody) failed', e); }
}

// Очередь отключена в чат-режиме; add_to_queue не используется

// AUDIO RENDERED

// Хранилище соответствий prompt -> {filename,json}
window.__promptFileMap = window.__promptFileMap || {};
socket.on('on_finish_audio', function(data) {
    console.log('Finish audio event', data);
    if (!data || !data.filename || !data.json_filename) return;
    if (data.prompt) {
        window.__promptFileMap[data.prompt] = { filename: data.filename, json: data.json_filename };
    }
    fetch(data.json_filename).then(r=>r.json()).then(json_data=>{ try{ renderDetail(json_data, data.filename); }catch(e){ console.warn('renderDetail failed', e); } });
    // Единое сообщение: промпт (как был отправлен) + имя файла
    if (window.addChatMessage){
        const safeFile = (data.filename||'').split('/').pop();
        const promptText = (data.prompt||'').replace(/</g,'&lt;');
        const html = `<div style="font-weight:500; margin-bottom:4px;">${promptText}</div>${safeFile ? '<span class="chat-audio-link" data-audio-json="'+data.json_filename+'" data-audio-file="'+data.filename+'" style="color:#6fa8ff; cursor:pointer; text-decoration:underline;">'+safeFile+'</span>' : ''}`;
        window.addChatMessage('assistant', html);
    }
});

// Continuation feedback
socket.on('continuation_applied', function(data){
    try {
        console.log('Continuation:', data);
        if (data.error) {
            // Можно добавить визуальный алерт позже
            return;
        }
        // Success: можно пометить последний элемент очереди или вывести сообщение
    } catch(e) { console.warn('continuation_applied handler failed', e); }
});

// Postprocess events (scaffold)
socket.on('postprocess_queued', function(data){ console.log('Postprocess queued', data); });
socket.on('postprocess_progress', function(data){ console.log('Postprocess progress', data); });
socket.on('postprocess_done', function(data){ console.log('Postprocess done', data); });
// MBD progress
socket.on('mbd_progress', function(data){
    if(!data) return;
    const detail = document.getElementById('audio-detail'); if(!detail) return;
    const card = detail.querySelector('.audio-item'); if(!card) return;
    let barWrap = card.querySelector('.mbd-progress');
    if(!barWrap){
        barWrap = document.createElement('div');
        barWrap.className='mbd-progress';
        barWrap.style.cssText='margin:6px 0 4px; background:#262a30; border:1px solid #333; height:12px; border-radius:6px; position:relative; overflow:hidden;';
        const inner = document.createElement('div'); inner.className='mbd-progress-inner'; inner.style.cssText='position:absolute; left:0; top:0; height:100%; width:0%; background:linear-gradient(90deg,#5fd4ff,#9f6bff); transition:width .2s;';
        barWrap.appendChild(inner);
        const label = document.createElement('div'); label.className='mbd-progress-label'; label.style.cssText='font-size:11px; opacity:.75; margin-top:2px;';
        label.textContent='MBD 0%';
        card.appendChild(barWrap); card.appendChild(label);
    }
    const inner = barWrap.querySelector('.mbd-progress-inner');
    if(inner){ inner.style.width=((data.progress||0)*100).toFixed(1)+'%'; }
    const lbl = card.querySelector('.mbd-progress-label'); if(lbl) lbl.textContent = 'MBD '+((data.progress||0)*100).toFixed(0)+'%';
    if(data.progress>=1){ setTimeout(()=>{ try{ barWrap.remove(); if(lbl) lbl.remove(); }catch(_){} }, 1200); }
});
// stem_progress handled in stems.js now

// renderDetail moved to render.js module


function addAudioToList(filename, json_filename) {
    fetch(json_filename).then(r=>r.json()).then(json_data=>{ addListRow(json_data, filename); });
}

function deleteAudio(wavPath, cardEl) {
    fetch('/delete_audio', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ wav: wavPath }) })
        .then(r=>r.json())
        .then(j=>{ 
            if (j.success) { 
                try{ if(cardEl) cardEl.remove(); }catch(e){}
                // Удаляем сообщения в чате
                if (window.removeChatByFile){ window.removeChatByFile(wavPath); }
            } else { console.error('Удаление не удалось', j.error); }
        })
        .catch(e=>console.error('Ошибка удаления', e));
}

// PROGRESS
const rootStyles = getComputedStyle(document.documentElement);  
const completionColor = rootStyles.getPropertyValue('--hamster').trim();  

// Прогресс генерации: вывод в чат
let __chatProgressMsgEl = null;
socket.on('progress', function(data) {
    const pct = (data.progress*100||0).toFixed(1);
    const progEl = document.getElementById('chat-progress');
    if (progEl){
        progEl.style.display='block';
        progEl.textContent = 'Генерация: '+pct+'%';
    }
    // Снимаем сообщение анализа при первом прогрессе
    if (window.__analysisWaitActive){
        const aw = document.getElementById('analysis-wait-msg'); if (aw) try{ aw.remove(); }catch(_){}
        window.__analysisWaitActive=false;
    }
    if (window.addChatMessage){
        if(!__chatProgressMsgEl){
            // создаём отдельный message контейнер (assistant role)
            const chatBox = document.getElementById('chat-messages');
            if(chatBox){
                __chatProgressMsgEl = document.createElement('div');
                __chatProgressMsgEl.className='chat-msg system';
                __chatProgressMsgEl.innerHTML='<div class="msg-inner">Генерация: '+pct+'%</div>';
                chatBox.appendChild(__chatProgressMsgEl);
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        } else {
            const inner = __chatProgressMsgEl.querySelector('.msg-inner'); if(inner) inner.textContent='Генерация: '+pct+'%';
        }
    }
});
socket.on('on_finish_audio', function(){
    const progEl = document.getElementById('chat-progress'); if(progEl){ progEl.style.display='none'; progEl.textContent=''; }
    // Удаляем прогресс сообщение целиком (не оставляем "Генерация завершена")
    if(__chatProgressMsgEl){ try{ __chatProgressMsgEl.remove(); }catch(e){} __chatProgressMsgEl=null; }
});

// Удалены функции списка аудио

// ---------- Arbitrary Demucs (demucs_any) UI (existing panel in Advanced block) ----------
(function(){
    function initPanel(){
        const panel = document.getElementById('demucs-any-panel');
        if (!panel) return;
        const input = panel.querySelector('#demucs-any-input');
        const runBtn = panel.querySelector('#demucs-any-run');
        const status = panel.querySelector('#demucs-any-status');
        let currentJob = null;
        if (!input || !runBtn) return;
        input.addEventListener('change', async ()=>{
            status.textContent='';
            if (!input.files.length){ runBtn.disabled=true; return; }
            const f = input.files[0];
            if (!f.type.startsWith('audio/')){ status.textContent='Неверный тип файла'; runBtn.disabled=true; return; }
            const fd = new FormData(); fd.append('file', f);
            runBtn.disabled = true; status.textContent='Uploading...';
            try {
                const r = await fetch('/upload_demucs_any', { method:'POST', body: fd });
                const j = await r.json();
                if (j.error){ status.textContent='Ошибка: '+j.error; return; }
                currentJob = j; runBtn.disabled=false; status.textContent='Uploaded: '+j.displayName;
                runBtn.onclick = function(){ if (!currentJob) return; status.textContent='Queued separation...'; socket.emit('demucs_any', { path: currentJob.filePath, id: currentJob.id, display_name: currentJob.displayName }); runBtn.disabled=true; };
            } catch(e){ status.textContent='Upload failed: '+e; runBtn.disabled=true; }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPanel); else initPanel();
})();

socket.on('demucs_any_progress', function(data){
    const panel = document.getElementById('demucs-any-panel'); if (!panel) return;
    const status = panel.querySelector('#demucs-any-status'); if (!status) return;
    const pct = (data.progress*100||0).toFixed(1);
    let stage = data.stage||''; if (stage==='start') stage='starting'; else if (stage==='demucs') stage='separating'; else if (stage==='files') stage='writing';
    status.textContent = 'Progress ['+data.display_name+']: '+stage+' '+pct+'%';
});
socket.on('demucs_any_done', function(data){
    const panel = document.getElementById('demucs-any-panel'); if (!panel) return;
    const status = panel.querySelector('#demucs-any-status'); const res = panel.querySelector('#demucs-any-results');
    if (data.error){ status.textContent = 'Error: '+data.error; return; }
    status.textContent = 'Complete: '+(data.display_name||'');
    // Build pseudo card to reuse mixer
    const card = document.createElement('div'); card.className='audio-item';
    const title = document.createElement('div'); title.className='audio-item-text'; title.textContent = '[Demucs] '+(data.display_name||data.id);
    card.appendChild(title);
    res.appendChild(card);
    buildStemsMixerUI(card, title.textContent, data.stems||[]);
});

// Получаем обновлённый seed от сервера (когда из -1 был сгенерирован реальный)
socket.on('update_seed', function(data) {
    try {
        if (typeof window.__autoSeedEnabled === 'function' && window.__autoSeedEnabled()) {
            // В авто режиме оставляем -1, игнорируя полученный seed; можно логировать при необходимости
            return;
        }
        const s = data.seed;
        const rangeEl = document.getElementById('seed');
        const numberEl = document.getElementById('seed-text');
        if (rangeEl && numberEl && typeof s === 'number') {
            rangeEl.value = s;
            numberEl.value = s;
        }
    } catch (e) { console.warn('Failed to update seed UI', e); }
});

// -------- Chat export & compact mode --------
(function(){
    function download(name, blob){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},1500); }
    function exportJSON(){
        const chatBox=document.getElementById('chat-messages'); if(!chatBox) return;
        const data = Array.from(chatBox.querySelectorAll('.chat-msg')).map(m=>({role:[...m.classList].filter(c=>c!=='chat-msg')[0]||'user', html:m.querySelector('.msg-inner')?.innerHTML||''}));
        const blob = new Blob([JSON.stringify({exported_at:new Date().toISOString(), messages:data}, null, 2)], {type:'application/json'});
        const tag = new Date().toISOString().replace(/[:.]/g,'');
        download('chat_'+tag+'.json', blob);
    }
    function exportTXT(){
        const chatBox=document.getElementById('chat-messages'); if(!chatBox) return;
        const lines = [];
        chatBox.querySelectorAll('.chat-msg').forEach(m=>{
            const role=[...m.classList].filter(c=>c!=='chat-msg')[0]||'user';
            const text=m.querySelector('.msg-inner')?.innerText||'';
            lines.push('['+role+'] '+text.replace(/\n+/g,'\n'));
        });
        const blob = new Blob([lines.join('\n\n')], {type:'text/plain'});
        const tag = new Date().toISOString().replace(/[:.]/g,'');
        download('chat_'+tag+'.txt', blob);
    }
    function toggleCompact(){
        const root = document.getElementById('chat-messages'); if(!root) return;
        root.classList.toggle('compact');
        const btn = document.getElementById('compact-toggle-btn');
        const lang = (document.getElementById('lang-select')||{value:'en'}).value;
        const dict = I18N_STRINGS[lang]||I18N_STRINGS.en;
        if (btn){ btn.textContent = root.classList.contains('compact') ? (dict.compact_off||'Normal chat') : (dict.compact_on||'Compact chat'); }
    }
    function init(){
        const jsonBtn = document.getElementById('export-json-btn'); if(jsonBtn) jsonBtn.addEventListener('click', exportJSON);
        const txtBtn = document.getElementById('export-txt-btn'); if(txtBtn) txtBtn.addEventListener('click', exportTXT);
        const compactBtn = document.getElementById('compact-toggle-btn'); if(compactBtn) compactBtn.addEventListener('click', toggleCompact);
        // Inject compact CSS once
        if(!document.getElementById('compact-chat-style')){
            const st = document.createElement('style'); st.id='compact-chat-style'; st.textContent=`#chat-messages.compact{gap:4px;}#chat-messages.compact .chat-msg .msg-inner{padding:6px 8px; font-size:13px; line-height:1.25;}#chat-messages.compact .chat-msg{max-width:780px;}#chat-messages.compact .chat-msg.user .msg-inner{background:#284274;}#chat-messages.compact .chat-msg.assistant .msg-inner{background:#242424;}`; document.head.appendChild(st);
        }
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
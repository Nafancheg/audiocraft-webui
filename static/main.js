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
    var stemSel = document.getElementById('stem_split_select');
    var mbdEnabled = mbd? !!mbd.checked : false;
    var mbdStrength = null;
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
            socket.emit('submit_sliders', {values: slidersData, prompt:textData, model:modelSize, format: outFormat, sample_rate: outSampleRate, appendContinuation: !!continuationSrc, continuationUrl: continuationSrc, mbd: mbdEnabled, stem_split: stemValue, artist: artistName});
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
    socket.emit('submit_sliders', {values: slidersData, prompt:textData, model:modelSize, audioPromptUrl:audioSrc, format: outFormat, sample_rate: outSampleRate, appendContinuation: !!continuationSrc, continuationUrl: continuationSrc, mbd: mbdEnabled, stem_split: stemValue, artist: artistName});
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
// mbd_progress handler удалён (фича отключена)
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

// Прогресс генерации (делегируем чат модулю)
socket.on('progress', function(data){ const pct=(data.progress*100||0).toFixed(1); const progEl=document.getElementById('chat-progress'); if(progEl){ progEl.style.display='block'; progEl.textContent='Генерация: '+pct+'%'; } if(window.onGenerationProgress) window.onGenerationProgress(pct); });
socket.on('on_finish_audio', function(){ const progEl=document.getElementById('chat-progress'); if(progEl){ progEl.style.display='none'; progEl.textContent=''; } if(window.clearProgressMessage) window.clearProgressMessage(); });

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

// Seed update
socket.on('update_seed', function(data){ try { if (typeof window.__autoSeedEnabled === 'function' && window.__autoSeedEnabled()) return; const s=data.seed; const r=document.getElementById('seed'); const n=document.getElementById('seed-text'); if(r && n && typeof s==='number'){ r.value=s; n.value=s; } } catch(e){ console.warn('Failed to update seed UI', e); } });

// Chat export/compact now handled in chat.js
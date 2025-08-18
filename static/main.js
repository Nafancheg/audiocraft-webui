var socket = io.connect('http://' + document.domain + ':' + location.port);

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
    audioSrc = audioElement.src;
    var appendCb = document.getElementById('append-continuation');
    var contAudio = document.getElementById('continuation-preview');
    var continuationSrc = (appendCb && appendCb.checked && contAudio && contAudio.src) ? contAudio.src : null;
    var mbd = document.getElementById('mbd_checkbox');
    var stemSel = document.getElementById('stem_split_select');
    // Удаляем предыдущие карточки (на случай если что-то осталось)
    (function(){
        const detail = document.getElementById('audio-detail');
        const host = detail && detail.querySelector('.audio-card-host');
        if (host){ host.querySelectorAll('.audio-item').forEach(n=>n.remove()); }
    })();
    var stemValue = stemSel ? stemSel.value : '';

    if (modelSize !== "melody" || audioSrc === "") {
        document.querySelectorAll('input[type="range"]').forEach(function(slider) {
            slidersData[slider.id] = slider.value;
        });
    socket.emit('submit_sliders', {values: slidersData, prompt:textData, model:modelSize, format: outFormat, sample_rate: outSampleRate, appendContinuation: !!continuationSrc, continuationUrl: continuationSrc, mbd: mbdEnabled, stem_split: stemValue, artist: artistName});
        return;
    }

    document.querySelectorAll('input[type="range"]').forEach(function(slider) {
        slidersData[slider.id] = slider.value;
    });
    socket.emit('submit_sliders', {values: slidersData, prompt:textData, model:modelSize, audioPromptUrl:audioSrc, format: outFormat, sample_rate: outSampleRate, appendContinuation: !!continuationSrc, continuationUrl: continuationSrc, mbd: mbdEnabled, stem_split: stemValue, artist: artistName});
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
// Stem split progress
function buildStemsMixerUI(card, promptText, stems){
    if (!stems || !stems.length) return;
    if (!window.__stemsAudioCtx) {
        try { window.__stemsAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { console.warn('AudioContext failed', e); }
    }
    const ACtx = window.__stemsAudioCtx;
    // Правый контейнер в #audio-detail
    const detail = document.getElementById('audio-detail');
    if (!detail) return;
    let rightPanel = detail.querySelector('.stems-side-panel');
    if (!rightPanel){
        rightPanel = document.createElement('div');
        rightPanel.className='stems-side-panel';
        rightPanel.style.flex='0 0 420px';
        rightPanel.style.display='flex';
        rightPanel.style.flexDirection='column';
        rightPanel.style.gap='12px';
        rightPanel.style.minHeight='100%';
        rightPanel.style.order='2'; // при row-reverse визуально слева
        detail.appendChild(rightPanel);
    }
    let toggleBtn = rightPanel.querySelector('.stems-toggle-btn');
    if (!toggleBtn){
        toggleBtn = document.createElement('button');
        toggleBtn.className='stems-toggle-btn';
        toggleBtn.textContent='Show stems';
        toggleBtn.style.alignSelf='flex-start';
        rightPanel.appendChild(toggleBtn);
    }
    let stemsContainer = rightPanel.querySelector('.stems-container');
    if (!stemsContainer){
        stemsContainer = document.createElement('div');
        stemsContainer.className='stems-container';
        stemsContainer.style.display='none';
        stemsContainer.style.padding='8px 10px';
        stemsContainer.style.background='rgba(255,255,255,0.05)';
        stemsContainer.style.border='1px solid rgba(255,255,255,0.12)';
        stemsContainer.style.borderRadius='8px';
        stemsContainer.style.maxHeight='520px';
        stemsContainer.style.overflowY='auto';
        rightPanel.appendChild(stemsContainer);
        toggleBtn.addEventListener('click', ()=>{
            const show = stemsContainer.style.display==='none';
            stemsContainer.style.display = show ? 'block':'none';
            toggleBtn.textContent = show ? 'Hide stems':'Show stems';
        });
    }
    if (!card.__stemsMixer) {
        card.__stemsMixer = { buffers:{}, gains:{}, sources:[], duration:0, playing:false, startTime:0 };
    }
    // Карточке назначим order, чтобы она отображалась справа (row-reverse)
    card.style.order='1';
    const mixer = card.__stemsMixer;
    mixer.stemPaths = stems.slice();
    stemsContainer.innerHTML='';
    const controls = document.createElement('div');
    controls.style.display='flex'; controls.style.alignItems='center'; controls.style.gap='12px';
    controls.style.marginBottom='8px';
    controls.style.flexWrap='wrap';
    const playBtn = document.createElement('button'); playBtn.textContent='Play'; playBtn.style.padding='4px 12px';
    const dlMixBtn = document.createElement('button'); dlMixBtn.textContent='Mix Checked'; dlMixBtn.style.padding='4px 10px'; dlMixBtn.title='Свести выбранные стемы в стерео WAV';
    const zipCheckedBtn = document.createElement('button'); zipCheckedBtn.textContent='Zip Checked'; zipCheckedBtn.style.padding='4px 10px'; zipCheckedBtn.title='ZIP выбранных стемов';
    const zipAllBtn = document.createElement('button'); zipAllBtn.textContent='Download All'; zipAllBtn.style.padding='4px 10px'; zipAllBtn.title='ZIP всех стемов';
    const progressWrap = document.createElement('div');
    progressWrap.style.flex='1 1 260px';
    progressWrap.style.height='10px'; progressWrap.style.background='rgba(255,255,255,0.1)';
    progressWrap.style.borderRadius='5px';
    const progressBar = document.createElement('div');
    progressBar.style.height='100%'; progressBar.style.width='0%'; progressBar.style.background='linear-gradient(90deg,#4ac2ff,#9b6bff)'; progressBar.style.borderRadius='5px';
    progressWrap.appendChild(progressBar);
    // Download all hint (per-stem links below) – optional placeholder
    const info = document.createElement('small'); info.style.opacity='.6'; info.textContent='Mute via checkboxes; click ↓ to download stem';
    controls.appendChild(playBtn); controls.appendChild(dlMixBtn); controls.appendChild(zipCheckedBtn); controls.appendChild(zipAllBtn); controls.appendChild(progressWrap); controls.appendChild(info);
    stemsContainer.appendChild(controls);
    const list = document.createElement('div'); list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='4px'; stemsContainer.appendChild(list);
    mixer.stemPaths.forEach(path => {
        const row = document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='6px'; row.style.flexWrap='wrap';
        const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=true; cb.style.margin='0';
        const name = path.split('/').pop();
        const label = document.createElement('span'); label.textContent=name; label.style.fontSize='12px'; label.style.flex='1';
        const vol = document.createElement('input'); vol.type='range'; vol.min='0'; vol.max='2'; vol.step='0.01'; vol.value='1'; vol.style.width='100px'; vol.title='Громкость';
        const volNum = document.createElement('span'); volNum.textContent='1.00'; volNum.style.fontSize='10px'; volNum.style.opacity='.7';
        vol.addEventListener('input', ()=>{ volNum.textContent=parseFloat(vol.value).toFixed(2); if (mixer.gains[name]) mixer.gains[name].gain.value = cb.checked?parseFloat(vol.value):0; });
        const solo = document.createElement('span'); solo.textContent='Solo'; solo.style.cursor='pointer'; solo.style.fontSize='11px'; solo.style.padding='2px 6px'; solo.style.border='1px solid rgba(255,255,255,0.2)'; solo.style.borderRadius='4px'; solo.style.opacity='.65';
        solo.addEventListener('click', ()=>{
            if (mixer.solo === name) { // cancel solo
                mixer.solo = null; solo.style.background='';
                list.querySelectorAll('div').forEach(r=>{
                    const c=r.querySelector('input[type=checkbox]'); const nm=r.querySelector('span');
                    if (c && nm){ const n2=nm.textContent; if (mixer.gains[n2]) mixer.gains[n2].gain.value = c.checked?parseFloat(r.querySelector('input[type=range]').value):0; }
                });
            } else {
                mixer.solo = name; list.querySelectorAll('div').forEach(r=>{ const nm=r.querySelector('span'); const range=r.querySelector('input[type=range]'); const n2=nm.textContent; const sBtn=r.querySelector('span:nth-of-type(3)'); if (sBtn) sBtn.style.background=''; if (mixer.gains[n2]) mixer.gains[n2].gain.value = (n2===name)?parseFloat(range.value):0; }); solo.style.background='rgba(255,255,255,0.15)';
            }
        });
    const dl = document.createElement('a'); dl.textContent='↓'; dl.href=path; dl.download=name; dl.style.textDecoration='none'; dl.title='Download'; dl.style.fontWeight='bold'; dl.style.fontSize='14px'; dl.style.color='#fff';
        cb.addEventListener('change', ()=>{ if (mixer.gains[name]) mixer.gains[name].gain.value = (cb.checked && (!mixer.solo || mixer.solo===name))? parseFloat(vol.value):0; });
        row.appendChild(cb); row.appendChild(label); row.appendChild(vol); row.appendChild(volNum); row.appendChild(solo); row.appendChild(dl); list.appendChild(row);
    });
    function stopAll(){ mixer.sources.forEach(s=>{ try{s.stop();}catch(e){} }); mixer.sources=[]; mixer.playing=false; playBtn.textContent='Play'; }
    function loadAndPlay(){ if (!ACtx) return; const promises = mixer.stemPaths.map(p=>{ const n=p.split('/').pop(); if (mixer.buffers[n]) return Promise.resolve({n,buf:mixer.buffers[n]}); return fetch(p).then(r=>r.arrayBuffer()).then(ab=>ACtx.decodeAudioData(ab)).then(b=>{mixer.buffers[n]=b; return {n,buf:b};}); }); Promise.all(promises).then(res=>{ mixer.duration=Math.max(...res.map(r=>r.buf.duration)); mixer.sources=[]; const startAt=ACtx.currentTime+0.05; res.forEach(r=>{ const src=ACtx.createBufferSource(); src.buffer=r.buf; const g=ACtx.createGain(); mixer.gains[r.n]=g; // apply mute/volume state
            const rowDiv = Array.from(list.children).find(ch=>ch.querySelector('span') && ch.querySelector('span').textContent===r.n);
            const cb=rowDiv?rowDiv.querySelector('input[type=checkbox]'):null; const vol=rowDiv?rowDiv.querySelector('input[type=range]'):null;
            let gainVal = 1; if (vol) gainVal=parseFloat(vol.value); if (!cb || !cb.checked) gainVal=0; g.gain.value=gainVal; src.connect(g).connect(ACtx.destination); src.start(startAt); mixer.sources.push(src); }); mixer.startTime=startAt; mixer.playing=true; playBtn.textContent='Stop'; function tick(){ if(!mixer.playing) return; const elapsed=ACtx.currentTime-mixer.startTime; const pct=Math.min(1, elapsed/mixer.duration); progressBar.style.width=(pct*100).toFixed(1)+'%'; if(pct>=1){ stopAll(); return;} requestAnimationFrame(tick);} requestAnimationFrame(tick); }).catch(err=>{ console.warn('Stem load/play failed', err); stopAll(); }); }
    playBtn.addEventListener('click', ()=>{ if (mixer.playing) stopAll(); else { stopAll(); loadAndPlay(); } });
    // WAV encoder helper (stereo if channels=2)
    function encodeWav(channelsData, sampleRate){
        const channels = channelsData.length;
        const len = channelsData[0].length;
        const bytesPerSample = 2;
        const blockAlign = channels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = len * blockAlign;
        const buf = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buf);
        function writeStr(o,s){ for(let i=0;i<s.length;i++) view.setUint8(o+i, s.charCodeAt(i)); }
        writeStr(0,'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8,'WAVE'); writeStr(12,'fmt ');
        view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true);
        view.setUint32(24,sampleRate,true); view.setUint32(28,byteRate,true); view.setUint16(32,blockAlign,true); view.setUint16(34,16,true);
        writeStr(36,'data'); view.setUint32(40,dataSize,true);
        let offset=44;
        for (let i=0;i<len;i++){
            for (let ch=0; ch<channels; ch++){
                let s = Math.max(-1, Math.min(1, channelsData[ch][i]));
                view.setInt16(offset, s<0 ? s*0x8000 : s*0x7FFF, true);
                offset += 2;
            }
        }
        return new Blob([view], {type:'audio/wav'});
    }
    dlMixBtn.addEventListener('click', ()=>{
        const rows = Array.from(stemsContainer.querySelectorAll('div > div'));// rough
        const checked = Array.from(list.querySelectorAll('input[type=checkbox]')).filter(cb=>cb.checked).map(cb=>cb.nextSibling.textContent);
        if (!checked.length){ alert('Нет выбранных стемов'); return; }
        const ensureBuffers = checked.map(name => {
            const path = mixer.stemPaths.find(p=>p.endsWith('/'+name) || p.endsWith('\\'+name));
            if (!path) return Promise.reject('missing '+name);
            if (mixer.buffers[name]) return Promise.resolve({name, buffer: mixer.buffers[name]});
            return fetch(path).then(r=>r.arrayBuffer()).then(ab=>ACtx.decodeAudioData(ab)).then(buf=>{ mixer.buffers[name]=buf; return {name, buffer:buf}; });
        });
        Promise.all(ensureBuffers).then(res => {
            // Stereo mix: sum each channel separately, expand mono
            const sr = res[0].buffer.sampleRate;
            const maxLen = Math.max(...res.map(r=>r.buffer.length));
            const mixL = new Float32Array(maxLen);
            const mixR = new Float32Array(maxLen);
            res.forEach(r=>{
                const buf = r.buffer;
                const volRow = Array.from(list.children).find(ch=>ch.querySelector('span') && ch.querySelector('span').textContent===r.name);
                let volVal = 1; if (volRow){ const volInput = volRow.querySelector('input[type=range]'); if (volInput) volVal = parseFloat(volInput.value); }
                const chL = buf.getChannelData(0);
                const chR = buf.numberOfChannels>1 ? buf.getChannelData(1) : chL;
                for (let i=0;i<buf.length;i++){
                    mixL[i] += chL[i]*volVal;
                    mixR[i] += chR[i]*volVal;
                }
            });
            // Normalize softly if peak >1
            let peak = 0; for (let i=0;i<maxLen;i++){ const a=Math.abs(mixL[i]); if (a>peak) peak=a; const b=Math.abs(mixR[i]); if (b>peak) peak=b; }
            if (peak>1){ const g=1/peak; for (let i=0;i<maxLen;i++){ mixL[i]*=g; mixR[i]*=g; } }
            const blob = encodeWav([mixL,mixR], sr);
            const a = document.createElement('a');
            const dateTag = new Date().toISOString().replace(/[:.]/g,'');
            a.href = URL.createObjectURL(blob);
            a.download = `mix_${checked.map(n=>n.replace(/\.wav$/,'')).join('+')}_${dateTag}.wav`;
            document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        }).catch(err => { console.warn('Mix download failed', err); alert('Ошибка формирования микса: '+err); });
    });
    // --- ZIP helpers ---
    function crc32(buf){ const table = window.__crcTable || (window.__crcTable = (function(){ let c; const t=[]; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c = ((c&1)?(0xEDB88320^(c>>>1)):(c>>>1)); t[n]=c>>>0;} return t; })()); let crc=-1; for(let i=0;i<buf.length;i++){ crc=(crc>>>8)^t[(crc^buf[i])&0xFF]; } return (crc^(-1))>>>0; }
    function buildZip(files){ // files: [{name, data:Uint8Array}]
        const encoder = new TextEncoder();
        let localParts=[]; let centralParts=[]; let offset=0;
        files.forEach(f=>{
            const nameBytes = encoder.encode(f.name);
            const crc = crc32(f.data);
            const compSize = f.data.length; const uncompSize = compSize; // store only
            const local = new ArrayBuffer(30 + nameBytes.length + compSize);
            const dv = new DataView(local); let p=0;
            function w16(v){ dv.setUint16(p,v,true); p+=2; }
            function w32(v){ dv.setUint32(p,v,true); p+=4; }
            w32(0x04034b50); w16(20); w16(0); w16(0); w16(0); w16(0); w32(crc); w32(compSize); w32(uncompSize); w16(nameBytes.length); w16(0);
            new Uint8Array(local, p, nameBytes.length).set(nameBytes); p+=nameBytes.length;
            new Uint8Array(local, p, compSize).set(f.data);
            localParts.push(new Uint8Array(local));
            // Central dir entry
            const central = new ArrayBuffer(46 + nameBytes.length);
            const dv2 = new DataView(central); let q=0;
            function w216(v){ dv2.setUint16(q,v,true); q+=2; }
            function w232(v){ dv2.setUint32(q,v,true); q+=4; }
            w232(0x02014b50); w216(20); w216(20); w216(0); w216(0); w216(0); w216(0); w232(crc); w232(compSize); w232(uncompSize); w216(nameBytes.length); w216(0); w216(0); w216(0); w216(0); w232(0); w232(offset); w216(0);
            new Uint8Array(central, q, nameBytes.length).set(nameBytes);
            centralParts.push(new Uint8Array(central));
            offset += local.byteLength;
        });
        const centralSize = centralParts.reduce((a,p)=>a+p.length,0);
        const centralOffset = offset;
        const end = new ArrayBuffer(22); const dv3=new DataView(end); let e=0; function ew16(v){ dv3.setUint16(e,v,true); e+=2;} function ew32(v){ dv3.setUint32(e,v,true); e+=4; }
        ew32(0x06054b50); ew16(0); ew16(0); ew16(files.length); ew16(files.length); ew32(centralSize); ew32(centralOffset); ew16(0);
        const blobParts=[...localParts, ...centralParts, new Uint8Array(end)];
        return new Blob(blobParts, {type:'application/zip'});
    }
    function downloadZip(selectedNames){
        if (!selectedNames.length){ alert('Нет выбранных стемов'); return; }
        const fetches = selectedNames.map(name=>{
            const path = mixer.stemPaths.find(p=>p.endsWith('/'+name) || p.endsWith('\\'+name));
            if (!path) return Promise.reject('missing '+name);
            return fetch(path).then(r=>r.arrayBuffer()).then(ab=>({name, data:new Uint8Array(ab)}));
        });
        Promise.all(fetches).then(files=>{
            const zip = buildZip(files);
            const a=document.createElement('a'); const dateTag=new Date().toISOString().replace(/[:.]/g,''); a.href=URL.createObjectURL(zip); a.download=`stems_${selectedNames.length}_${dateTag}.zip`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},2000);
        }).catch(err=>{ console.warn('zip failed', err); alert('Ошибка ZIP: '+err); });
    }
    zipCheckedBtn.addEventListener('click', ()=>{
        const checked = Array.from(list.querySelectorAll('input[type=checkbox]')).filter(cb=>cb.checked).map(cb=>cb.nextSibling.textContent);
        downloadZip(checked);
    });
    zipAllBtn.addEventListener('click', ()=>{
        const all = mixer.stemPaths.map(p=>p.split('/').pop());
        downloadZip(all);
    });
}
socket.on('stem_progress', function(data){
    if (!data) return;
    const isFinal = Array.isArray(data.stems) && data.stems.length;
    // Ищем карточку по data-prompt
    let card = document.querySelector(`#audio-detail .audio-item[data-prompt="${CSS.escape(data.prompt||'')}"]`);
    // Если нет карточки, но финальный набор стемов — создаём её на лету
    if (!card && isFinal && window.__promptFileMap && window.__promptFileMap[data.prompt]){
        const ref = window.__promptFileMap[data.prompt];
        try { fetch(ref.json).then(r=>r.json()).then(j=>{ renderDetail(j, ref.filename); setTimeout(()=>{ try{ const c2=document.querySelector('#audio-detail .audio-item'); if(c2) buildStemsMixerUI(c2, data.prompt, data.stems); }catch(e){} }, 50); }); } catch(e){ console.warn('auto renderDetail for stems failed', e); }
        return;
    }
    if (!card) return; // нечего обновлять
    if (isFinal){
        buildStemsMixerUI(card, data.prompt, data.stems);
        return;
    }
    // Плейсхолдер прогресса размещаем в правой панели
    const detail = document.getElementById('audio-detail');
    let rightPanel = detail ? detail.querySelector('.stems-side-panel') : null;
    if (!rightPanel){
        rightPanel = document.createElement('div');
        rightPanel.className='stems-side-panel';
        rightPanel.style.flex='0 0 420px';
        rightPanel.style.display='flex';
        rightPanel.style.flexDirection='column';
        rightPanel.style.gap='12px';
        rightPanel.style.minHeight='100%';
        detail.appendChild(rightPanel);
    }
    let placeholder = rightPanel.querySelector('.stems-progress-placeholder');
    if (!placeholder){
        placeholder = document.createElement('div');
        placeholder.className = 'stems-progress-placeholder';
        placeholder.style.padding='8px 12px';
        placeholder.style.border='1px dashed rgba(255,255,255,0.25)';
        placeholder.style.borderRadius='6px';
        placeholder.style.fontSize='12px';
        placeholder.style.opacity='.85';
        const barWrap = document.createElement('div');
        barWrap.style.height='6px'; barWrap.style.background='rgba(255,255,255,0.15)'; barWrap.style.borderRadius='3px'; barWrap.style.marginTop='4px';
        const bar = document.createElement('div');
        bar.style.height='100%'; bar.style.width='0%'; bar.style.background='linear-gradient(90deg,#6bd4ff,#b08dff)'; bar.style.borderRadius='3px';
        barWrap.appendChild(bar);
        const text = document.createElement('div'); text.className='stems-progress-text'; text.textContent='Stems: preparing...';
        placeholder.appendChild(text); placeholder.appendChild(barWrap);
        rightPanel.appendChild(placeholder);
    }
    const bar = placeholder.querySelector('div > div');
    const text = placeholder.querySelector('.stems-progress-text');
    if (typeof data.progress === 'number' && bar){ bar.style.width = (data.progress*100).toFixed(1)+'%'; }
    if (text){
        let stage = data.stage || '';
        if (stage === 'start') stage = 'starting';
        else if (stage === 'demucs') stage = 'separating';
        else if (stage === 'files') stage = 'writing';
        text.textContent = `Stems: ${stage} ${(data.progress*100||0).toFixed(0)}%`;
    }
});

function renderDetail(json_data, filename){
    const detail = document.getElementById('audio-detail');
    if (!detail) return;
    const host = detail.querySelector('.audio-card-host');
    if (!host) return;
    // Guard: если уже показан этот же файл и нет новых стемов — не перерисовываем
    try {
        const existing = host.querySelector('.audio-item');
        if (existing && existing.dataset.file === filename) {
            // Проверяем, появились ли новые стемы в json_data
            const hadStems = existing.dataset.stems === '1';
            let hasStemsNow = false;
            if (json_data.postprocess && Array.isArray(json_data.postprocess.tasks)) {
                const stemTask = json_data.postprocess.tasks.find(t=>t.type==='stem_split' && t.stems && t.stems.length);
                if (stemTask) hasStemsNow = true;
            }
            if (!hasStemsNow || (hasStemsNow && hadStems)) {
                return; // ничего нового
            }
        }
    } catch(e){}
    // Удаляем любые старые карточки вне host (защита от старых версий)
    detail.querySelectorAll(':scope > .audio-item').forEach(el=>el.remove());
    // Очищаем контейнер карточки
    host.innerHTML='';
    // Если у новой песни нет стемов, скрываем/удаляем прошлую кнопку и контейнер стемов
    try {
        const stemsPanel = detail.querySelector('.stems-side-panel');
        if (stemsPanel){
            const tasks = json_data && json_data.postprocess && Array.isArray(json_data.postprocess.tasks) ? json_data.postprocess.tasks : [];
            const stemTask = tasks.find(t=>t.type==='stem_split' && t.stems && t.stems.length);
            if (!stemTask){
                const sc = stemsPanel.querySelector('.stems-container'); if (sc) sc.remove();
                const ph = stemsPanel.querySelector('.stems-progress-placeholder'); if (ph) ph.remove();
                const btn = stemsPanel.querySelector('.stems-toggle-btn'); if (btn) btn.remove();
            }
        }
    } catch(e){ console.warn('stems panel cleanup failed', e); }
    const card = document.createElement('div');
    card.className='audio-item';
    card.style.maxWidth='100%';
    card.dataset.file = filename;
    // Имя песни = базовое имя файла без расширения
    const baseName = (filename||'').split('/').pop().split('\\').pop();
    const displayName = baseName.replace(/\.[a-z0-9]+$/i,'');
    const title = document.createElement('div'); title.className='audio-item-text'; title.textContent=displayName; card.appendChild(title);
    if (json_data.prompt) card.setAttribute('data-prompt', json_data.prompt);
    // Кастомный аудиоплеер
    const audio = document.createElement('audio');
    audio.preload='metadata';
    const src=document.createElement('source'); src.src=filename; const lower=filename.toLowerCase(); if (lower.endsWith('.mp3')) src.type='audio/mpeg'; else if (lower.endsWith('.flac')) src.type='audio/flac'; else src.type='audio/wav'; audio.appendChild(src);
    audio.style.display='none';
    card.appendChild(audio);
    const player = document.createElement('div'); player.className='custom-player';
    player.innerHTML = `
        <button class="cp-btn cp-play" aria-label="Play/Pause">▶</button>
        <div class="cp-timeline-wrap">
            <div class="cp-timeline"><div class="cp-progress"></div></div>
            <div class="cp-time"><span class="cp-cur">0:00</span> / <span class="cp-dur">--:--</span></div>
        </div>
        <div class="cp-right">
            <input type="range" class="cp-vol" min="0" max="1" step="0.01" value="1" aria-label="Volume">
            <button class="cp-btn cp-loop" title="Loop">∞</button>
            <a class="cp-btn cp-dl" download="${displayName}.wav" aria-label="Download">⬇</a>
        </div>`;
    card.appendChild(player);
    const btnPlay = player.querySelector('.cp-play');
    const progressBar = player.querySelector('.cp-progress');
    const timeline = player.querySelector('.cp-timeline');
    const curEl = player.querySelector('.cp-cur');
    const durEl = player.querySelector('.cp-dur');
    const vol = player.querySelector('.cp-vol');
    const loopBtn = player.querySelector('.cp-loop');
    const dl = player.querySelector('.cp-dl'); dl.href=filename;
    let dragging = false;
    function fmt(sec){ if(!isFinite(sec)) return '--:--'; const m=Math.floor(sec/60); const s=Math.floor(sec%60); return m+':' + (s<10?'0'+s:s); }
    btnPlay.addEventListener('click',()=>{ if(audio.paused){ pauseAllCustomPlayers(); audio.play(); } else audio.pause(); });
    audio.addEventListener('play',()=>{ btnPlay.textContent='⏸'; btnPlay.classList.add('playing'); });
    audio.addEventListener('pause',()=>{ btnPlay.textContent='▶'; btnPlay.classList.remove('playing'); });
    audio.addEventListener('loadedmetadata',()=>{ durEl.textContent=fmt(audio.duration); });
    audio.addEventListener('timeupdate',()=>{ if(dragging) return; const r=audio.currentTime / (audio.duration||1); progressBar.style.width=(r*100)+'%'; curEl.textContent=fmt(audio.currentTime); });
    function seek(e){ const rect=timeline.getBoundingClientRect(); const x=Math.min(Math.max(0,e.clientX-rect.left),rect.width); const ratio = x/rect.width; audio.currentTime = ratio * (audio.duration||0); }
    timeline.addEventListener('mousedown',(e)=>{ dragging=true; seek(e); });
    window.addEventListener('mousemove',(e)=>{ if(dragging) seek(e); });
    window.addEventListener('mouseup',()=>{ dragging=false; });
    vol.addEventListener('input',()=>{ audio.volume=parseFloat(vol.value); });
    loopBtn.addEventListener('click',()=>{ audio.loop=!audio.loop; loopBtn.classList.toggle('active', audio.loop); });
    function pauseAllCustomPlayers(){ document.querySelectorAll('.custom-player').forEach(pl=>{ const a=pl.previousSibling && pl.previousSibling.tagName==='AUDIO'? pl.previousSibling:null; if(a && a!==audio && !a.paused){ try{ a.pause(); }catch(_){} } }); }
    const paramsWrap = document.createElement('div'); paramsWrap.className='audio-item-params';
    const modelDiv=document.createElement('div'); modelDiv.className='audio-item-text'; modelDiv.textContent=`Model: ${json_data.model}`; paramsWrap.appendChild(modelDiv);
    let seedValue=null;
    for (const key in json_data.parameters){
        const val = json_data.parameters[key];
        if (/^continuation_/.test(key) || key==='append_mode') continue;
        if (key==='format_requested' && json_data.parameters['format']===val) continue;
        const p=document.createElement('div'); p.className='audio-item-text';
        if (['seed','cfg_seed','sid'].includes(key)){ seedValue=val; p.textContent=`Seed: ${val}`; } else { p.textContent=`${key}: ${val}`; }
        paramsWrap.appendChild(p);
    }
    if (json_data.parameters.append_mode){
        const origSecs = json_data.parameters.continuation_original_seconds;
        const contLine=document.createElement('div'); contLine.className='audio-item-text'; contLine.textContent=`Continuation: orig ${origSecs!=null?origSecs+'s':'?'}`; paramsWrap.appendChild(contLine);
    }
    if (seedValue!==null){
        const copyBtn=document.createElement('button'); copyBtn.textContent='Copy Seed'; copyBtn.style.margin='4px 6px 8px 0'; copyBtn.addEventListener('click',()=>{ try{navigator.clipboard.writeText(String(seedValue)); copyBtn.textContent='Copied'; setTimeout(()=>copyBtn.textContent='Copy Seed',1200);}catch(e){copyBtn.textContent='Fail'; setTimeout(()=>copyBtn.textContent='Copy Seed',1200);} }); card.appendChild(copyBtn);
    }
    // Rerun button – повторная генерация с теми же параметрами
    (function(){
        try {
            const rerunBtn = document.createElement('button');
            rerunBtn.textContent = (I18N_STRINGS[(document.getElementById('lang-select')||{value:'en'}).value]||I18N_STRINGS.en).rerun || 'Rerun';
            rerunBtn.style.margin='4px 6px 8px 0';
            rerunBtn.addEventListener('click', ()=>{
                try {
                    const params = JSON.parse(JSON.stringify(json_data.parameters||{}));
                    const values = {};
                    ['top_k','duration','cfg_coef','top_p','temperature','seed'].forEach(k=>{ if(params[k]!==undefined) values[k]=params[k]; });
                    const payload = {
                        values: values,
                        prompt: json_data.prompt || '',
                        model: json_data.model || 'large',
                        format: params.format || 'wav',
                        sample_rate: (params.sample_rate===undefined? 'original': params.sample_rate),
                        appendContinuation: !!params.append_mode && !!params.continuation_source,
                        continuationUrl: params.append_mode? params.continuation_source: null,
                        mbd: (params.multi_band_diffusion && params.multi_band_diffusion.requested) || false,
                        stem_split: (params.stem_split && params.stem_split.requested) || '',
                        artist: params.artist || null
                    };
                    // Если авто seed активен (UI), и seed >=0 — даём возможность пересоздать новый seed
                    try {
                        if (typeof window.__autoSeedEnabled==='function' && window.__autoSeedEnabled()) {
                            payload.values.seed = -1; // сервер задаст новый и обновит
                        }
                    } catch(_){ }
                    socket.emit('submit_sliders', payload);
                } catch(err){ console.warn('rerun emit failed', err); }
            });
            card.appendChild(rerunBtn);
        } catch(e) { console.warn('Rerun setup failed', e); }
    })();
    const delBtn=document.createElement('button'); delBtn.textContent='Delete'; delBtn.style.margin='4px 0 8px 0';
    delBtn.addEventListener('click',()=>{
        deleteAudio(filename, card);
        // Очищаем только host, не уничтожая панель стемов целиком
        host.innerHTML='';
        const stemsPanel = detail.querySelector('.stems-side-panel');
        if (stemsPanel){
            const sc = stemsPanel.querySelector('.stems-container'); if (sc) sc.remove();
            const ph = stemsPanel.querySelector('.stems-progress-placeholder'); if (ph) ph.remove();
        }
    });
    card.appendChild(delBtn);
    card.appendChild(paramsWrap);
    // Stems if exist
    try { if (json_data.postprocess && Array.isArray(json_data.postprocess.tasks)){ const stemTask=json_data.postprocess.tasks.find(t=>t.type==='stem_split' && t.stems && t.stems.length); if (stemTask){ buildStemsMixerUI(card, json_data.prompt, stemTask.stems); } } } catch(e){}
    host.appendChild(card);
}


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
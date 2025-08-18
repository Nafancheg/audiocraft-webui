// Stems mixer module
// Exports:
//  buildStemsMixerUI(card, promptText, stems)
//  attachStemProgressHandlers(socket) – sets up socket listener for stem_progress

export function buildStemsMixerUI(card, promptText, stems){
	if (!stems || !stems.length) return;
	if (!window.__stemsAudioCtx) {
		try { window.__stemsAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { console.warn('AudioContext failed', e); }
	}
	const ACtx = window.__stemsAudioCtx;
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
		rightPanel.style.order='2';
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
			if (mixer.solo === name) {
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
	function loadAndPlay(){ if (!ACtx) return; const promises = mixer.stemPaths.map(p=>{ const n=p.split('/').pop(); if (mixer.buffers[n]) return Promise.resolve({n,buf:mixer.buffers[n]}); return fetch(p).then(r=>r.arrayBuffer()).then(ab=>ACtx.decodeAudioData(ab)).then(b=>{mixer.buffers[n]=b; return {n,buf:b};}); }); Promise.all(promises).then(res=>{ mixer.duration=Math.max(...res.map(r=>r.buf.duration)); mixer.sources=[]; const startAt=ACtx.currentTime+0.05; res.forEach(r=>{ const src=ACtx.createBufferSource(); src.buffer=r.buf; const g=ACtx.createGain(); mixer.gains[r.n]=g; const rowDiv = Array.from(list.children).find(ch=>ch.querySelector('span') && ch.querySelector('span').textContent===r.n); const cb=rowDiv?rowDiv.querySelector('input[type=checkbox]'):null; const vol=rowDiv?rowDiv.querySelector('input[type=range]'):null; let gainVal = 1; if (vol) gainVal=parseFloat(vol.value); if (!cb || !cb.checked) gainVal=0; g.gain.value=gainVal; src.connect(g).connect(ACtx.destination); src.start(startAt); mixer.sources.push(src); }); mixer.startTime=startAt; mixer.playing=true; playBtn.textContent='Stop'; function tick(){ if(!mixer.playing) return; const elapsed=ACtx.currentTime-mixer.startTime; const pct=Math.min(1, elapsed/mixer.duration); progressBar.style.width=(pct*100).toFixed(1)+'%'; if(pct>=1){ stopAll(); return;} requestAnimationFrame(tick);} requestAnimationFrame(tick); }).catch(err=>{ console.warn('Stem load/play failed', err); stopAll(); }); }
	playBtn.addEventListener('click', ()=>{ if (mixer.playing) stopAll(); else { stopAll(); loadAndPlay(); } });
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
		const checked = Array.from(list.querySelectorAll('input[type=checkbox]')).filter(cb=>cb.checked).map(cb=>cb.nextSibling.textContent);
		if (!checked.length){ alert('Нет выбранных стемов'); return; }
		const ensureBuffers = checked.map(name => {
			const path = mixer.stemPaths.find(p=>p.endsWith('/'+name) || p.endsWith('\\'+name));
			if (!path) return Promise.reject('missing '+name);
			if (mixer.buffers[name]) return Promise.resolve({name, buffer: mixer.buffers[name]});
			return fetch(path).then(r=>r.arrayBuffer()).then(ab=>ACtx.decodeAudioData(ab)).then(buf=>{ mixer.buffers[name]=buf; return {name, buffer:buf}; });
		});
		Promise.all(ensureBuffers).then(res => {
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
	function crc32(buf){ const table = window.__crcTable || (window.__crcTable = (function(){ let c; const t=[]; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c = ((c&1)?(0xEDB88320^(c>>>1)):(c>>>1)); t[n]=c>>>0;} return t; })()); let crc=-1; for(let i=0;i<buf.length;i++){ crc=(crc>>>8)^t[(crc^buf[i])&0xFF]; } return (crc^(-1))>>>0; }
	function buildZip(files){
		const encoder = new TextEncoder();
		let localParts=[]; let centralParts=[]; let offset=0;
		files.forEach(f=>{
			const nameBytes = encoder.encode(f.name);
			const crc = crc32(f.data);
			const compSize = f.data.length; const uncompSize = compSize;
			const local = new ArrayBuffer(30 + nameBytes.length + compSize);
			const dv = new DataView(local); let p=0;
			function w16(v){ dv.setUint16(p,v,true); p+=2; }
			function w32(v){ dv.setUint32(p,v,true); p+=4; }
			w32(0x04034b50); w16(20); w16(0); w16(0); w16(0); w16(0); w32(crc); w32(compSize); w32(uncompSize); w16(nameBytes.length); w16(0);
			new Uint8Array(local, p, nameBytes.length).set(nameBytes); p+=nameBytes.length;
			new Uint8Array(local, p, compSize).set(f.data);
			localParts.push(new Uint8Array(local));
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

export function attachStemProgressHandlers(socket){
	socket.on('stem_progress', function(data){
		if (!data) return;
		const isFinal = Array.isArray(data.stems) && data.stems.length;
		let card = document.querySelector(`#audio-detail .audio-item[data-prompt="${CSS.escape(data.prompt||'')}"]`);
		if (!card && isFinal && window.__promptFileMap && window.__promptFileMap[data.prompt]){
			const ref = window.__promptFileMap[data.prompt];
			try { fetch(ref.json).then(r=>r.json()).then(j=>{ window.renderDetail && window.renderDetail(j, ref.filename); setTimeout(()=>{ try{ const c2=document.querySelector('#audio-detail .audio-item'); if(c2) buildStemsMixerUI(c2, data.prompt, data.stems); }catch(e){} }, 50); }); } catch(e){ console.warn('auto renderDetail for stems failed', e); }
			return;
		}
		if (!card) return;
		if (isFinal){ buildStemsMixerUI(card, data.prompt, data.stems); return; }
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
}

// Legacy global exposure
window.buildStemsMixerUI = buildStemsMixerUI;

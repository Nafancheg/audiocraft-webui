import { buildStemsMixerUI } from './stems.js';

export function renderDetail(json_data, filename){
	const detail = document.getElementById('audio-detail');
	if (!detail) return;
	const host = detail.querySelector('.audio-card-host');
	if (!host) return;
	try {
		const existing = host.querySelector('.audio-item');
		if (existing && existing.dataset.file === filename) {
			const hadStems = existing.dataset.stems === '1';
			let hasStemsNow = false;
			if (json_data.postprocess && Array.isArray(json_data.postprocess.tasks)) {
				const stemTask = json_data.postprocess.tasks.find(t=>t.type==='stem_split' && t.stems && t.stems.length);
				if (stemTask) hasStemsNow = true;
			}
			if (!hasStemsNow || (hasStemsNow && hadStems)) {
				return;
			}
		}
	} catch(e){}
	detail.querySelectorAll(':scope > .audio-item').forEach(el=>el.remove());
	host.innerHTML='';
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
	const baseName = (filename||'').split('/').pop().split('\\').pop();
	const displayName = baseName.replace(/\.[a-z0-9]+$/i,'');
	const title = document.createElement('div'); title.className='audio-item-text'; title.textContent=displayName; card.appendChild(title);
	if (json_data.prompt) card.setAttribute('data-prompt', json_data.prompt);
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
		var actionsBar = card.querySelector('.audio-actions-bar');
		if(!actionsBar){
			actionsBar = document.createElement('div');
			actionsBar.className='audio-actions-bar';
			actionsBar.style.display='flex';
			actionsBar.style.flexWrap='wrap';
			actionsBar.style.gap='6px';
			actionsBar.style.margin='4px 0 8px';
			card.appendChild(actionsBar);
		}
		const copyBtn=document.createElement('button'); copyBtn.textContent='Copy Seed'; copyBtn.addEventListener('click',()=>{ try{navigator.clipboard.writeText(String(seedValue)); copyBtn.textContent='Copied'; setTimeout(()=>copyBtn.textContent='Copy Seed',1200);}catch(e){copyBtn.textContent='Fail'; setTimeout(()=>copyBtn.textContent='Copy Seed',1200);} }); actionsBar.appendChild(copyBtn);
	}
	(function(){
		try {
			var actionsBar = card.querySelector('.audio-actions-bar');
			if(!actionsBar){
				actionsBar = document.createElement('div');
				actionsBar.className='audio-actions-bar';
				actionsBar.style.display='flex';
				actionsBar.style.flexWrap='wrap';
				actionsBar.style.gap='6px';
				actionsBar.style.margin='4px 0 8px';
				card.appendChild(actionsBar);
			}
			const rerunBtn = document.createElement('button');
			const langSel = document.getElementById('lang-select');
			const lang = langSel? langSel.value : 'en';
			const dict = (window.I18N_STRINGS && window.I18N_STRINGS[lang]) || (window.I18N_STRINGS && window.I18N_STRINGS.en) || {};
			rerunBtn.textContent = dict.rerun || 'Rerun';
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
					try { if (typeof window.__autoSeedEnabled==='function' && window.__autoSeedEnabled()) { payload.values.seed = -1; } } catch(_){ }
					window.socket && window.socket.emit('submit_sliders', payload);
				} catch(err){ console.warn('rerun emit failed', err); }
			});
			actionsBar.appendChild(rerunBtn);
		} catch(e) { console.warn('Rerun setup failed', e); }
	})();
	var actionsBar = card.querySelector('.audio-actions-bar');
	if(!actionsBar){
		actionsBar = document.createElement('div');
		actionsBar.className='audio-actions-bar';
		actionsBar.style.display='flex';
		actionsBar.style.flexWrap='wrap';
		actionsBar.style.gap='6px';
		actionsBar.style.margin='4px 0 8px';
		card.appendChild(actionsBar);
	}
	const delBtn=document.createElement('button'); delBtn.textContent='Delete';
	delBtn.addEventListener('click',()=>{
		deleteAudio(filename, card);
		host.innerHTML='';
		const stemsPanel = detail.querySelector('.stems-side-panel');
		if (stemsPanel){
			const sc = stemsPanel.querySelector('.stems-container'); if (sc) sc.remove();
			const ph = stemsPanel.querySelector('.stems-progress-placeholder'); if (ph) ph.remove();
		}
	});
	actionsBar.appendChild(delBtn);
	card.appendChild(paramsWrap);
	try { if (json_data.postprocess && Array.isArray(json_data.postprocess.tasks)){ const stemTask=json_data.postprocess.tasks.find(t=>t.type==='stem_split' && t.stems && t.stems.length); if (stemTask){ buildStemsMixerUI(card, json_data.prompt, stemTask.stems); } } } catch(e){}
	host.appendChild(card);
}

// expose globally for legacy inline scripts
window.renderDetail = renderDetail;

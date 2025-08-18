// Custom audio player attachment.
// Usage: attachCustomPlayer(cardElement, filename, displayName)
// Returns { audio, playerDiv }

export function attachCustomPlayer(card, filename, displayName){
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
	function pauseAllCustomPlayers(){ document.querySelectorAll('.custom-player').forEach(pl=>{ const a=pl.previousSibling && pl.previousSibling.tagName==='AUDIO'? pl.previousSibling:null; if(a && a!==audio && !a.paused){ try{ a.pause(); }catch(_){} } }); }
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
	return { audio, player };
}

// Legacy global helper if needed
window.attachCustomPlayer = attachCustomPlayer;

// settings.js: seed auto/roll + top_k/top_p coupling extracted from inline template scripts

function initSamplingCoupling(){
  const topP = document.getElementById('top_p');
  const topKRange = document.getElementById('top_k');
  const topKNum = document.getElementById('top_k-text');
  function apply(){
    if(!topP||!topKRange||!topKNum) return;
    const tp = parseFloat(topP.value||'0');
    const dis = tp > 0;
    topKRange.disabled = dis; topKNum.disabled = dis; topKRange.dataset.coupled = dis? '1':'0';
  }
  if(topP){ topP.addEventListener('input', apply); apply(); }
}

function initSeedControls(){
  const autoCb = document.getElementById('auto-seed');
  const seedRange = document.getElementById('seed');
  const seedNum = document.getElementById('seed-text');
  const rollBtn = document.getElementById('roll-seed');
  function setDisabled(d){ if(seedRange) seedRange.disabled=d; if(seedNum) seedNum.disabled=d; }
  function enterAuto(){ if(seedRange) seedRange.value=-1; if(seedNum) seedNum.value=-1; setDisabled(true); }
  function leaveAuto(){ setDisabled(false); }
  if(autoCb){
    autoCb.addEventListener('change', ()=>{ autoCb.checked ? enterAuto():leaveAuto(); });
  }
  if(rollBtn){
    rollBtn.addEventListener('click', ()=>{
      if(autoCb && autoCb.checked){ enterAuto(); return; }
      const rnd = Math.floor(Math.random()*100000000);
      if(seedRange) seedRange.value=rnd; if(seedNum) seedNum.value=rnd;
    });
  }
  try {
    if(seedRange && parseInt(seedRange.value,10) >= 0){ if(autoCb) autoCb.checked=false; leaveAuto(); }
    else { if(autoCb) autoCb.checked=true; enterAuto(); }
  } catch(e){}
  // expose helper for other modules (main.js uses it)
  window.__autoSeedEnabled = ()=> !!(autoCb && autoCb.checked);
}

export function initSettingsModule(){
  initSamplingCoupling();
  initSeedControls();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initSettingsModule); else initSettingsModule();

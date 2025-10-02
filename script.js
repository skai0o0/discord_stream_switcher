const TEST_SNIPPET = `const tiles = [...document.querySelectorAll('div[data-selenium-video-tile] .focusTarget__54e4b[role="button"]')];
console.log('🎯 Found video tiles:', tiles.length);
const results = tiles.map((el, i)=>{
  const videoTile = el.closest('[data-selenium-video-tile]');
  const id = videoTile?.dataset?.seleniumVideoTile;
  const name = \`Stream \${i+1}\`;
  return { id, name };
});
console.log('📊 Streams:', results);
if(!results.length){console.warn('❌ No streams found – hãy bật Grid + multistream và tắt camera/preview');}`;

const MAIN_SCRIPT = `(function(){'use strict';
  const ORDER_BOOK = new Map();
  const PAIR_BOOK  = new Map();
  let CURRENT_STREAM_IDS = [];
  let CURRENT_STREAM_INDEX = 0;

  function classifyTile(tile){
    const videoCount = tile.querySelectorAll('video, canvas').length;
    const gridLike = tile.querySelector('[class*="grid" i],[class*="gallery" i]');
    return (videoCount >= 2 || gridLike) ? 'grid' : 'individual';
  }
  function getTileFromButton(btn){ return btn.closest('[data-selenium-video-tile]'); }
  function getTileId(tile){ return tile && tile.dataset && tile.dataset.seleniumVideoTile; }
  function getRectArea(r){ return Math.max(0, r.width) * Math.max(0, r.height); }
  function rectLike(o){ try{ const r=o.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,area:getRectArea(r)}; }catch(_){ return {x:0,y:0,width:0,height:0,area:0}; } }

  function scanTiles(){
    const btns = Array.from(document.querySelectorAll('div[data-selenium-video-tile] .focusTarget__54e4b[role="button"]'));
    return btns.map(function(btn, idx){
      const tile = getTileFromButton(btn);
      const id = getTileId(tile);
      if(!id) return null;
      const kind = classifyTile(tile);
      const name = (kind === 'grid') ? 'GRID' : ('Stream ' + (idx+1));
      const rect = rectLike(tile);
      return { id:id, name:name, kind:kind, rect:rect };
    }).filter(Boolean);
  }

  function dedupePreferIndividual(arr){
    const best = new Map();
    for(const it of arr){
      const prev = best.get(it.id);
      if(!prev){ best.set(it.id, it); continue; }
      if(prev.kind !== 'individual' && it.kind === 'individual') best.set(it.id, it);
    }
    return Array.from(best.values());
  }
  function stableOrder(entries){
    const used = new Set();
    const placed = [];
    entries.forEach(function(e){
      if(ORDER_BOOK.has(e.id)){
        const slot = ORDER_BOOK.get(e.id);
        placed.push({slot:slot, id:e.id, name:e.name, kind:e.kind});
        used.add(slot);
      }
    });
    const newcomers = entries.filter(function(e){return !ORDER_BOOK.has(e.id);}).sort(function(a,b){
      if((a.kind==='individual') === (b.kind==='individual')) return 0; return (a.kind==='individual')? -1 : 1;
    });
    function nextFreeSlot(){ var s=0; while(used.has(s)) s++; used.add(s); return s; }
    newcomers.forEach(function(e){ var slot = nextFreeSlot(); ORDER_BOOK.set(e.id, slot); placed.push({slot:slot, id:e.id, name:e.name, kind:e.kind}); });
    placed.sort(function(a,b){
      if(a.kind==='grid' && b.kind!=='grid') return 1;
      if(b.kind==='grid' && a.kind!=='grid') return -1;
      return a.slot - b.slot;
    });
    return placed.map(function(p){ return {id:p.id, name:p.name, kind:p.kind}; });
  }

  function learnPairsFromRects(items){
    const individuals = items.filter(function(it){ return it.kind==='individual'; });
    if(individuals.length !== 2) return;
    const a = individuals[0], b = individuals[1];
    const areaA = a.rect.area, areaB = b.rect.area;
    if(areaA<=0 || areaB<=0) return;
    const big = (areaA>=areaB)? a : b;
    const small = (big===a)? b : a;
    const ratio = (Math.max(areaA,areaB) / Math.max(1, Math.min(areaA,areaB)));
    if(ratio < 2) return;
    PAIR_BOOK.set(big.id, small.id);
    PAIR_BOOK.set(small.id, big.id);
  }

  function getCurrentStreamIds(){
    try{
      const raw = scanTiles();
      learnPairsFromRects(raw);
      const uniq = dedupePreferIndividual(raw);
      const ordered = stableOrder(uniq);
      return ordered;
    }catch(e){ console.error(e); return []; }
  }

  function refreshStreams(){
    CURRENT_STREAM_IDS = getCurrentStreamIds();
    if(CURRENT_STREAM_INDEX >= CURRENT_STREAM_IDS.length) CURRENT_STREAM_INDEX = Math.max(0, CURRENT_STREAM_IDS.length - 1);
    return CURRENT_STREAM_IDS;
  }

  function switchToStreamById(id){
    try{
      const sel = 'div[data-selenium-video-tile="' + CSS.escape(id) + '"] .focusTarget__54e4b[role="button"]';
      const target = document.querySelector(sel);
      if(target){ target.click(); CURRENT_STREAM_INDEX = Math.max(0, CURRENT_STREAM_IDS.findIndex(function(s){ return (s.id||s)===id; })); return true; }
      return false;
    }catch(e){ console.error(e); return false; }
  }
  function switchToStreamByIndex(i){ if(i<0||i>=CURRENT_STREAM_IDS.length) return false; const id=(CURRENT_STREAM_IDS[i].id||CURRENT_STREAM_IDS[i]); return switchToStreamById(id); }
  function switchToNextStream(){ if(!CURRENT_STREAM_IDS.length) refreshStreams(); if(!CURRENT_STREAM_IDS.length) return false; CURRENT_STREAM_INDEX=(CURRENT_STREAM_INDEX+1)%CURRENT_STREAM_IDS.length; return switchToStreamByIndex(CURRENT_STREAM_INDEX); }
  function switchToPreviousStream(){ if(!CURRENT_STREAM_IDS.length) refreshStreams(); if(!CURRENT_STREAM_IDS.length) return false; CURRENT_STREAM_INDEX=(CURRENT_STREAM_INDEX-1+CURRENT_STREAM_IDS.length)%CURRENT_STREAM_IDS.length; return switchToStreamByIndex(CURRENT_STREAM_INDEX); }

  function getPartnerId(id){ return PAIR_BOOK.get(id) || null; }
  function swapWithPartnerById(id){ var p=getPartnerId(id); return p ? switchToStreamById(p) : false; }
  function swapCurrentFocused(){ if(!CURRENT_STREAM_IDS.length) refreshStreams(); if(!CURRENT_STREAM_IDS.length) return false; const id=(CURRENT_STREAM_IDS[CURRENT_STREAM_INDEX].id||CURRENT_STREAM_IDS[CURRENT_STREAM_INDEX]); return swapWithPartnerById(id); }

  window.DiscordStreamDeck = {
    refreshStreams: refreshStreams,
    switchToStreamById: switchToStreamById,
    switchToStreamByIndex: switchToStreamByIndex,
    switchToNextStream: switchToNextStream,
    switchToPreviousStream: switchToPreviousStream,
    getCurrentStreamIds: getCurrentStreamIds,
    getStatus: function(){ return { streams: CURRENT_STREAM_IDS.length? CURRENT_STREAM_IDS: [], currentIndex: CURRENT_STREAM_INDEX, totalStreams: CURRENT_STREAM_IDS.length, pairs: Array.from(PAIR_BOOK.entries()) }; },
    getPartnerId: getPartnerId,
    swapWithPartnerById: swapWithPartnerById,
    swapCurrentFocused: swapCurrentFocused
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(refreshStreams, 2000); });
  } else { setTimeout(refreshStreams, 2000); }

  document.addEventListener('keydown', function(e){
    if(e.altKey && /^F[1-9]$/.test(e.key)){ e.preventDefault(); var n=parseInt(e.key.slice(1),10); if(n>=1&&n<=9) switchToStreamByIndex(n-1); }
    if(e.altKey && e.key==='ArrowRight'){ e.preventDefault(); switchToNextStream(); }
    if(e.altKey && e.key==='ArrowLeft'){ e.preventDefault(); switchToPreviousStream(); }
    if(e.altKey && (e.key==='s' || e.key==='S')){ e.preventDefault(); swapCurrentFocused(); }
  });
})();`;

(function(){
  const root = document.documentElement;
  const key = 'theme';
  const getSystem = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const load = () => localStorage.getItem(key) || getSystem();
  const apply = (t) => { root.setAttribute('data-theme', t); };
  let current = load();
  apply(current);
  document.getElementById('themeToggle').addEventListener('click',()=>{
    current = (root.getAttribute('data-theme')==='dark') ? 'light' : 'dark';
    apply(current); localStorage.setItem(key,current);
  });
})();

const serverUrl = 'http://localhost:3333';
const logEl = document.getElementById('log');
const gridEl = document.getElementById('grid');
const statStreams = document.getElementById('statStreams');
const statCurrent = document.getElementById('statCurrent');
const statServer = document.getElementById('statServer');
(function(){ const el = document.getElementById('serverUrlLbl'); if(el) el.textContent = serverUrl; })();

function log(msg){
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(line); logEl.scrollTop = logEl.scrollHeight;
}

async function api(path, method='GET', body){
  const res = await fetch(serverUrl + path, {method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined});
  const j = await res.json(); if(!res.ok) throw new Error(j.error||'API error'); return j;
}

async function testHealth(){
  try{ await api('/health'); statServer.textContent = 'OK'; log('Health OK'); }
  catch(e){ statServer.textContent = 'ERR'; log('Health ERR: '+e.message); }
}
async function testDiscord(){
  try{ await api('/api/discord/status'); log('Discord: connected'); refreshStreams(); }
  catch(e){ log('Discord: not ready'); }
}

function __renderStreamsTo(container, streams, currentIndex){
  container.innerHTML='';
  if(!streams || !streams.length){ container.innerHTML = '<div class="muted">Chưa phát hiện stream nào. Kiểm tra Grid view + multistream + tắt camera/preview.</div>'; return; }
  streams.forEach(function(s,i){
    const btn = document.createElement('button'); btn.className='tile'+(i===currentIndex?' active':'');
    const id = (typeof s==='string'? s : s && s.id);
    const name = (s && s.name) ? s.name : ('Stream ' + (i+1));
    const isGrid = (s && s.kind === 'grid');
    const gridBadge = isGrid ? '<div class="badge kind">GRID</div>' : '';
    btn.innerHTML = gridBadge + '<div class="badge">F'+(i+1)+'</div>'+
      '<div class="name">'+ name +'</div>'+
      '<div class="id">'+ ((id||'').slice(0,8))+'...'+((id||'').slice(-4)) +'</div>';
    btn.onclick = function(){ switchByIndex(i); };
    container.appendChild(btn);
  });
}

function renderStreams(streams, currentIndex){ __renderStreamsTo(gridEl, streams, currentIndex); }

async function refreshStreams(){
  try{ const r = await api('/api/streams/refresh','POST');
    statStreams.textContent = r && r.streams ? r.streams.length : 0;
    statCurrent.textContent = (r && r.streams && r.streams.length) ? (r.currentIndex+1)+'/'+r.streams.length : '-';
    renderStreams(r.streams, r.currentIndex); log('Refreshed streams');
  }catch(e){ log('Refresh ERR: '+e.message); }
}

async function switchByIndex(i){
  try{ const r = await api('/api/streams/switch-by-index/'+i,'POST'); log('Switch index '+(i+1)+': '+(r.success?'OK':'FAIL')); refreshStreams(); }
  catch(e){ log('Switch ERR: '+e.message); }
}
async function nextStream(){ try{ await api('/api/streams/next','POST'); log('Next'); refreshStreams(); }catch(e){ log('Next ERR: '+e.message);} }
async function prevStream(){ try{ await api('/api/streams/previous','POST'); log('Previous'); refreshStreams(); }catch(e){ log('Prev ERR: '+e.message);} }

function copy(text){ navigator.clipboard.writeText(text).then(()=>log('Copied to clipboard')).catch(function(e){log('Copy failed: '+e.message)}); }
function copyTestSnippet(){ copy(TEST_SNIPPET.trim()); }
function copyMainScript(){ copy(MAIN_SCRIPT.trim()); }

function appendTest(out, name, ok, note){
  const line = document.createElement('div');
  line.textContent = (ok ? '✅' : '❌')+' '+name+(note? ' — '+note:'');
  out.appendChild(line);
}
async function runSelfTests(){
  const out = document.getElementById('testOut'); out.innerHTML='';
  try{
    // T1: Assign serverUrlLbl OK
    var ok1=false; (function(){ var el=document.createElement('span'); el.id='serverUrlLbl_TEST'; document.body.appendChild(el); try{ var t='http://localhost:3333'; var ref=document.getElementById('serverUrlLbl_TEST'); if(ref) ref.textContent=t; ok1 = (ref.textContent===t); } finally { el.remove(); } })();
    appendTest(out, 'T1: Assign serverUrlLbl', ok1);

    // T2: Render grid + GRID badge
    var temp=document.createElement('div'); __renderStreamsTo(temp, [{id:'AAA111',name:'Stream 1'},{id:'GRID_ID',name:'GRID',kind:'grid'}], 0);
    var ok2 = temp.querySelectorAll('.tile').length===2 && temp.querySelector('.badge.kind')!==null;
    appendTest(out,'T2: GRID badge present', ok2);

    appendTest(out,'T3: Has DiscordStreamDeck', /DiscordStreamDeck/.test(MAIN_SCRIPT));

    appendTest(out,'T4: api() available', typeof api==='function');
    log('Self tests finished');
  }catch(e){ appendTest(out,'Runtime error',false,e.message); console.error(e); }
}
window.runSelfTests = runSelfTests;

testHealth().catch(function(){});
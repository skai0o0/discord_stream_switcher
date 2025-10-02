// === Theme toggle (persist to localStorage) ===
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
// không dùng optional chaining ở LHS khi gán
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
  catch(e){ log('Discord: not ready – hãy inject script'); }
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
function copyTestSnippet(){ copy(document.getElementById('tpl-test-snippet').textContent.trim()); }
function copyMainScript(){ copy(document.getElementById('tpl-main-script').textContent.trim()); }

// ===== Self Tests =====
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

    // T3: Template main chứa DiscordStreamDeck
    var txt = document.getElementById('tpl-main-script').textContent;
    appendTest(out,'T3: Has DiscordStreamDeck', /DiscordStreamDeck/.test(txt));

    appendTest(out,'T4: api() available', typeof api==='function');
    log('Self tests finished');
  }catch(e){ appendTest(out,'Runtime error',false,e.message); console.error(e); }
}
window.runSelfTests = runSelfTests;

// Auto: ping health khi load
testHealth().catch(function(){});
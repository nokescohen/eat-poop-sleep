// Eat-Poop-Sleep tracker (vanilla JS, localStorage)
// Updated: separate Pee & Poop buttons, Feed increments 1 oz per tap, Sleep start/stop toggle
const KEY = 'eps_events_v1';

const elements = {
  btnPee: document.getElementById('btn-pee'),
  btnPoop: document.getElementById('btn-poop'),
  btnFeed: document.getElementById('btn-feed'),
  history: document.getElementById('history'),
  stats: document.getElementById('stats'),
  sleepStatus: document.getElementById('sleep-status'),
  btnUndo: document.getElementById('btn-undo'),
  btnExport: document.getElementById('btn-export'),
  btnClear: document.getElementById('btn-clear'),
};

let events = load();
let sleeping = calcSleepingFromEvents();

function nowISO(){ return new Date().toISOString(); }
function fmtTime(iso){
  const d = new Date(iso);
  return d.toLocaleString([], {hour:'2-digit', minute:'2-digit', month:'short', day:'numeric'});
}

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}

// Determine sleeping state from most recent sleep event: if most recent sleep event is sleep_start -> sleeping = true
function calcSleepingFromEvents(){
  for(const ev of events){
    if(ev.type === 'sleep_start') return true;
    if(ev.type === 'sleep_end') return false;
  }
  return false;
}

function save(){
  localStorage.setItem(KEY, JSON.stringify(events));
  render();
}

function addEvent(type, data = {}){
  const ev = { id: Date.now().toString() + Math.random().toString(36).slice(2,6), type, ts: nowISO(), data };
  events.unshift(ev); // newest first
  save();
}

function undoLast(){
  if(events.length===0) return;
  events.shift();
  save();
}

function clearAll(){
  if(!confirm('Clear all events?')) return;
  events = [];
  save();
}

function exportCSV(){
  if(events.length===0){ alert('No events to export'); return; }
  const rows = [['type','timestamp','data']];
  for(const ev of events){
    rows.push([ev.type, ev.ts, JSON.stringify(ev.data)]);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'eps_events.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function toggleSleep(){
  if(!sleeping){
    addEvent('sleep_start', {});
    sleeping = true;
  }else{
    addEvent('sleep_end', {});
    sleeping = false;
  }
  render();
}

function render(){
  // sleep status
  elements.sleepStatus.textContent = sleeping ? 'Sleeping' : 'Awake';

  // stats: counts in last 24h
  const since = new Date(Date.now() - 24*60*60*1000);
  const counts = { pee:0, poop:0, feedOunces:0, sleepSessions:0 };
  for(const ev of events){
    const t = new Date(ev.ts);
    if(t < since) continue;
    if(ev.type === 'pee') counts.pee++;
    if(ev.type === 'poop') counts.poop++;
    if(ev.type === 'feed') counts.feedOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    if(ev.type === 'sleep_end') counts.sleepSessions++; // count ended sessions
  }
  const statText = `24h — Pee: ${counts.pee}, Poop: ${counts.poop}, Feeds (oz): ${counts.feedOunces}, Sleep sessions: ${counts.sleepSessions}`;
  elements.stats.textContent = statText;

  // history
  elements.history.innerHTML = '';
  for(const ev of events){
    const li = document.createElement('li');
    const left = document.createElement('div');
    const right = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'event-label';
    label.textContent = prettyLabel(ev);
    const meta = document.createElement('div');
    meta.className = 'event-meta';
    meta.textContent = fmtTime(ev.ts);
    left.appendChild(label);
    left.appendChild(meta);

    const del = document.createElement('button');
    del.textContent = '⋯';
    del.title = 'Delete';
    del.onclick = () => { if(confirm('Delete this event?')){ events = events.filter(x=>x.id!==ev.id); save(); } };

    li.appendChild(left);
    li.appendChild(del);
    elements.history.appendChild(li);
  }
}

function prettyLabel(ev){
  if(ev.type === 'pee') return 'Pee';
  if(ev.type === 'poop') return 'Poop';
  if(ev.type === 'feed'){
    const amt = ev.data && ev.data.amount ? ` • ${ev.data.amount} oz` : '';
    return `Feed${amt}`;
  }
  if(ev.type==='sleep_start') return 'Sleep — start';
  if(ev.type==='sleep_end') return 'Sleep — end';
  return ev.type;
}

// Button handlers
elements.btnPee.addEventListener('click', () => {
  addEvent('pee', {});
});

elements.btnPoop.addEventListener('click', () => {
  addEvent('poop', {});
});

elements.btnFeed.addEventListener('click', () => {
  // Each press = 1 ounce
  addEvent('feed', { amount: 1 });
});

elements.btnUndo.addEventListener('click', () => {
  if(confirm('Undo last event?')) undoLast();
});

elements.btnExport.addEventListener('click', exportCSV);
elements.btnClear.addEventListener('click', clearAll);

// initial render (ensure sleeping reflects events)
render();
import { Hono } from "hono";
import Database from "bun:sqlite";
import { mkdir } from "fs/promises";

await mkdir("./data", { recursive: true });
const db = new Database(process.env.DATABASE_URL || "./data/calories.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function getSetting(key: string, def: string): string {
  const r = db.query("SELECT value FROM settings WHERE key = ?").get(key) as any;
  return r ? r.value : def;
}

// ── Shared CSS ───────────────────────────────────────────────────────────────

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #f1f5f9;
  --surface: #ffffff;
  --border: #e2e8f0;
  --text: #0f172a;
  --muted: #64748b;
  --accent: #6366f1;
  --accent-light: #eef2ff;
  --accent-dark: #4f46e5;
  --danger: #ef4444;
  --danger-light: #fef2f2;
  --orange: #f97316;
  --radius: 16px;
  --shadow: 0 1px 3px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.06);
  --nav-h: 72px;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg); color: var(--text);
  line-height: 1.5; -webkit-font-smoothing: antialiased;
}
.app { max-width: 480px; margin: 0 auto; min-height: 100vh; padding-bottom: calc(var(--nav-h) + 16px); }
.page { padding: 20px 16px 0; }
.page-header { margin-bottom: 20px; }
.page-header h1 { font-size: 1.75rem; font-weight: 700; letter-spacing: -.5px; }
.page-header .sub { font-size: .85rem; color: var(--muted); margin-top: 2px; }

/* Cards */
.card { background: var(--surface); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); border: 1px solid var(--border); margin-bottom: 14px; }

/* Summary card */
.summary-card {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
  border-radius: var(--radius); padding: 24px; color: white;
  margin-bottom: 14px; box-shadow: 0 4px 24px rgba(99,102,241,.3);
  border: none; overflow: hidden; position: relative;
}
.summary-card::before { content:''; position:absolute; top:-40px; right:-40px; width:160px; height:160px; border-radius:50%; background:rgba(255,255,255,.08); }
.s-label { font-size:.72rem; font-weight:600; text-transform:uppercase; letter-spacing:.8px; opacity:.75; margin-bottom:6px; }
.s-num { font-size:2.75rem; font-weight:800; letter-spacing:-1.5px; line-height:1; }
.s-unit { font-size:1rem; font-weight:500; opacity:.7; }
.s-sub { font-size:.8rem; opacity:.75; margin-top:5px; }
.pb-wrap { margin-top:16px; background:rgba(255,255,255,.2); border-radius:999px; height:6px; overflow:hidden; }
.pb-fill { height:100%; background:white; border-radius:999px; transition:width .5s cubic-bezier(0.4,0,0.2,1); max-width:100%; }

/* Section title */
.sec-title { font-size:.72rem; font-weight:600; text-transform:uppercase; letter-spacing:.8px; color:var(--muted); margin-bottom:10px; }

/* Form */
.form-row { margin-bottom:10px; }
.form-split { display:flex; gap:10px; }
.form-split .cal-input { flex:0 0 120px; }
input[type=text], input[type=number] {
  width:100%; padding:12px 14px; border:1.5px solid var(--border); border-radius:10px;
  font-family:inherit; font-size:.9rem; color:var(--text); background:var(--bg);
  outline:none; transition:border-color .15s, background .15s;
}
input:focus { border-color:var(--accent); background:white; }
input::placeholder { color:#94a3b8; }
button.primary {
  width:100%; padding:13px; background:var(--accent); color:white;
  border:none; border-radius:10px; font-family:inherit; font-size:.9rem; font-weight:700;
  cursor:pointer; margin-top:4px; transition:opacity .15s, transform .1s;
}
button.primary:hover { opacity:.9; }
button.primary:active { transform:scale(.98); }
button.primary:disabled { opacity:.45; cursor:default; }

/* Entry list */
.entry-list { display:flex; flex-direction:column; gap:8px; }
.entry {
  background:var(--surface); border:1px solid var(--border); border-radius:12px;
  padding:14px 16px; display:flex; align-items:center; gap:12px;
  box-shadow:0 1px 3px rgba(0,0,0,.04); animation:fadeIn .2s ease;
}
@keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
.entry-icon { width:38px; height:38px; background:var(--accent-light); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0; }
.entry-info { flex:1; min-width:0; }
.entry-name { font-size:.9rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.entry-time { font-size:.72rem; color:var(--muted); margin-top:1px; }
.entry-cal { font-size:.95rem; font-weight:700; color:var(--accent); flex-shrink:0; }
.del-btn { background:none; border:none; cursor:pointer; color:#cbd5e1; font-size:.85rem; padding:6px; border-radius:8px; line-height:1; transition:color .15s, background .15s; flex-shrink:0; }
.del-btn:hover { color:var(--danger); background:var(--danger-light); }
.empty-state { text-align:center; padding:48px 20px; background:var(--surface); border-radius:var(--radius); border:1px solid var(--border); color:var(--muted); }
.empty-state .ei { font-size:2.5rem; margin-bottom:10px; }
.empty-state p { font-size:.9rem; }

/* Date nav bar */
.date-nav-bar { display:flex; align-items:center; justify-content:space-between; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:12px 16px; margin-bottom:14px; box-shadow:0 1px 4px rgba(0,0,0,.04); }
.date-nav-bar span { font-size:.9rem; font-weight:600; }
.nav-arrow { background:var(--bg); border:1px solid var(--border); color:var(--text); width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:.9rem; transition:background .15s; }
.nav-arrow:hover { background:var(--border); }
.nav-arrow:disabled { opacity:.35; cursor:default; }

/* Stats */
.stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
.stat-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:18px 16px; box-shadow:var(--shadow); }
.stat-val { font-size:1.4rem; font-weight:800; letter-spacing:-.5px; }
.stat-label { font-size:.7rem; color:var(--muted); margin-top:3px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; }

/* Chart */
.chart-wrap { position:relative; }
.chart-container { position:relative; height:180px; border-bottom:2px solid var(--border); margin-bottom:6px; }
.chart-bars { display:flex; align-items:flex-end; height:100%; gap:6px; }
.chart-bar-col { flex:1; display:flex; align-items:flex-end; height:100%; }
.chart-bar { width:100%; background:var(--accent); border-radius:5px 5px 0 0; min-height:3px; transition:height .5s cubic-bezier(0.4,0,0.2,1); }
.chart-bar.over { background:var(--orange); }
.chart-bar.zero { background:var(--border); }
.chart-bar.today-bar { box-shadow:0 0 0 2.5px white, 0 0 0 4px var(--accent); }
.chart-bar.today-bar.over { box-shadow:0 0 0 2.5px white, 0 0 0 4px var(--orange); }
.chart-goal-line { position:absolute; left:0; right:0; height:0; border-top:2px dashed rgba(239,68,68,.45); pointer-events:none; z-index:2; transition:bottom .5s cubic-bezier(0.4,0,0.2,1); }
.chart-label-row { display:flex; gap:6px; }
.chart-lbl { flex:1; text-align:center; font-size:.68rem; color:var(--muted); font-weight:500; }
.chart-lbl.today-lbl { color:var(--accent); font-weight:700; }
.legend { display:flex; gap:14px; margin-top:10px; }
.legend span { display:flex; align-items:center; gap:5px; font-size:.72rem; color:var(--muted); }
.legend .dot { width:10px; height:10px; border-radius:2px; display:inline-block; }
.legend .dash-line { width:20px; border-top:2px dashed rgba(239,68,68,.5); display:inline-block; }

/* Settings */
.setting-label { display:block; font-size:.78rem; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); margin-bottom:7px; }
.setting-note { font-size:.8rem; color:var(--muted); margin-top:8px; line-height:1.5; }

/* Bottom nav */
.bottom-nav {
  position:fixed; bottom:0; left:0; right:0; max-width:480px; margin:0 auto;
  background:rgba(255,255,255,.92); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
  border-top:1px solid var(--border); display:flex; height:var(--nav-h); z-index:100;
}
.nav-item { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; text-decoration:none; color:var(--muted); transition:color .15s; }
.nav-item.active { color:var(--accent); }
.nav-item:hover { color:var(--text); }
.nav-icon { font-size:1.3rem; line-height:1; }
.nav-label { font-size:.62rem; font-weight:600; letter-spacing:.2px; text-transform:uppercase; }

/* Toast */
.toast { position:fixed; bottom:calc(var(--nav-h) + 16px); left:50%; transform:translateX(-50%) translateY(20px); background:var(--text); color:white; padding:10px 20px; border-radius:999px; font-size:.83rem; font-weight:500; opacity:0; transition:opacity .2s, transform .2s; pointer-events:none; z-index:200; white-space:nowrap; }
.toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
`;

// ── Shared layout ────────────────────────────────────────────────────────────

function nav(active: string): string {
  const items = [
    { href: "/", icon: "🏠", label: "Today", id: "home" },
    { href: "/history", icon: "📅", label: "History", id: "history" },
    { href: "/stats", icon: "📊", label: "Stats", id: "stats" },
    { href: "/settings", icon: "⚙️", label: "Settings", id: "settings" },
  ];
  return (
    '<nav class="bottom-nav">' +
    items
      .map(
        (it) =>
          '<a href="' +
          it.href +
          '" class="nav-item' +
          (active === it.id ? " active" : "") +
          '"><span class="nav-icon">' +
          it.icon +
          '</span><span class="nav-label">' +
          it.label +
          "</span></a>"
      )
      .join("") +
    "</nav>"
  );
}

function layout(title: string, active: string, content: string, script: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · Calorie Tracker</title>
<style>${CSS}</style>
</head>
<body>
<div class="app">
${content}
${nav(active)}
</div>
<div class="toast" id="toast"></div>
<script>
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
var _tt;
function showToast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(_tt);_tt=setTimeout(function(){t.classList.remove('show');},2000);}
${script}
</script>
</body>
</html>`;
}

// ── Pages ────────────────────────────────────────────────────────────────────

function dashboardPage(goal: number): string {
  const content = `
<div class="page">
  <div class="page-header">
    <h1>Today</h1>
    <div class="sub" id="dateLabel"></div>
  </div>

  <div class="summary-card">
    <div class="s-label">Calories Consumed</div>
    <div><span class="s-num" id="totalCal">0</span><span class="s-unit"> kcal</span></div>
    <div class="s-sub" id="remaining"></div>
    <div class="pb-wrap"><div class="pb-fill" id="pbFill" style="width:0%"></div></div>
  </div>

  <div class="card">
    <div class="sec-title">Add Food</div>
    <div class="form-row">
      <input type="text" id="foodName" placeholder="What did you eat?" maxlength="80" autocomplete="off">
    </div>
    <div class="form-split form-row">
      <input type="number" class="cal-input" id="foodCal" placeholder="Calories" min="1" max="9999">
    </div>
    <button class="primary" id="addBtn" onclick="addEntry()">+ Add Entry</button>
  </div>

  <div class="sec-title" style="padding:0 4px" id="logTitle">Today's Log</div>
  <div class="entry-list" id="entryList" style="margin-top:10px"></div>
</div>`;

  const script = `
var GOAL = ${goal};
function todayStr(){var d=new Date();return d.toISOString().slice(0,10);}
function fmtFull(s){var d=new Date(s+'T00:00:00');return d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});}
async function load(){
  var r=await fetch('/api/entries?date='+todayStr());
  var data=await r.json();
  renderSummary(data.total);
  renderList(data.entries);
}
function renderSummary(total){
  document.getElementById('totalCal').textContent=total.toLocaleString();
  var rem=GOAL-total;
  var el=document.getElementById('remaining');
  if(rem>0) el.textContent=rem.toLocaleString()+' kcal remaining';
  else if(rem===0) el.textContent='Goal reached!';
  else el.textContent=Math.abs(rem).toLocaleString()+' kcal over goal';
  document.getElementById('pbFill').style.width=Math.min(total/GOAL*100,100)+'%';
}
function renderList(entries){
  var el=document.getElementById('entryList');
  document.getElementById('logTitle').textContent="Today's Log ("+entries.length+" item"+(entries.length===1?'':'s')+")";
  if(!entries.length){el.innerHTML='<div class="empty-state"><div class="ei">🍽️</div><p>No entries yet — add your first meal above!</p></div>';return;}
  el.innerHTML=entries.map(function(e){
    var t=e.created_at?e.created_at.slice(11,16):'';
    return '<div class="entry" id="e'+e.id+'">'
      +'<div class="entry-icon">🍴</div>'
      +'<div class="entry-info"><div class="entry-name">'+esc(e.name)+'</div>'
      +(t?'<div class="entry-time">'+t+'</div>':'')+'</div>'
      +'<div class="entry-cal">'+Number(e.calories).toLocaleString()+' kcal</div>'
      +'<button class="del-btn" onclick="del('+e.id+')" title="Remove">✕</button>'
      +'</div>';
  }).join('');
}
async function addEntry(){
  var n=document.getElementById('foodName').value.trim();
  var c=document.getElementById('foodCal').value;
  if(!n){showToast('Enter a food name');return;}
  if(!c||Number(c)<=0){showToast('Enter valid calories');return;}
  var btn=document.getElementById('addBtn');btn.disabled=true;
  await fetch('/api/entries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,calories:Number(c)})});
  document.getElementById('foodName').value='';
  document.getElementById('foodCal').value='';
  btn.disabled=false;
  await load();
  showToast('Added!');
}
async function del(id){
  var el=document.getElementById('e'+id);
  if(el){el.style.opacity='.3';el.style.pointerEvents='none';}
  await fetch('/api/entries/'+id,{method:'DELETE'});
  await load();
}
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'){var a=document.activeElement;if(a&&(a.id==='foodName'||a.id==='foodCal'))addEntry();}
});
document.getElementById('dateLabel').textContent=fmtFull(todayStr());
load();`;

  return layout("Today", "home", content, script);
}

function historyPage(): string {
  const content = `
<div class="page">
  <div class="page-header">
    <h1>History</h1>
    <div class="sub">Browse past days</div>
  </div>

  <div class="date-nav-bar">
    <button class="nav-arrow" onclick="changeDay(-1)">&#8249;</button>
    <span id="dateLabel">Loading...</span>
    <button class="nav-arrow" id="nextBtn" onclick="changeDay(1)" disabled>&#8250;</button>
  </div>

  <div class="card" style="display:flex;align-items:center;justify-content:space-between">
    <div>
      <div class="sec-title" style="margin-bottom:4px">Daily Total</div>
      <div style="font-size:1.6rem;font-weight:800;letter-spacing:-.5px" id="dayTotal">— kcal</div>
    </div>
    <div id="dayBadge" style="font-size:.8rem;font-weight:600;padding:7px 14px;border-radius:999px;background:var(--accent-light);color:var(--accent)">0 items</div>
  </div>

  <div class="sec-title" style="padding:0 4px;margin-bottom:10px">Entries</div>
  <div class="entry-list" id="entryList"></div>
</div>`;

  const script = `
var curDate=(function(){return new Date().toISOString().slice(0,10);})();
function todayStr(){return new Date().toISOString().slice(0,10);}
function fmtDate(s){
  var today=todayStr();
  var yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  var ys=yesterday.toISOString().slice(0,10);
  if(s===today)return'Today';
  if(s===ys)return'Yesterday';
  var d=new Date(s+'T00:00:00');
  return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
}
function changeDay(dir){
  var d=new Date(curDate+'T00:00:00');
  d.setDate(d.getDate()+dir);
  var next=d.toISOString().slice(0,10);
  if(next>todayStr())return;
  curDate=next;
  document.getElementById('nextBtn').disabled=(curDate===todayStr());
  load();
}
async function load(){
  document.getElementById('dateLabel').textContent=fmtDate(curDate);
  var r=await fetch('/api/entries?date='+curDate);
  var data=await r.json();
  var entries=data.entries;
  document.getElementById('dayTotal').textContent=data.total.toLocaleString()+' kcal';
  document.getElementById('dayBadge').textContent=entries.length+' item'+(entries.length===1?'':'s');
  var el=document.getElementById('entryList');
  if(!entries.length){
    el.innerHTML='<div class="empty-state"><div class="ei">📭</div><p>No entries for this day.</p></div>';
    return;
  }
  el.innerHTML=entries.map(function(e){
    var t=e.created_at?e.created_at.slice(11,16):'';
    return '<div class="entry">'
      +'<div class="entry-icon">🍴</div>'
      +'<div class="entry-info"><div class="entry-name">'+esc(e.name)+'</div>'
      +(t?'<div class="entry-time">'+t+'</div>':'')+'</div>'
      +'<div class="entry-cal">'+Number(e.calories).toLocaleString()+' kcal</div>'
      +'</div>';
  }).join('');
}
load();`;

  return layout("History", "history", content, script);
}

function statsPage(): string {
  const content = `
<div class="page">
  <div class="page-header">
    <h1>Stats</h1>
    <div class="sub">Last 7 days</div>
  </div>

  <div class="card">
    <div class="sec-title">Daily Calories</div>
    <div class="chart-wrap">
      <div class="chart-container">
        <div class="chart-bars" id="chartBars"></div>
        <div class="chart-goal-line" id="goalLine" style="bottom:0"></div>
      </div>
      <div class="chart-label-row" id="chartLabels"></div>
    </div>
    <div class="legend">
      <span><span class="dot" style="background:var(--accent)"></span>Under goal</span>
      <span><span class="dot" style="background:var(--orange)"></span>Over goal</span>
      <span><span class="dash-line"></span>Goal</span>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card"><div class="stat-val" id="avgCal">—</div><div class="stat-label">Daily Average</div></div>
    <div class="stat-card"><div class="stat-val" id="weekTotal">—</div><div class="stat-label">Week Total</div></div>
    <div class="stat-card"><div class="stat-val" id="bestDay">—</div><div class="stat-label">Highest Day</div></div>
    <div class="stat-card"><div class="stat-val" id="daysLogged">—</div><div class="stat-label">Days Logged</div></div>
  </div>
</div>`;

  const script = `
async function load(){
  var rows=await fetch('/api/stats').then(function(r){return r.json();});
  var goal=(await fetch('/api/settings').then(function(r){return r.json();})).goal||2000;
  var today=new Date().toISOString().slice(0,10);
  var days=[];
  for(var i=6;i>=0;i--){
    var d=new Date();d.setDate(d.getDate()-i);
    var ds=d.toISOString().slice(0,10);
    var found=rows.find(function(row){return row.date===ds;});
    days.push({date:ds,total:found?found.total:0,label:d.toLocaleDateString('en-US',{weekday:'short'})});
  }
  var maxVal=Math.max.apply(null,days.map(function(d){return d.total;}));
  maxVal=Math.max(maxVal,goal*1.1,1);

  document.getElementById('chartBars').innerHTML=days.map(function(day){
    var h=(day.total/maxVal*100).toFixed(2);
    var isToday=day.date===today;
    var cls='chart-bar'
      +(day.total===0?' zero':'')
      +(day.total>goal&&day.total>0?' over':'')
      +(isToday?' today-bar':'');
    return '<div class="chart-bar-col"><div class="'+cls+'" style="height:'+h+'%" title="'+day.total.toLocaleString()+' kcal"></div></div>';
  }).join('');

  document.getElementById('chartLabels').innerHTML=days.map(function(day){
    return '<div class="chart-lbl'+(day.date===today?' today-lbl':'')+'" >'+day.label+'</div>';
  }).join('');

  document.getElementById('goalLine').style.bottom=(goal/maxVal*100).toFixed(2)+'%';

  var withData=days.filter(function(d){return d.total>0;});
  var wkTotal=days.reduce(function(s,d){return s+d.total;},0);
  var avg=withData.length?Math.round(wkTotal/withData.length):0;
  var best=Math.max.apply(null,days.map(function(d){return d.total;}));

  document.getElementById('avgCal').textContent=avg>0?avg.toLocaleString():'—';
  document.getElementById('weekTotal').textContent=wkTotal>0?wkTotal.toLocaleString():'—';
  document.getElementById('bestDay').textContent=best>0?best.toLocaleString():'—';
  document.getElementById('daysLogged').textContent=withData.length+'/7';
}
load();`;

  return layout("Stats", "stats", content, script);
}

function settingsPage(goal: number): string {
  const content = `
<div class="page">
  <div class="page-header">
    <h1>Settings</h1>
    <div class="sub">Customize your tracker</div>
  </div>

  <div class="card">
    <div class="sec-title">Daily Calorie Goal</div>
    <label class="setting-label" for="goalInput">Target calories per day</label>
    <input type="number" id="goalInput" value="${goal}" min="500" max="20000" step="50">
    <p class="setting-note">The average adult needs 1,600–3,000 kcal/day depending on activity level.</p>
    <button class="primary" style="margin-top:14px" onclick="saveGoal()">Save Goal</button>
  </div>

  <div class="card">
    <div class="sec-title">About</div>
    <p style="font-size:.85rem;color:var(--muted);line-height:1.7">Simple calorie tracking — log meals, track daily progress, and browse history. Your data is stored locally and privately.</p>
  </div>
</div>`;

  const script = `
async function saveGoal(){
  var v=parseInt(document.getElementById('goalInput').value);
  if(!v||v<500){showToast('Minimum goal is 500 kcal');return;}
  await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'goal',value:v})});
  showToast('Goal saved!');
}
document.getElementById('goalInput').addEventListener('keydown',function(e){if(e.key==='Enter')saveGoal();});`;

  return layout("Settings", "settings", content, script);
}

// ── Routes ───────────────────────────────────────────────────────────────────

const app = new Hono();

app.get("/", (c) => {
  const goal = parseInt(getSetting("goal", "2000"));
  return c.html(dashboardPage(goal));
});
app.get("/history", (c) => c.html(historyPage()));
app.get("/stats", (c) => c.html(statsPage()));
app.get("/settings", (c) => {
  const goal = parseInt(getSetting("goal", "2000"));
  return c.html(settingsPage(goal));
});

app.get("/api/entries", (c) => {
  const date = c.req.query("date") || new Date().toISOString().slice(0, 10);
  const entries = db.query("SELECT * FROM entries WHERE date = ? ORDER BY created_at DESC").all(date);
  const total = (entries as any[]).reduce((s, e) => s + (e as any).calories, 0);
  return c.json({ entries, total, date });
});

app.post("/api/entries", async (c) => {
  const { name, calories } = await c.req.json();
  if (!name || !calories || isNaN(Number(calories)) || Number(calories) <= 0)
    return c.json({ error: "Invalid" }, 400);
  const r = db.prepare("INSERT INTO entries (name, calories) VALUES (?, ?)").run(
    name.trim(),
    Math.round(Number(calories))
  );
  const entry = db.query("SELECT * FROM entries WHERE id = ?").get(r.lastInsertRowid);
  return c.json(entry, 201);
});

app.delete("/api/entries/:id", (c) => {
  db.query("DELETE FROM entries WHERE id = ?").run(c.req.param("id"));
  return c.json({ ok: true });
});

app.get("/api/stats", (c) => {
  const rows = db
    .query(`
      SELECT date, SUM(calories) as total, COUNT(*) as count
      FROM entries
      WHERE date >= date('now', '-6 days', 'localtime')
      GROUP BY date ORDER BY date ASC
    `)
    .all();
  return c.json(rows);
});

app.get("/api/settings", (c) => {
  return c.json({ goal: parseInt(getSetting("goal", "2000")) });
});

app.post("/api/settings", async (c) => {
  const { key, value } = await c.req.json();
  db.query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, String(value));
  return c.json({ ok: true });
});

export default { port: process.env.PORT || 3000, fetch: app.fetch };

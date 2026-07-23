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
  )
`);

const app = new Hono();

app.get("/", (c) => c.html(html));

app.get("/api/entries", (c) => {
  const date = c.req.query("date") || new Date().toISOString().slice(0, 10);
  const entries = db.query("SELECT * FROM entries WHERE date = ? ORDER BY created_at DESC").all(date);
  const total = (entries as any[]).reduce((sum, e) => sum + e.calories, 0);
  return c.json({ entries, total, date });
});

app.post("/api/entries", async (c) => {
  const { name, calories } = await c.req.json();
  if (!name || !calories || isNaN(Number(calories)) || Number(calories) <= 0) {
    return c.json({ error: "Invalid input" }, 400);
  }
  const stmt = db.prepare("INSERT INTO entries (name, calories) VALUES (?, ?)");
  const result = stmt.run(name.trim(), Math.round(Number(calories)));
  const entry = db.query("SELECT * FROM entries WHERE id = ?").get(result.lastInsertRowid);
  return c.json(entry, 201);
});

app.delete("/api/entries/:id", (c) => {
  const id = c.req.param("id");
  db.query("DELETE FROM entries WHERE id = ?").run(id);
  return c.json({ ok: true });
});

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Calorie Tracker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f8f9fa;
    --surface: #ffffff;
    --border: #e9ecef;
    --text: #1a1a2e;
    --muted: #6c757d;
    --accent: #4361ee;
    --accent-light: #eef1ff;
    --danger: #e63946;
    --danger-light: #fff0f1;
    --green: #2dc653;
    --green-light: #edfbf1;
    --radius: 12px;
    --shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
  }

  body {
    font-family: 'Inter', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 24px 16px 80px;
  }

  .container { max-width: 480px; margin: 0 auto; }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
  }

  header h1 { font-size: 1.4rem; font-weight: 700; letter-spacing: -.3px; }
  header h1 span { color: var(--accent); }

  .date-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 4px 8px;
    font-size: .8rem;
    font-weight: 500;
    color: var(--muted);
  }

  .date-nav button {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--muted);
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 1rem;
    line-height: 1;
    transition: color .15s, background .15s;
  }

  .date-nav button:hover { color: var(--text); background: var(--bg); }

  .summary-card {
    background: var(--accent);
    border-radius: var(--radius);
    padding: 24px;
    color: white;
    margin-bottom: 20px;
    position: relative;
    overflow: hidden;
  }

  .summary-card::after {
    content: '';
    position: absolute;
    right: -30px; top: -30px;
    width: 120px; height: 120px;
    border-radius: 50%;
    background: rgba(255,255,255,.08);
  }

  .summary-card .label {
    font-size: .78rem;
    font-weight: 500;
    opacity: .75;
    text-transform: uppercase;
    letter-spacing: .5px;
    margin-bottom: 6px;
  }

  .summary-card .total {
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -1px;
  }

  .summary-card .unit { font-size: 1.1rem; font-weight: 500; opacity: .8; }

  .summary-card .goal-bar-wrap {
    margin-top: 16px;
    background: rgba(255,255,255,.2);
    border-radius: 999px;
    height: 6px;
    overflow: hidden;
  }

  .summary-card .goal-bar {
    height: 100%;
    border-radius: 999px;
    background: white;
    transition: width .4s ease;
  }

  .summary-card .goal-text {
    margin-top: 8px;
    font-size: .75rem;
    opacity: .75;
  }

  .add-form {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: var(--shadow);
  }

  .add-form h2 {
    font-size: .85rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .5px;
    margin-bottom: 14px;
  }

  .form-row { display: flex; gap: 10px; }

  .field { flex: 1; }
  .field.calories { flex: 0 0 100px; }

  input {
    width: 100%;
    padding: 10px 12px;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    font-family: inherit;
    font-size: .9rem;
    color: var(--text);
    background: var(--bg);
    transition: border-color .15s;
    outline: none;
  }

  input:focus { border-color: var(--accent); background: white; }
  input::placeholder { color: #adb5bd; }

  button.add-btn {
    margin-top: 12px;
    width: 100%;
    padding: 11px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: .9rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity .15s, transform .1s;
  }

  button.add-btn:hover { opacity: .9; }
  button.add-btn:active { transform: scale(.98); }
  button.add-btn:disabled { opacity: .5; cursor: default; }

  .entries-section h2 {
    font-size: .85rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .5px;
    margin-bottom: 12px;
  }

  .entry-list { display: flex; flex-direction: column; gap: 8px; }

  .entry {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: var(--shadow);
    animation: slideIn .2s ease;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .entry-icon {
    width: 36px; height: 36px;
    border-radius: 8px;
    background: var(--accent-light);
    color: var(--accent);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .entry-info { flex: 1; min-width: 0; }

  .entry-name {
    font-size: .9rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entry-time {
    font-size: .72rem;
    color: var(--muted);
    margin-top: 1px;
  }

  .entry-cal {
    font-size: .95rem;
    font-weight: 700;
    color: var(--accent);
    flex-shrink: 0;
  }

  .entry-del {
    background: none;
    border: none;
    cursor: pointer;
    color: #ced4da;
    font-size: 1rem;
    padding: 4px;
    border-radius: 6px;
    line-height: 1;
    transition: color .15s, background .15s;
  }

  .entry-del:hover { color: var(--danger); background: var(--danger-light); }

  .empty {
    text-align: center;
    padding: 40px 20px;
    color: var(--muted);
    font-size: .9rem;
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: var(--radius);
  }

  .empty .icon { font-size: 2rem; margin-bottom: 8px; }

  .toast {
    position: fixed;
    bottom: 24px; left: 50%;
    transform: translateX(-50%) translateY(80px);
    background: var(--text);
    color: white;
    padding: 10px 18px;
    border-radius: 999px;
    font-size: .85rem;
    font-weight: 500;
    transition: transform .25s ease;
    z-index: 99;
    pointer-events: none;
  }

  .toast.show { transform: translateX(-50%) translateY(0); }

  @media (max-width: 400px) {
    .form-row { flex-direction: column; }
    .field.calories { flex: 1; }
  }
</style>
</head>
<body>
<div class="container">

  <header>
    <h1>Calorie <span>Tracker</span></h1>
    <div class="date-nav">
      <button onclick="changeDay(-1)" title="Previous day">&#8249;</button>
      <span id="dateLabel">Today</span>
      <button onclick="changeDay(1)" id="nextBtn" title="Next day">&#8250;</button>
    </div>
  </header>

  <div class="summary-card">
    <div class="label">Total today</div>
    <div>
      <span class="total" id="totalCal">0</span>
      <span class="unit"> kcal</span>
    </div>
    <div class="goal-bar-wrap">
      <div class="goal-bar" id="goalBar" style="width:0%"></div>
    </div>
    <div class="goal-text" id="goalText">0 / 2,000 kcal goal</div>
  </div>

  <div class="add-form">
    <h2>Add food</h2>
    <div class="form-row">
      <div class="field">
        <input type="text" id="foodName" placeholder="Food name" maxlength="80" autocomplete="off">
      </div>
      <div class="field calories">
        <input type="number" id="foodCal" placeholder="kcal" min="1" max="9999">
      </div>
    </div>
    <button class="add-btn" onclick="addEntry()">+ Add Entry</button>
  </div>

  <div class="entries-section">
    <h2>Today's log</h2>
    <div class="entry-list" id="entryList"></div>
  </div>

</div>

<div class="toast" id="toast"></div>

<script>
  const GOAL = 2000;
  let currentDate = todayStr();

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDate(str) {
    const today = todayStr();
    const d = new Date(str + 'T00:00:00');
    if (str === today) return 'Today';
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (str === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function changeDay(dir) {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + dir);
    const next = d.toISOString().slice(0, 10);
    if (next > todayStr()) return;
    currentDate = next;
    document.getElementById('dateLabel').textContent = formatDate(currentDate);
    document.getElementById('nextBtn').disabled = currentDate === todayStr();
    document.querySelector('.entries-section h2').textContent = formatDate(currentDate) + "'s log";
    load();
  }

  async function load() {
    const res = await fetch('/api/entries?date=' + currentDate);
    const { entries, total } = await res.json();
    renderTotal(total);
    renderEntries(entries);
  }

  function renderTotal(total) {
    document.getElementById('totalCal').textContent = total.toLocaleString();
    const pct = Math.min((total / GOAL) * 100, 100);
    document.getElementById('goalBar').style.width = pct + '%';
    document.getElementById('goalText').textContent =
      total.toLocaleString() + ' / ' + GOAL.toLocaleString() + ' kcal goal';
  }

  function renderEntries(entries) {
    const list = document.getElementById('entryList');
    if (!entries.length) {
      list.innerHTML = '<div class="empty"><div class="icon">🍽️</div>No entries yet — add your first meal!</div>';
      return;
    }
    list.innerHTML = entries.map(e => {
      const time = e.created_at ? e.created_at.slice(11, 16) : '';
      return \`<div class="entry" id="entry-\${e.id}">
        <div class="entry-icon">🍴</div>
        <div class="entry-info">
          <div class="entry-name">\${esc(e.name)}</div>
          \${time ? \`<div class="entry-time">\${time}</div>\` : ''}
        </div>
        <div class="entry-cal">\${Number(e.calories).toLocaleString()} kcal</div>
        <button class="entry-del" onclick="deleteEntry(\${e.id})" title="Remove">✕</button>
      </div>\`;
    }).join('');
  }

  async function addEntry() {
    const name = document.getElementById('foodName').value.trim();
    const cal = document.getElementById('foodCal').value;
    if (!name) { showToast('Enter a food name'); return; }
    if (!cal || Number(cal) <= 0) { showToast('Enter valid calories'); return; }

    const btn = document.querySelector('.add-btn');
    btn.disabled = true;
    try {
      await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, calories: Number(cal) })
      });
      document.getElementById('foodName').value = '';
      document.getElementById('foodCal').value = '';
      await load();
      showToast('Added!');
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteEntry(id) {
    const el = document.getElementById('entry-' + id);
    if (el) { el.style.opacity = '.4'; el.style.pointerEvents = 'none'; }
    await fetch('/api/entries/' + id, { method: 'DELETE' });
    await load();
  }

  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  let toastTimer;
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  // Enter key submits
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (document.activeElement.id === 'foodName' || document.activeElement.id === 'foodCal')) {
      addEntry();
    }
  });

  // Init
  document.getElementById('nextBtn').disabled = true;
  load();
</script>
</body>
</html>`;

export default { port: process.env.PORT || 3000, fetch: app.fetch };

// ---------- Simple localStorage store ----------
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  clearAll() {
    localStorage.removeItem("slackDrafts");
    localStorage.removeItem("coffeeSlots");
    localStorage.removeItem("pointsLogs");
  }
};

const KEYS = {
  slack: "slackDrafts",
  coffee: "coffeeSlots",
  points: "pointsLogs"
};

// ---------- Tabs ----------
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

function showTab(id) {
  tabs.forEach(t => {
    const active = t.dataset.tab === id;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });

  panels.forEach(p => {
    const active = p.id === id;
    p.classList.toggle("active", active);
    p.setAttribute("aria-hidden", active ? "false" : "true");
  });
}

tabs.forEach(t => t.addEventListener("click", () => showTab(t.dataset.tab)));

document.querySelectorAll("[data-jump]").forEach(btn => {
  btn.addEventListener("click", () => showTab(btn.dataset.jump));
});

// ---------- Helpers ----------
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(el, msg) {
  if (!el) return;
  el.textContent = msg;
  if (!msg) return;
  setTimeout(() => { el.textContent = ""; }, 2200);
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// ---------- Slack drafts ----------
const slackForm = document.getElementById("slackForm");
const slackStatus = document.getElementById("slackStatus");
const slackList = document.getElementById("slackList");
const clearSlack = document.getElementById("clearSlack");

function renderSlack() {
  const drafts = store.get(KEYS.slack, []);
  if (!slackList) return;

  if (!drafts.length) {
    slackList.innerHTML = `<div class="muted small">No drafts yet.</div>`;
    updateStats();
    return;
  }

  slackList.innerHTML = drafts
    .slice()
    .reverse()
    .map(d => `
      <div class="item">
        <div class="item-main">
          <div class="item-title">${escapeHtml(d.channel)} • ${escapeHtml(d.text)}</div>
          <div class="item-meta">Saved: ${escapeHtml(d.createdAt)}</div>
        </div>
        <div class="item-actions">
          <button class="icon-btn" data-action="copySlack" data-id="${d.id}">Copy</button>
          <button class="icon-btn" data-action="deleteSlack" data-id="${d.id}">Delete</button>
        </div>
      </div>
    `).join("");

  updateStats();
}

slackForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const form = new FormData(slackForm);
  const channel = String(form.get("channel") || "").trim();
  const text = String(form.get("text") || "").trim();

  const drafts = store.get(KEYS.slack, []);
  drafts.push({
    id: uid(),
    channel,
    text,
    createdAt: new Date().toLocaleString()
  });
  store.set(KEYS.slack, drafts);

  slackForm.reset();
  setStatus(slackStatus, "✅ Draft saved.");
  renderSlack();
});

slackList?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const drafts = store.get(KEYS.slack, []);

  if (action === "deleteSlack") {
    store.set(KEYS.slack, drafts.filter(d => d.id !== id));
    renderSlack();
  }

  if (action === "copySlack") {
    const d = drafts.find(x => x.id === id);
    if (!d) return;
    navigator.clipboard.writeText(`[${d.channel}] ${d.text}`);
    setStatus(slackStatus, "📋 Copied to clipboard.");
  }
});

clearSlack?.addEventListener("click", () => {
  store.set(KEYS.slack, []);
  renderSlack();
});

// ---------- Coffee availability ----------
const coffeeForm = document.getElementById("coffeeForm");
const coffeeStatus = document.getElementById("coffeeStatus");
const coffeeList = document.getElementById("coffeeList");
const clearCoffee = document.getElementById("clearCoffee");
const coffeeSearch = document.getElementById("coffeeSearch");
const coffeeSort = document.getElementById("coffeeSort");

function coffeeSortFn(mode) {
  if (mode === "name") return (a,b) => a.name.localeCompare(b.name);
  if (mode === "latest") return (a,b) => (b.date+b.startTime).localeCompare(a.date+a.startTime);
  return (a,b) => (a.date+a.startTime).localeCompare(b.date+b.startTime); // soonest
}

function renderCoffee() {
  const q = String(coffeeSearch?.value || "").trim().toLowerCase();
  const mode = String(coffeeSort?.value || "soonest");

  let slots = store.get(KEYS.coffee, []);
  if (q) slots = slots.filter(s => (s.name || "").toLowerCase().includes(q));

  slots = slots.slice().sort(coffeeSortFn(mode));

  if (!coffeeList) return;

  if (!slots.length) {
    coffeeList.innerHTML = `<div class="muted small">No slots yet.</div>`;
    updateStats();
    return;
  }

  coffeeList.innerHTML = slots.map(s => `
    <div class="item">
      <div class="item-main">
        <div class="item-title">${escapeHtml(s.name)}</div>
        <div class="item-meta">
          ${escapeHtml(s.date)} • ${escapeHtml(s.startTime)}–${escapeHtml(s.endTime)}
          ${s.location ? ` • ${escapeHtml(s.location)}` : ""}
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-btn" data-action="deleteCoffee" data-id="${s.id}">Remove</button>
      </div>
    </div>
  `).join("");

  updateStats();
}

coffeeForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const form = new FormData(coffeeForm);
  const slot = {
    id: uid(),
    name: String(form.get("name") || "").trim(),
    date: String(form.get("date") || "").trim(),
    startTime: String(form.get("startTime") || "").trim(),
    endTime: String(form.get("endTime") || "").trim(),
    location: String(form.get("location") || "").trim(),
    createdAt: Date.now()
  };

  const slots = store.get(KEYS.coffee, []);
  slots.push(slot);
  store.set(KEYS.coffee, slots);

  coffeeForm.reset();
  setStatus(coffeeStatus, "✅ Slot added.");
  renderCoffee();
});

coffeeList?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.action === "deleteCoffee") {
    const id = btn.dataset.id;
    const slots = store.get(KEYS.coffee, []);
    store.set(KEYS.coffee, slots.filter(s => s.id !== id));
    renderCoffee();
  }
});

clearCoffee?.addEventListener("click", () => {
  store.set(KEYS.coffee, []);
  renderCoffee();
});

coffeeSearch?.addEventListener("input", renderCoffee);
coffeeSort?.addEventListener("change", renderCoffee);

// ---------- Points ----------
const pointsForm = document.getElementById("pointsForm");
const pointsStatus = document.getElementById("pointsStatus");
const leaderboardEl = document.getElementById("leaderboard");
const pointsLogEl = document.getElementById("pointsLog");
const clearPoints = document.getElementById("clearPoints");

function renderPoints() {
  const logs = store.get(KEYS.points, []).slice().sort((a,b) => b.createdAt - a.createdAt);

  // Leaderboard
  const totals = new Map();
  for (const l of logs) {
    totals.set(l.name, (totals.get(l.name) || 0) + l.points);
  }
  const rows = Array.from(totals.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a,b) => b.total - a.total);

  if (leaderboardEl) {
    leaderboardEl.innerHTML = rows.length
      ? rows.map((r, i) => `
          <div class="item">
            <div class="item-main">
              <div class="item-title">#${i+1} ${escapeHtml(r.name)}</div>
              <div class="item-meta">${r.total} points</div>
            </div>
          </div>
        `).join("")
      : `<div class="muted small">No points yet.</div>`;
  }

  // Recent logs
  if (pointsLogEl) {
    pointsLogEl.innerHTML = logs.length
      ? logs.slice(0, 10).map(l => `
          <div class="item">
            <div class="item-main">
              <div class="item-title">${escapeHtml(l.name)} • +${l.points}</div>
              <div class="item-meta">${escapeHtml(l.event)} • ${escapeHtml(l.date)} • ${new Date(l.createdAt).toLocaleString()}</div>
            </div>
            <div class="item-actions">
              <button class="icon-btn" data-action="deletePoints" data-id="${l.id}">Remove</button>
            </div>
          </div>
        `).join("")
      : `<div class="muted small">No logs yet.</div>`;
  }

  updateStats();
}

pointsForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const form = new FormData(pointsForm);
  const entry = {
    id: uid(),
    name: String(form.get("name") || "").trim(),
    event: String(form.get("event") || "").trim(),
    points: Number(form.get("points")),
    date: String(form.get("date") || "").trim(),
    createdAt: Date.now()
  };

  const logs = store.get(KEYS.points, []);
  logs.push(entry);
  store.set(KEYS.points, logs);

  pointsForm.reset();
  setStatus(pointsStatus, "✅ Points added.");
  renderPoints();
});

pointsLogEl?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.action === "deletePoints") {
    const id = btn.dataset.id;
    const logs = store.get(KEYS.points, []);
    store.set(KEYS.points, logs.filter(l => l.id !== id));
    renderPoints();
  }
});

clearPoints?.addEventListener("click", () => {
  store.set(KEYS.points, []);
  renderPoints();
});

// ---------- Settings ----------
const resetAll = document.getElementById("resetAll");
const settingsStatus = document.getElementById("settingsStatus");

resetAll?.addEventListener("click", () => {
  store.clearAll();
  setStatus(settingsStatus, "✅ Reset complete.");
  renderSlack();
  renderCoffee();
  renderPoints();
});

// ---------- Stats ----------
function updateStats() {
  const slack = store.get(KEYS.slack, []).length;
  const coffee = store.get(KEYS.coffee, []).length;
  const points = store.get(KEYS.points, []).length;

  const s1 = document.getElementById("statSlack");
  const s2 = document.getElementById("statCoffee");
  const s3 = document.getElementById("statPoints");

  if (s1) s1.textContent = String(slack);
  if (s2) s2.textContent = String(coffee);
  if (s3) s3.textContent = String(points);
}

// ---------- Initialize ----------
(function init() {
  // set default points date to today
  const pointsDate = document.querySelector('#pointsForm input[name="date"]');
  if (pointsDate && !pointsDate.value) pointsDate.value = todayISO();

  renderSlack();
  renderCoffee();
  renderPoints();
  updateStats();
})();
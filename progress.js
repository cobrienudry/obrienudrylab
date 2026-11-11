// Progress panels on the lab landing page. Each source is read live; nothing here holds names.
(function () {
  const CO_URL = "https://script.google.com/macros/s/AKfycbzNE8Nb7t8JB-s23NSyTT-_fzRc4pabIYIj3gLwEGdrALfosxLmDWIQdOf4eXcI8kZ4AQ/exec";
  const SPEECH_URL = "https://script.google.com/macros/s/AKfycbw2uaEKcFt-MtfCu4DjgND0d4IYakn0hvM3b2mpQvaCEnBL2YFGxLYf9DHObme1LytsLQ/exec";
  const SPEECH_ARTICLES = 7097; // rows in aid-withdrawal-speech/data/index.json
  const GAL_CSV = "https://docs.google.com/spreadsheets/d/11vAGY9uD7NqhG_wHbeO_yZICsvu8kDnTGoFza4HD_cE/gviz/tq?tqx=out:csv&gid=1164238963";

  const $ = id => document.getElementById(id);
  const fmt = n => n.toLocaleString("en-US");
  const pct = (a, b) => b ? Math.round(100 * a / b) + "%" : "0%";
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const stamp = () => `<span class="when">as of ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>`;
  const store = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const LEGEND = (a, b, c) => `<div class="legend"><span><i class="sw-done"></i>${a}</span><span><i class="sw-doing"></i>${b}</span><span><i class="sw-todo"></i>${c}</span></div>`;

  // one stacked bar: [done, doing, todo]
  function bar(parts, tips) {
    const tot = parts.reduce((a, b) => a + b, 0) || 1, cls = ["sw-done", "sw-doing", "sw-todo"];
    return `<div class="bar">${parts.map((v, i) => v ? `<span class="${cls[i]}" style="flex:${v / tot} 0 0" data-tip="${esc(tips[i])}"></span>` : "").join("")}</div>`;
  }

  // shared hover tooltip
  const tip = $("tip");
  document.addEventListener("pointermove", e => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { tip.classList.remove("on"); return; }
    tip.innerHTML = t.dataset.tip; tip.classList.add("on");
    const x = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8), y = e.clientY + 16 + tip.offsetHeight > innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 16;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  });
  document.addEventListener("scroll", () => tip.classList.remove("on"), { passive: true });

  /* ---------- galamsey: EA_status tab, public sheet ---------- */
  function parseCSV(t) {
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  async function galamsey() {
    const el = $("p-gal");
    try {
      const rows = parseCSV(await (await fetch(GAL_CSV)).text());
      const h = rows[0].map(s => s.trim()), ri = h.indexOf("region"), si = h.indexOf("status_1");
      if (ri < 0 || si < 0) throw new Error("columns");
      const reg = {};
      for (const r of rows.slice(1)) {
        if (!r[ri]) continue;
        const s = (r[si] || "").toLowerCase(), o = reg[r[ri]] = reg[r[ri]] || [0, 0, 0];
        o[s.startsWith("complete") ? 0 : s.startsWith("in progress") ? 1 : 2]++;
      }
      const list = Object.entries(reg).sort((a, b) => (b[1][0] / (b[1][0] + b[1][1] + b[1][2])) - (a[1][0] / (a[1][0] + a[1][1] + a[1][2])) || b[1][1] - a[1][1] || a[0].localeCompare(b[0]));
      const T = list.reduce((a, [, v]) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0]), N = T[0] + T[1] + T[2];
      const tips = (name, v) => { const n = v[0] + v[1] + v[2]; return [`<b>${esc(name)}</b><br>${v[0]} of ${n} areas searched (${pct(v[0], n)})`, `<b>${esc(name)}</b><br>${v[1]} in progress`, `<b>${esc(name)}</b><br>${v[2]} not started`]; };
      el.innerHTML = `<div class="head"><span class="big">${pct(T[0], N)}</span><span class="of">${fmt(T[0])} of ${fmt(N)} enumeration areas searched · ${fmt(T[1])} in progress</span>${stamp()}</div>
        ${bar(T, tips("All regions", T))}
        <div class="rows">${list.map(([name, v]) => `<span class="lab">${esc(name)}</span>${bar(v, tips(name, v))}<span class="num">${v[0]}/${v[0] + v[1] + v[2]}</span>`).join("")}</div>
        ${LEGEND("searched", "in progress", "not started")}
        <details class="tbl"><summary>Table</summary><table><tr><th>Region</th><th>Searched</th><th>In progress</th><th>Not started</th></tr>${list.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${v[0]}</td><td>${v[1]}</td><td>${v[2]}</td></tr>`).join("")}</table></details>`;
    } catch (e) { el.innerHTML = `<span class="note">Couldn't load progress from the coding sheet.</span>`; }
  }

  /* ---------- carbon offsets: public counts, else the key this browser has ---------- */
  async function post(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    return r.json();
  }
  async function offsets() {
    const el = $("p-co");
    let cs = null, names = null;
    try {
      const r = await post(CO_URL, { action: "progress" });
      if (r.ok) cs = r.companies.map(c => ({ rank: c[0], s: c[1], done_rows: c[2], rows: c[3] }));
    } catch (e) {}
    if (!cs && store("co-key")) {
      try {
        const r = await post(CO_URL, { action: "companies", k: store("co-key") });
        if (r.ok) { cs = r.companies.map(c => ({ rank: c.rank, s: c.done ? 2 : c.coder ? 1 : 0, done_rows: c.done_rows, rows: c.rows })); names = r.companies.map(c => c.company); }
      } catch (e) {}
    }
    if (!cs) { el.innerHTML = `<span class="note">Progress appears here once you've opened the carbon offsets tool with your link on this computer.</span>`; return; }
    const n = [0, 0, 0]; cs.forEach(c => n[c.s]++);
    const saved = cs.reduce((a, c) => a + c.done_rows, 0);
    const lab = ["not started", "in progress", "finished"];
    const cells = cs.map((c, i) => `<i class="s${c.s}" data-tip="<b>${names ? esc(names[i]) : "Rank " + c.rank}</b>${names ? " · rank " + c.rank : ""}<br>${lab[c.s]} · ${c.done_rows}/${c.rows} reports logged"></i>`).join("");
    el.innerHTML = `<div class="head"><span class="big">${fmt(n[2])}</span><span class="of">of ${fmt(cs.length)} companies finished · ${fmt(n[1])} in progress · ${fmt(saved)} report${saved === 1 ? "" : "s"} logged</span>${stamp()}</div>
      <div class="waffle" role="img" aria-label="${n[2]} companies finished, ${n[1]} in progress, ${n[0]} not started, in Fortune 500 rank order">${cells}</div>
      <div class="axis"><span>← rank 1</span><span>one square per company</span><span>${cs.length} →</span></div>
      ${LEGEND("finished", "in progress", "not started")}`;
  }

  /* ---------- aid speech: needs the key this browser stored when the RA opened the tool ---------- */
  const SPEECH_TASKS = { all: "All categories", pain: "Pain", autonomy: "Autonomy", technocratic: "Technocratic", security: "Security", accommodation: "Accommodation", praise: "Praise", topic: "Topic", speaker: "Speaker", venue: "Venue" };
  async function speech() {
    const el = $("p-speech");
    let key = ""; try { key = JSON.parse(store("aidspeech:key") || '""'); } catch (e) {}
    if (!key) { el.innerHTML = `<span class="note">Progress appears here once you've opened the speech coding site with your link on this computer.</span>`; return; }
    try {
      const r = await (await fetch(SPEECH_URL + "?action=state&k=" + encodeURIComponent(key))).json();
      if (!r.ok) throw new Error(r.error);
      const by = {};
      for (const c of r.claims) {
        const i = c.item.lastIndexOf("-"), art = c.item.slice(0, i), task = c.item.slice(i + 1);
        const t = by[task] = by[task] || { done: new Set(), doing: new Set() };
        (c.done ? t.done : t.doing).add(art);
      }
      const list = Object.entries(by).map(([t, v]) => { v.doing.forEach(a => v.done.has(a) && v.doing.delete(a)); return [t, v.done.size, v.doing.size]; })
        .sort((a, b) => (a[0] === "all" ? -1 : b[0] === "all" ? 1 : b[1] - a[1]));
      if (!list.length) { el.innerHTML = `<div class="head"><span class="big">0</span><span class="of">articles coded so far</span>${stamp()}</div>`; return; }
      const top = list[0];
      el.innerHTML = `<div class="head"><span class="big">${fmt(top[1])}</span><span class="of">of ${fmt(SPEECH_ARTICLES)} articles coded on <b>${esc(SPEECH_TASKS[top[0]] || top[0])}</b> (${pct(top[1], SPEECH_ARTICLES)})</span>${stamp()}</div>
        <div class="rows">${list.map(([t, d, g]) => { const name = SPEECH_TASKS[t] || t; return `<span class="lab">${esc(name)}</span>${bar([d, g, Math.max(0, SPEECH_ARTICLES - d - g)], [`<b>${esc(name)}</b><br>${fmt(d)} articles coded (${pct(d, SPEECH_ARTICLES)})`, `<b>${esc(name)}</b><br>${fmt(g)} being coded now`, `<b>${esc(name)}</b><br>${fmt(SPEECH_ARTICLES - d - g)} not started`])}<span class="num">${fmt(d)}</span>`; }).join("")}</div>
        ${LEGEND("coded", "being coded", "not started")}`;
    } catch (e) { el.innerHTML = `<span class="note">Couldn't load progress from the speech coding sheet.</span>`; }
  }

  galamsey(); offsets(); speech();
})();

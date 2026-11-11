// Task 1 tool: pick a company, save its reports to Google Drive, log them in the sheet.
(function () {
  // Talks to backend/Code.gs (a Google Apps Script web app). Paste its /exec URL here:
  const BACKEND_URL = "";
  const $ = id => document.getElementById(id);
  const YEARS = Array.from({ length: 11 }, (_, i) => 2015 + i);
  const TYPES = { SR: "Sustainability report", AR: "Annual report", "10K": "10-K", CDP: "CDP response" };
  const GRID_TYPES = ["SR", "AR"];
  const MAX_MB = 35;
  const store = {
    get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  // project key from the link (#k=KEY), remembered and removed from the address bar
  const m = /[#&]k=([^&]+)/.exec(location.hash);
  if (m) {
    store.set("co-key", decodeURIComponent(m[1]));
    try { history.replaceState(null, "", location.pathname + (location.hash.includes("summary") ? "#summary" : "")); } catch (e) {}
  }

  const S = { companies: [], company: null, rows: [], claim: null, busy: {} };
  const me = () => $("coName").value.trim();
  const mine = () => !!(S.claim && S.claim.coder && S.claim.coder.toLowerCase() === me().toLowerCase());

  window.api = window.api || async function (action, payload = {}) {
    const r = await fetch(BACKEND_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, action, k: store.get("co-key"), coder: me() }) });
    return r.json();
  };
  async function call(action, payload) {
    let res;
    try { res = await window.api(action, payload); } catch (e) { res = { ok: false, error: "Couldn't reach the server. Check your connection and try again." }; }
    if (!res.ok && /project key/i.test(res.error || "")) $("coKeyRow").hidden = false;
    return res;
  }
  function flash(text, bad) { const s = $("coStatus"); s.textContent = text; s.className = "status" + (bad ? " err" : ""); }
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- setup ---------- */
  if (!BACKEND_URL && !window.CO_MOCK) { $("coTool").hidden = true; $("coOff").hidden = false; $("manual").open = true; return; }
  $("coName").value = store.get("co-name");
  $("coName").addEventListener("change", () => { store.set("co-name", me()); renderPicker(); renderCompany(); });
  $("coKeySave").onclick = () => { store.set("co-key", $("coKey").value.trim()); $("coKeyRow").hidden = true; loadCompanies(); };
  $("coFilter").addEventListener("input", renderPicker);
  $("coPick").addEventListener("change", () => openCompany($("coPick").value));
  $("coRefresh").onclick = () => { loadCompanies(); if (S.company) openCompany(S.company); };

  async function loadCompanies() {
    flash("Loading companies…");
    const res = await call("companies");
    if (!res.ok) return flash(res.error, true);
    S.companies = res.companies;
    if (res.folder) $("coFolder").href = res.folder;
    renderPicker(); flash("");
  }

  function renderPicker() {
    const q = $("coFilter").value.trim().toLowerCase(), name = me().toLowerCase();
    const groups = { mine: [], open: [], taken: [], done: [] };
    for (const c of S.companies) {
      if (q && !(c.company.toLowerCase().includes(q) || String(c.rank) === q)) continue;
      const g = c.coder && c.coder.toLowerCase() === name && !c.done ? "mine" : c.done ? "done" : c.coder ? "taken" : "open";
      groups[g].push(c);
    }
    const label = c => `${String(c.rank).padStart(3, "0")} · ${c.company} — ${c.done_rows}/${c.rows} logged` + (c.coder && c.coder.toLowerCase() !== name ? ` (${c.coder})` : "");
    const opt = (c, dis) => `<option value="${esc(c.company)}"${dis ? " disabled" : ""}${c.company === S.company ? " selected" : ""}>${esc(label(c))}</option>`;
    const grp = (t, list, dis) => list.length ? `<optgroup label="${t} (${list.length})">${list.slice(0, 600).map(c => opt(c, dis)).join("")}</optgroup>` : "";
    $("coPick").innerHTML = `<option value="">Choose a company…</option>` +
      grp("Your companies", groups.mine) + grp("Not started", groups.open) +
      grp("Claimed by someone else", groups.taken, true) + grp("Finished", groups.done, true);
    $("coCounts").textContent = `${S.companies.filter(c => !c.coder && !c.done).length} not started · ${S.companies.filter(c => c.done).length} finished`;
  }

  /* ---------- one company ---------- */
  async function openCompany(name) {
    S.company = name || null; S.rows = []; S.claim = null;
    $("coCompany").hidden = !name;
    if (!name) return;
    $("coCoName").textContent = name;
    $("coRows").innerHTML = `<p class="muted">Loading…</p>`;
    const res = await call("company", { company: name });
    if (!res.ok) return flash(res.error, true);
    S.rows = res.rows; S.claim = res.claim;
    renderCompany();
  }

  function cellState(year, type) {
    const rs = S.rows.filter(r => r.year === String(year) && r.type === type);
    if (!rs.length) return { cls: "missing", txt: "+", tip: "Not listed. Click to add." };
    if (rs.some(r => r.status === "saved")) return { cls: "saved", txt: "✓", tip: "Saved to Drive" };
    if (rs.every(r => r.status === "no_report")) return { cls: "none", txt: "–", tip: "No report this year" };
    if (rs.every(r => r.status)) return { cls: "bad", txt: "✗", tip: "Dead link or wrong document" };
    return { cls: "todo", txt: "•", tip: "Listed, not saved yet" };
  }

  function renderCompany() {
    if (!S.company) return;
    const c = S.companies.find(x => x.company === S.company) || {};
    const ok = mine();
    $("coCoRank").textContent = c.rank ? "Fortune rank " + c.rank : "";
    $("coClaim").innerHTML = !S.claim || !S.claim.coder ? "Nobody has started this company."
      : ok ? `You claimed this company${S.claim.done_at ? " and marked it finished" : ""}.`
      : `Claimed by <b>${esc(S.claim.coder)}</b>. Pick another company.`;
    $("coStart").hidden = !!(S.claim && S.claim.coder);
    $("coRelease").hidden = !ok;
    const open = S.rows.filter(r => (r.url || r.year) && !r.status).length;
    $("coFinish").hidden = !ok;
    $("coFinish").disabled = open > 0 || !S.rows.length;
    $("coFinish").title = open ? `${open} report(s) still need saving or marking` : "";
    $("coAdd").hidden = !ok;
    $("coNeedName").hidden = !!me();

    // coverage grid
    $("coGrid").innerHTML = `<thead><tr><th></th>${YEARS.map(y => `<th>${String(y).slice(2)}</th>`).join("")}</tr></thead><tbody>` +
      GRID_TYPES.map(t => `<tr><th>${t === "SR" ? "Sustainability" : "Annual"}</th>${YEARS.map(y => {
        const s = cellState(y, t);
        return `<td><button type="button" class="cell ${s.cls}" data-y="${y}" data-t="${t}" title="${y}: ${s.tip}" aria-label="${t} ${y}: ${s.tip}">${s.txt}</button></td>`;
      }).join("")}</tr>`).join("") + "</tbody>";
    $("coGrid").querySelectorAll(".cell").forEach(b => b.onclick = () => {
      const r = S.rows.find(r => r.year === b.dataset.y && r.type === b.dataset.t);
      if (r) { const el = document.querySelector(`[data-row="${r.row_id}"]`); el && el.scrollIntoView({ behavior: "smooth", block: "center" }); el && el.classList.add("hl"); setTimeout(() => el && el.classList.remove("hl"), 1500); }
      else if (ok) { $("addYear").value = b.dataset.y; $("addType").value = b.dataset.t; $("coAdd").open = true; $("addUrl").focus(); }
    });

    // rows
    const rows = [...S.rows].sort((a, b) => (b.year || "0").localeCompare(a.year || "0") || a.type.localeCompare(b.type));
    $("coRows").innerHTML = rows.length ? rows.map(r => rowHtml(r, ok)).join("") : `<p class="muted">No reports listed yet. Add them below.</p>`;
    $("coRows").querySelectorAll("[data-act]").forEach(el => {
      const id = Number(el.closest("[data-row]").dataset.row);
      if (el.tagName === "SELECT") el.onchange = () => markRow(id, el.value, el);
      else if (el.type === "file") el.onchange = () => el.files[0] && uploadRow(id, el.files[0]);
      else el.onclick = () => fetchRow(id);
    });
  }

  const STATUS = { saved: ["saved", "Saved"], dead_link: ["bad", "Dead link"], wrong_doc: ["bad", "Wrong document"], no_report: ["none", "No report"], "": ["todo", "To do"] };
  function rowHtml(r, ok) {
    const st = STATUS[r.status] || STATUS[""], busy = S.busy[r.row_id];
    const title = r.title || TYPES[r.type];
    const link = r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(title)} ↗</a>` : esc(title);
    const src = r.source && !r.url ? ` · <a href="${esc(r.source)}" target="_blank" rel="noopener">source page ↗</a>` : "";
    const done = r.status === "saved" ? `<a class="btn small" href="${esc(r.drive_file)}" target="_blank" rel="noopener">Open in Drive ↗</a>` : "";
    const acts = !ok || r.status === "saved" ? "" : `
      ${r.url ? `<button type="button" class="btn small primary" data-act="fetch"${busy ? " disabled" : ""}>Save to Drive</button>` : ""}
      <label class="btn small filebtn${busy ? " disabled" : ""}">Upload PDF<input type="file" accept="application/pdf,.pdf" data-act="upload"${busy ? " disabled" : ""}></label>
      <select class="small" data-act="mark" aria-label="Mark this report"${busy ? " disabled" : ""}>
        <option value="">${r.status ? "Undo mark" : "Mark as…"}</option>
        <option value="dead_link">Dead link, no copy found</option>
        <option value="wrong_doc">Wrong document</option>
        <option value="no_report">No report this year</option>
      </select>`;
    return `<div class="rrow" data-row="${r.row_id}">
      <div class="rmain"><span class="yr">${esc(r.year || "—")}</span><span class="ty">${esc(r.type)}</span>
        <span class="rt">${link}${src}${r.notes ? `<span class="rn">${esc(r.notes)}</span>` : ""}${busy ? `<span class="rn">${esc(busy)}</span>` : ""}${r.err ? `<span class="rn err">${esc(r.err)}</span>` : ""}</span>
        <span class="pill ${st[0]}">${st[1]}</span></div>
      <div class="racts">${done}${acts}</div></div>`;
  }

  function replaceRow(row, err) {
    const i = S.rows.findIndex(r => r.row_id === row.row_id);
    if (i >= 0) S.rows[i] = row; else S.rows.push(row);
    if (err) row.err = err;
    const c = S.companies.find(x => x.company === S.company);
    if (c) { c.rows = S.rows.filter(r => r.url || r.year || r.status).length; c.done_rows = S.rows.filter(r => r.status).length; }
    renderCompany(); renderPicker();
  }

  async function act(id, label, action, payload) {
    if (!me()) return flash("Enter your name first.", true);
    const row = S.rows.find(r => r.row_id === id); delete row.err;
    S.busy[id] = label; renderCompany();
    const res = await call(action, { row_id: id, ...payload });
    delete S.busy[id];
    if (res.ok) { replaceRow(res.row); flash(""); }
    else replaceRow(row, res.error);
  }
  const fetchRow = id => act(id, "Saving to Drive… (large reports can take a minute)", "fetch");
  function markRow(id, status, sel) {
    const note = status ? prompt({ dead_link: "Where did you look for a working copy?", wrong_doc: "What is the link actually? (and where the right one might be)", no_report: "Where did you look?" }[status] || "Note:") : "";
    if (note === null) { sel.value = ""; return; }
    act(id, "Saving…", "mark", { status, note });
  }
  function uploadRow(id, file) {
    if (file.size > MAX_MB * 1e6) return replaceRow(S.rows.find(r => r.row_id === id), `That file is over ${MAX_MB} MB. Put it in the Drive folder by hand and paste its link in the sheet.`);
    const fr = new FileReader();
    fr.onload = () => act(id, "Uploading…", "upload", { filename: file.name, data: String(fr.result).split(",")[1] || "" });
    fr.readAsDataURL(file);
  }

  async function claimAction(action, confirmText) {
    if (!me()) return flash("Enter your name first.", true);
    if (confirmText && !confirm(confirmText)) return;
    const res = await call(action, { company: S.company });
    if (!res.ok) return flash(res.error, true);
    const c = S.companies.find(x => x.company === S.company);
    if (action === "claim") { S.claim = res.claim; if (c) c.coder = me(); }
    if (action === "release") { S.claim = null; if (c) c.coder = ""; }
    if (action === "finish") { if (c) c.done = true; if (S.claim) S.claim.done_at = "now"; flash(`${S.company} marked finished. Pick the next company.`); }
    renderCompany(); renderPicker();
  }
  $("coStart").onclick = () => claimAction("claim");
  $("coRelease").onclick = () => claimAction("release", `Give up ${S.company}? Rows you've already saved stay saved.`);
  $("coFinish").onclick = () => claimAction("finish", `Mark ${S.company} finished? Check the grid first: every year from 2015 to 2025 should have a sustainability and an annual report row (saved, or marked "no report").`);

  // add a report row
  $("addYear").innerHTML = `<option value="">Year…</option>` + [...YEARS].reverse().map(y => `<option>${y}</option>`).join("");
  $("addType").innerHTML = Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  async function addRow(noReport) {
    if (!me()) return flash("Enter your name first.", true);
    const p = { company: S.company, year: $("addYear").value, type: $("addType").value, title: $("addTitle").value, url: $("addUrl").value, source: $("addSource").value, notes: $("addNotes").value, no_report: noReport };
    if (!p.year) return flash("Pick a year.", true);
    if (!noReport && !/^https?:\/\//.test(p.url.trim())) return flash("Paste the report's link (or use 'Doesn't exist').", true);
    if (noReport && !p.notes.trim()) return flash("Say where you looked in Notes.", true);
    flash("Adding…");
    const res = await call("add", p);
    if (!res.ok) return flash(res.error, true);
    ["addTitle", "addUrl", "addSource", "addNotes"].forEach(id => $(id).value = "");
    replaceRow(res.row); flash(`Added ${p.year} ${TYPES[p.type]}.` + (noReport ? "" : " Now save it to Drive."));
    if (!noReport && $("addAutoSave").checked) fetchRow(res.row.row_id);
  }
  $("addBtn").onclick = () => addRow(false);
  $("addNone").onclick = () => addRow(true);

  loadCompanies();
})();

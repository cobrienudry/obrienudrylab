// MOS digitization review screens (extraction check, page completeness, linking).
// Loaded before the main script in index.html; uses its helpers ($, esc, cur, store, needs, rowsFor…) at call time.

function tablesFor(b, c, task, coder) { const k = TASK_BY[task].kind; return k === "careers" ? rowsFor(b, c, task, coder) : MOSK[k].rows(b, c, task, coder); }
const VCOLOR = { ok: "--ok", real: "--ok", same: "--ok", typos: "--ok", fix: "--fix", merged: "--fix", unsure: "--fix", blank: "--drop", fragment: "--drop", garbage: "--drop", not_found: "--drop", wrong_page: "--drop", different: "--drop" };
const CHIP = (attr, o, on) => `<button class="chip" type="button" ${attr}="${esc(o[0])}" ${o[2] ? `data-key="${esc(o[2])}"` : ""} aria-pressed="${!!on}" style="--c:var(${VCOLOR[o[0]] || "--accent"})"${o[3] ? ` title="${esc(o[3])}"` : ""}>${esc(o[1])}${o[2] ? `<kbd>${esc(o[2].toUpperCase())}</kbd>` : ""}</button>`;
const tail = (b, c, task) => [Math.round(b.secs), needs(task, c.id) === 2 ? 1 : 0, b.cbv, b.dv, new Date(b.at).toISOString()];
const TAILC = ["case_note", "seconds_spent", "double_coded", "codebook_version", "data_version", "saved_at"];

function pageViewer(c, boxes) {
  return `<div class="pv" id="pv"><div class="pvbar"><span>issue ${esc(c.issue)} · page ${esc(c.page)} of ${esc(c.n_pages)}</span><span class="sp"></span>
    <button class="btn small" type="button" data-z="1">Fit</button><button class="btn small" type="button" data-z="1.6">160%</button><button class="btn small" type="button" data-z="2.4">240%</button>
    <a href="${esc(c.img)}" target="_blank" rel="noopener">Open ↗</a></div>
    <div class="pvscroll" id="pvscroll"><div class="pvinner" id="pvinner"><img src="${esc(c.img)}" alt="Scanned MOS page ${esc(c.page)}" id="pvimg">
    ${boxes.map(b => `<div class="box${b.cls ? " " + b.cls : ""}" data-g="${esc(b.g ?? "")}" style="left:${b.r[0] * 100}%;top:${b.r[1] * 100}%;width:${b.r[2] * 100}%;height:${b.r[3] * 100}%">${b.label ? `<b>${esc(b.label)}</b>` : ""}</div>`).join("")}
    </div></div></div>`;
}
function wireViewer(g) {
  let z = store.get("zoom") || 1.6;
  const apply = () => { $("pvinner").style.width = z * 100 + "%"; };
  apply();
  $("pv").querySelectorAll("[data-z]").forEach(b => b.onclick = () => { z = +b.dataset.z; store.set("zoom", z); apply(); focusBox(cur.g ?? g); });
  const img = $("pvimg");
  if (img.complete) focusBox(g); else img.onload = () => focusBox(cur.g ?? g);
}
function focusBox(g) {
  const sc = $("pvscroll"); if (!sc) return;
  const all = [...sc.querySelectorAll(".box")], keyed = g != null && g !== "";
  if (keyed) { cur.g = g; all.forEach(b => b.classList.toggle("on", b.dataset.g === String(g))); }
  const bx = keyed ? all.filter(b => b.dataset.g === String(g)) : all;
  if (!bx.length) return;
  const top = Math.min(...bx.map(b => b.offsetTop)), left = Math.min(...bx.map(b => b.offsetLeft));
  sc.scrollTo({ top: Math.max(0, top - 90), left: Math.max(0, left - 40), behavior: "smooth" });
}
const krows = () => [...$("moswork").querySelectorAll(".krow")];
function setAi(i, scroll) {
  const r = krows(); if (!r.length) return;
  i = Math.max(0, Math.min(r.length - 1, i)); cur.ai = i;
  r.forEach((x, j) => x.classList.toggle("on", j === i));
  if (scroll) r[i].scrollIntoView({ block: "nearest", behavior: "smooth" });
  if (r[i].dataset.g != null) focusBox(r[i].dataset.g);
}
function advance() { const r = krows(); const n = r.findIndex((x, j) => j > cur.ai && !x.dataset.done); setAi(n >= 0 ? n : cur.ai, true); }
function mosKey(e) {
  const k = e.key.toLowerCase();
  if (k === "j") { e.preventDefault(); setAi(cur.ai + 1, true); return; }
  if (k === "k") { e.preventDefault(); setAi(cur.ai - 1, true); return; }
  const row = krows()[cur.ai]; if (!row || k.length !== 1) return;
  const b = row.querySelector(`[data-key="${CSS.escape(k)}"]`); if (b) { e.preventDefault(); b.click(); }
}
const problemsList = () => `<ul class="problems" id="problems" hidden></ul>`;
function wireRows() {
  krows().forEach((r, j) => r.addEventListener("click", ev => { if (!ev.target.closest("button,textarea,input,a,summary")) setAi(j); }));
  setAi(cur.ai);
}

const MOSK = {
  // ---------- 1. one entry: is each extracted field right? ----------
  extract: {
    render() {
      const c = cur.c;
      $("casehead").innerHTML = `<div class="eyebrow">${esc(c.id)} · ${esc(c.era_label)}${cur.saved ? " · you saved this case" : ""}</div>
        <h2>${esc(c.project_title || "(no title extracted)")}</h2>
        <p class="sub">${esc(c.country || "no country extracted")} · issue of ${esc(c.issue)}${c.match < 0.6 ? ` · <span class="warnline">page match uncertain: only ${Math.round(c.match * 100)}% of the row's words are on this page</span>` : ""}</p>`;
      $("moswork").innerHTML = `<div class="split">${c.img ? pageViewer(c, (c.boxes || []).map(r => ({ r }))) : `<div class="panel">No page image for this entry.</div>`}<div class="side" id="side"></div></div>`;
      cur.ai = 0; cur.g = null;
      if (c.img) wireViewer();
      this.side();
    },
    side() {
      const c = cur.c, st = cur.st; st.f ||= {};
      const real = st.type === "real" || st.type === "merged";
      let h = `<div class="krow ${st.type ? (real ? "done" : "bad") : ""}" ${st.type ? 'data-done="1"' : ""}><div class="lab"><b>What is this row?</b>
        <span class="hint">Find the highlighted entry on the page. The boxes are a guide; the entry can extend beyond them.</span></div>
        <div class="chips">${ENTRY_TYPES.map(o => CHIP("data-type", o, st.type === o[0])).join("")}</div>
        <details class="desc"><summary>Text the parser read</summary><p>${esc(c.raw)}</p></details></div>`;
      if (real) h += c.fields.map(f => {
        const [label, hint, long] = MOS_FIELDS[f], v = c[f] || "", s = st.f[f] || {};
        const opts = v ? FIELD_VERDICTS : [["ok", "Correctly empty", "a"], ["fix", "Missed: enter it", "e"]];
        const cls = s.v ? (s.v === "fix" ? "fixd" : s.v === "blank" ? "bad" : "done") : "";
        return `<div class="krow ${cls}" data-f="${f}" ${s.v ? 'data-done="1"' : ""}><div class="lab"><b>${esc(label)}</b><span class="hint">${esc(hint)}</span></div>
          <div class="val${v ? "" : " empty"}${long ? " long" : ""}">${v ? esc(v) : "— nothing extracted —"}</div>
          <div class="chips">${opts.map(o => CHIP("data-fv", o, s.v === o[0])).join("")}</div>
          ${s.v === "fix" ? `<textarea data-fix="${f}" rows="${long ? 4 : 1}" placeholder="What the page prints">${esc(s.val ?? v)}</textarea>` : ""}</div>`;
      }).join("");
      $("side").innerHTML = h + problemsList();
      $("side").querySelectorAll("[data-type]").forEach(b => b.onclick = () => {
        st.type = b.dataset.type; this.side(); setAi(st.type === "real" || st.type === "merged" ? 1 : 0, true);
      });
      $("side").querySelectorAll("[data-fv]").forEach(b => b.onclick = () => {
        const f = b.closest(".krow").dataset.f, j = krows().indexOf(b.closest(".krow"));
        st.f[f] = { ...st.f[f], v: b.dataset.fv };
        if (b.dataset.fv === "fix" && st.f[f].val == null) st.f[f].val = c[f] || "";
        this.side(); setAi(j);
        if (b.dataset.fv === "fix") { const t = krows()[j].querySelector("textarea"); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } } else advance();
      });
      $("side").querySelectorAll("[data-fix]").forEach(t => t.oninput = () => { st.f[t.dataset.fix].val = t.value; });
      wireRows();
    },
    problems() {
      const c = cur.c, st = cur.st, out = [];
      if (!st.type) out.push("Say what this row is");
      else if (st.type === "real" || st.type === "merged") for (const f of c.fields) {
        const s = (st.f || {})[f], lab = MOS_FIELDS[f][0];
        if (!s?.v) out.push(`${lab}: no answer`);
        else if (s.v === "fix" && String(s.val ?? "").trim() === String(c[f] || "").trim()) out.push(`${lab}: type the correct value (it's still the same as extracted)`);
      }
      return out;
    },
    rows(b, c, task, coder) {
      const st = b.st, at = new Date(b.at).toISOString(), base = [coder, task, c.id, c.issue, c.era_bin, c.era, c.project_id, c.pdf, c.page ?? ""];
      const real = st.type === "real" || st.type === "merged", n = { ok: 0, typos: 0, fix: 0, blank: 0 };
      const fields = real ? c.fields.map(f => {
        const s = st.f[f] || {}; n[s.v] = (n[s.v] || 0) + 1;
        return [...base, st.type, f, c[f] || "", s.v || "", s.v === "fix" ? String(s.val ?? "").trim() : "", b.cbv, b.dv, at];
      }) : [];
      const head = ["coder", "task", "case_id", "issue_date", "era_bin", "format_era", "project_id", "source_pdf", "page"];
      return [
        { name: "fields", cols: [...head, "entry_type", "field", "extracted", "verdict", "corrected", "codebook_version", "data_version", "saved_at"], rows: fields },
        { name: "entries", cols: [...head, "page_match", "entry_type", "n_fields", "n_ok", "n_typos", "n_fixed", "n_not_printed", ...TAILC],
          rows: [[...base, c.match ?? "", st.type, real ? c.fields.length : 0, n.ok, n.typos, n.fix, n.blank, b.note || "", ...tail(b, c, task)]] },
      ];
    },
    guide() {
      return `<h4>What you are doing</h4><p>The pipeline read about 750 monthly issues of the World Bank's <i>Monthly Operational Summary</i> (1955–2020) and split each project listing into fields. Each case is one listing it extracted, shown beside the scanned page it came from (orange boxes mark where we think it is). Check whether each field is right.</p>
        <h4>Steps</h4><ul><li><b>What is this row?</b> Find the entry on the page. If it is a real listing (or two listings run together), check its fields. If it is a fragment, garbage or not on the page, the case is done.</li>
        <li>For every field: <b>Correct</b> (<kbd>A</kbd>); <b>Right, minor OCR typos</b> (<kbd>T</kbd>: the right text with a few wrong characters, like “Elderhl” for “Elderly”); <b>Wrong: fix</b> (<kbd>E</kbd>: it holds text from another field or entry, misses a large part, or is plain wrong; type what the page prints); <b>Not printed</b> (<kbd>X</kbd>: the field holds something but the page prints nothing for it).</li>
        <li>An empty field: <b>Correctly empty</b> or <b>Missed: enter it</b>.</li></ul>
        <p>Move with <kbd>J</kbd>/<kbd>K</kbd>; after each answer the next field is selected. For long fields (description, contact) judge whether the right text was captured, not every character.</p>
        <h4>Field guide</h4><dl>${Object.values(MOS_FIELDS).map(f => `<dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd>`).join("")}</dl>
        <h4>Row types</h4><dl>${ENTRY_TYPES.map(o => `<dt>${esc(o[1])}</dt><dd>${esc(o[3])}</dd>`).join("")}</dl>
        <h4>Page image</h4><p>Fit / 160% / 240% zoom; Open ↗ shows the page in a new tab. Region, country and sector headings are often on an earlier page: if the country isn't on this page, use the “(Cont'd)” heading or running header.</p>`;
    },
  },

  // ---------- 2. one page: which extracted rows are real, what was missed? ----------
  page: {
    render() {
      const c = cur.c;
      $("casehead").innerHTML = `<div class="eyebrow">${esc(c.id)} · ${esc(c.era_label)}${cur.saved ? " · you saved this case" : ""}</div>
        <h2>Issue of ${esc(c.issue)}, page ${esc(c.page)}</h2>
        <p class="sub">The pipeline placed ${c.rows.length} row${c.rows.length === 1 ? "" : "s"} on this page (${esc(c.n_issue_rows)} in the whole issue). Numbered boxes show where each row's text is.</p>`;
      const boxes = c.rows.flatMap((r, i) => (r.boxes || []).map((b, k) => ({ r: b, g: i, cls: "dim", label: k === 0 ? String(i + 1) : "" })));
      $("moswork").innerHTML = `<div class="split">${pageViewer(c, boxes)}<div class="side" id="side"></div></div>`;
      cur.ai = 0; cur.g = null;
      wireViewer(0); this.side();
    },
    side() {
      const c = cur.c, st = cur.st; st.r ||= {}; st.miss ||= [];
      let h = c.rows.map((r, i) => {
        const v = st.r[r.rid];
        return `<div class="krow ${v ? (v === "real" ? "done" : "bad") : ""}" data-g="${i}" data-rid="${esc(r.rid)}" ${v ? 'data-done="1"' : ""}>
          <div class="lab"><b>${i + 1}. ${esc(r.project_title || "(no title)")}</b></div>
          <div class="val">${esc([r.country, r.amount_raw && "US$ " + r.amount_raw, r.funding_source].filter(Boolean).join(" · "))}</div>
          <div class="chips">${ROW_VERDICTS.map(o => CHIP("data-rv", o, v === o[0])).join("")}</div>
          <details class="desc"><summary>Text the parser read</summary><p>${esc(r.raw)}</p></details></div>`;
      }).join("");
      h += `<div class="panel judge"><h3>Entries on this page that are missing above</h3>
        <p class="where">Add each project listing printed on this page that has no row above (including one that starts here and continues on the next page).</p>
        <div class="misslist">${st.miss.map((m, j) => `<div class="missrow"><input type="text" data-m="${j}" data-k="country" placeholder="Country" value="${esc(m.country || "")}">
          <input type="text" data-m="${j}" data-k="title" placeholder="Project title as printed" value="${esc(m.title || "")}">
          <input type="text" data-m="${j}" data-k="amount" placeholder="Amount" value="${esc(m.amount || "")}">
          <button class="btn small" type="button" data-rm="${j}">Remove</button></div>`).join("")}</div>
        <div class="formrow"><button class="btn" type="button" id="addmiss">+ Add a missing entry</button></div>
        <label style="display:grid;gap:4px;max-width:460px"><span class="where">How many project listings does this page print in total? Count one that continues from the previous page.</span>
          <input type="number" min="0" max="80" id="pcount" value="${esc(st.count ?? "")}" style="max-width:120px"></label>
        ${problemsList()}</div>`;
      $("side").innerHTML = h;
      $("side").querySelectorAll("[data-rv]").forEach(b => b.onclick = () => {
        const row = b.closest(".krow"), j = krows().indexOf(row);
        st.r[row.dataset.rid] = b.dataset.rv; this.side(); setAi(j); advance();
      });
      $("side").querySelectorAll("[data-m]").forEach(t => t.oninput = () => { st.miss[+t.dataset.m][t.dataset.k] = t.value; });
      $("side").querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { st.miss.splice(+b.dataset.rm, 1); this.side(); });
      $("addmiss").onclick = () => { st.miss.push({}); this.side(); $("side").querySelector(`[data-m="${st.miss.length - 1}"][data-k="country"]`)?.focus(); };
      $("pcount").oninput = e => { st.count = e.target.value; };
      wireRows();
    },
    problems() {
      const c = cur.c, st = cur.st, out = [];
      c.rows.forEach((r, i) => { if (!(st.r || {})[r.rid]) out.push(`Row ${i + 1}: no answer`); });
      (st.miss || []).forEach((m, j) => { if (!(m.title || "").trim()) out.push(`Missing entry ${j + 1}: needs a title`); });
      if (!/^\d+$/.test(String(st.count ?? "").trim())) out.push("Count the listings printed on the page");
      return out;
    },
    rows(b, c, task, coder) {
      const st = b.st, at = new Date(b.at).toISOString(), base = [coder, task, c.id, c.issue, c.era_bin, c.era, c.pdf, c.page];
      const n = {}, rows = c.rows.map((r, i) => {
        const v = st.r[r.rid] || ""; n[v] = (n[v] || 0) + 1;
        return [...base, i + 1, r.rid, r.project_id, r.country || "", r.project_title || "", r.amount_raw || "", v, b.cbv, b.dv, at];
      });
      (st.miss || []).forEach((m, j) => rows.push([...base, `M${j + 1}`, "", "", (m.country || "").trim(), (m.title || "").trim(), (m.amount || "").trim(), "missing", b.cbv, b.dv, at]));
      const head = ["coder", "task", "case_id", "issue_date", "era_bin", "format_era", "source_pdf", "page"];
      return [
        { name: "page_rows", cols: [...head, "row_n", "panel_row", "project_id", "country", "project_title", "amount_raw", "verdict", "codebook_version", "data_version", "saved_at"], rows },
        { name: "pages", cols: [...head, "n_listed", "n_real", "n_fragment", "n_merged", "n_garbage", "n_wrong_page", "n_missing", "n_printed", ...TAILC],
          rows: [[...base, c.rows.length, n.real || 0, n.fragment || 0, n.merged || 0, n.garbage || 0, n.wrong_page || 0, (st.miss || []).length, String(st.count).trim(), b.note || "", ...tail(b, c, task)]] },
      ];
    },
    guide() {
      return `<h4>What you are doing</h4><p>Each case is one scanned page of the <i>Monthly Operational Summary</i>, beside every row the pipeline extracted from it. This measures what the digitization gets wrong at the page level: rows that aren't real listings, and listings it never picked up.</p>
        <h4>Steps</h4><ul><li>For each row (the number matches the box on the page): <b>Real entry</b> (<kbd>A</kbd>); <b>Fragment</b> (<kbd>F</kbd>: a piece of a listing, e.g. a continuation line split off); <b>Two merged</b> (<kbd>M</kbd>: text from two listings run together); <b>Garbage</b> (<kbd>G</kbd>: OCR scramble, headers, footnotes); <b>Not on this page</b> (<kbd>W</kbd>).</li>
        <li>Add every listing printed on the page that has no row, with its country, title and amount as printed.</li>
        <li>Count all project listings printed on the page.</li></ul>
        <p>A listing is one project: before Oct 1996, one row of the table across its columns; after, a bold title followed by its paragraph. A real entry with slightly garbled fields is still a real entry: field errors are checked in the Extraction task.</p>`;
    },
  },

  // ---------- 3. two listings: same project? ----------
  link: {
    render() {
      const c = cur.c;
      $("casehead").innerHTML = `<div class="eyebrow">${esc(c.id)}${cur.saved ? " · you saved this case" : ""}</div><h2>Are these the same project?</h2>
        <p class="sub">Two listings from different monthly issues (${esc(c.a.issue)} and ${esc(c.b.issue)}). Projects change stage, amount and wording over time; judge whether it is the same operation.</p>`;
      const F2 = [["issue", "Issue"], ["country", "Country"], ["region", "Region"], ["sector", "Sector"], ["project_title", "Title"], ["amount_raw", "Amount"], ["funding_source", "Lender"],
        ["pid", "Project ID"], ["implementing_agency", "Agency"], ["environmental_category", "Env. category"], ["listing_status", "New / revised"], ["stage_of_processing", "Stage"], ["description", "Description"]];
      const nz = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const side = (x, y, lab) => `<div class="panel"><div class="eyebrow">${lab}</div><dl>${F2.filter(([f]) => x[f]).map(([f, l]) =>
        `<dt>${l}</dt><dd class="${f !== "issue" && nz(x[f]) && nz(x[f]) === nz(y[f]) ? "same" : ""}">${f === "description" || f === "stage_of_processing" ? `<div class="val long">${esc(x[f])}</div>` : esc(x[f])}</dd>`).join("")}</dl>
        <details class="desc"><summary>Text the parser read</summary><p>${esc(x.raw)}</p></details></div>`;
      $("moswork").innerHTML = `<div class="pair">${side(c.a, c.b, "Earlier listing")}${side(c.b, c.a, "Later listing")}</div><div class="side" id="side" style="margin-top:12px"></div>`;
      cur.ai = 0; this.side();
    },
    side() {
      const st = cur.st; st.reasons ||= [];
      $("side").innerHTML = `<div class="krow ${st.v ? (st.v === "same" ? "done" : st.v === "different" ? "bad" : "fixd") : ""}"><div class="lab"><b>Your judgement</b><span class="hint">Green text marks fields that match exactly.</span></div>
        <div class="chips">${LINK_VERDICTS.map(o => CHIP("data-lv", o, st.v === o[0])).join("")}</div>
        <div class="lab"><span class="hint">What tells you? (optional, choose any)</span></div>
        <div class="chips">${LINK_REASONS.map(o => CHIP("data-lr", o, st.reasons.includes(o[0]))).join("")}</div></div>${problemsList()}`;
      $("side").querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { st.v = b.dataset.lv; this.side(); });
      $("side").querySelectorAll("[data-lr]").forEach(b => b.onclick = () => { const r = b.dataset.lr; st.reasons = st.reasons.includes(r) ? st.reasons.filter(x => x !== r) : [...st.reasons, r]; this.side(); });
      wireRows();
    },
    problems() { return cur.st.v ? [] : ["Say whether they are the same project"]; },
    rows(b, c, task, coder) {
      const st = b.st, linked = c.kind === "linked";
      const agree = st.v === "unsure" ? "" : (st.v === "same") === linked ? 1 : 0;
      return [{ name: "links", cols: ["coder", "task", "case_id", "pair_kind", "stratum", "pipeline_linked", "a_issue", "a_project_id", "a_country", "a_title", "b_issue", "b_project_id", "b_country", "b_title", "verdict", "reasons", "agrees_with_pipeline", ...TAILC],
        rows: [[coder, task, c.id, c.kind, c.stratum, linked ? 1 : 0, c.a.issue, c.a.project_id, c.a.country || "", c.a.project_title || "", c.b.issue, c.b.project_id, c.b.country || "", c.b.project_title || "",
          st.v, (st.reasons || []).join("|"), agree, b.note || "", ...tail(b, c, task)]] }];
    },
    guide() {
      return `<h4>What you are doing</h4><p>The pipeline follows each project from one monthly issue to the next: by its printed project ID where there is one, otherwise by country and title. Each case shows two listings from different issues. Some were linked as one project and some were not; you aren't told which. Judge from the listings alone.</p>
        <h4>Same project or not?</h4><ul><li><b>Same project</b> (<kbd>S</kbd>): one operation seen at two points in time. Amounts, stage, lender and wording can change; titles get shortened or reworded.</li>
        <li><b>Different projects</b> (<kbd>D</kbd>): e.g. a follow-on phase (“Second”, “II”, “APL 2”), a different state or city, a different sub-sector, or a different country.</li>
        <li><b>Can't tell</b> (<kbd>U</kbd>): too garbled or too generic (“Education project to be determined”).</li></ul>
        <p>A matching project ID (P######) is strong evidence. Without one, weigh title, agency, amount and description together. Green text marks fields that match exactly. Use the note for anything unusual.</p>`;
    },
  },
};

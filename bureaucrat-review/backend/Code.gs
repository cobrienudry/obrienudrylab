/**
 * Google Apps Script backend for the bureaucrat-review site.
 * Setup (once, ~5 minutes): see README.md, "Saving reviews centrally".
 *
 * Sheets it maintains in the bound spreadsheet:
 *   claims  item | coder | at | done          who is reviewing what (item = <task>-<case_id>); drives the shared queue
 *   saves   coder | item | at | json          latest save per coder x case, which the app reloads from
 *   positions <codebook version>              one row per coder x position (the analysis file)
 *   persons <codebook version>                one row per coder x case (identity verdict, counts, note)
 *
 * Every request must carry the project key (Script property KEY), which RAs get in their link (#k=...).
 */

function doGet(e) { return handle_(e.parameter || {}); }
function doPost(e) {
  var p; try { p = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'Bad request' }); }
  return handle_(p);
}

function handle_(p) {
  var key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key || p.k !== key) return out_({ ok: false, error: 'Wrong or missing project key' });
  try {
    if (p.action === 'state') return out_({ ok: true, claims: readClaims_() });
    if (p.action === 'mine') return out_({ ok: true, codes: readMine_(clean_(p.coder)) });
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (p.action === 'claim') { upsertClaim_(clean_(p.item), clean_(p.coder), false); return out_({ ok: true }); }
      if (p.action === 'save') { save_(clean_(p.coder), clean_(p.item), p.body, p.tables); return out_({ ok: true }); }
    } finally { lock.releaseLock(); }
    return out_({ ok: false, error: 'Unknown action' });
  } catch (err) { return out_({ ok: false, error: String(err.message || err) }); }
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(s) { s = String(s || ''); if (!/^[A-Za-z0-9_-]{1,40}$/.test(s)) throw new Error('Bad id'); return s; }

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}
function claimsSheet_() { return sheet_('claims', ['item', 'coder', 'at', 'done']); }
function savesSheet_() { return sheet_('saves', ['coder', 'item', 'at', 'json']); }

function readClaims_() {
  var v = claimsSheet_().getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) out.push({ item: String(v[i][0]), coder: String(v[i][1]), at: Number(v[i][2]), done: v[i][3] === true || v[i][3] === 'TRUE' });
  return out;
}
function upsertClaim_(item, coder, done) {
  var sh = claimsSheet_(), v = sh.getDataRange().getValues(), now = Date.now();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === item && String(v[i][1]) === coder) {
    if (v[i][3] === true && !done) return;                // never un-finish a claim
    sh.getRange(i + 1, 3, 1, 2).setValues([[now, done]]); return;
  }
  sh.appendRow([item, coder, now, done]);
}
function readMine_(coder) {
  var v = savesSheet_().getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === coder) out.push(JSON.parse(v[i][3]));
  return out;
}

// tables: [{ name: 'positions'|'persons', cols: [...], rows: [[...], ...] }]
// The first three columns of every table are coder | task | case_id; a save replaces this coder's rows for this case.
function save_(coder, item, body, tables) {
  if (!body || body.item !== item || !Array.isArray(tables)) throw new Error('Bad save');
  var json = JSON.stringify(body);
  if (json.length > 45000) throw new Error('Save too large');
  var sh = savesSheet_(), v = sh.getDataRange().getValues(), at = Date.now(), found = false;
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === coder && String(v[i][1]) === item) { sh.getRange(i + 1, 3, 1, 2).setValues([[at, json]]); found = true; break; }
  if (!found) sh.appendRow([coder, item, at, json]);
  tables.forEach(function (t) {
    if (['positions', 'persons', 'fields', 'entries', 'page_rows', 'pages', 'links'].indexOf(t.name) < 0 || !Array.isArray(t.rows) || !Array.isArray(t.cols)) throw new Error('Bad table');
    var tab = sheet_((t.name + ' ' + String(body.cbv || 'v')).slice(0, 90), t.cols);
    var a = tab.getDataRange().getValues();
    for (var r = a.length - 1; r >= 1; r--) if (String(a[r][0]) === coder && String(a[r][1]) === String(body.task) && String(a[r][2]) === String(body.case_id)) tab.deleteRow(r + 1);
    if (t.rows.length) tab.getRange(tab.getLastRow() + 1, 1, t.rows.length, t.cols.length).setValues(t.rows.map(function (row) {
      return t.cols.map(function (_, j) { var x = row[j]; return x === null || x === undefined ? '' : x; });
    }));
  });
  upsertClaim_(item, coder, true);
}

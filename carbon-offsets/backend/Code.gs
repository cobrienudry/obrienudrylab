/**
 * @OnlyCurrentDoc
 *
 * Google Apps Script backend for the carbon-offsets report collector.
 * Bind it to the report spreadsheet (Extensions → Apps Script) and deploy as a web app
 * (Execute as: Me, Who has access: Anyone). Setup steps: carbon-offsets/README.md.
 *
 * Permissions are kept narrow (see appsscript.json):
 *   spreadsheets.currentonly  only the spreadsheet this script is attached to
 *   drive.file                only Drive files and folders this script created
 *   script.external_request   to download report PDFs and call the Drive API
 * Because of drive.file the script can't write into a folder you made. Run setup() once from the
 * editor: it creates "Carbon offsets PDFs" in your My Drive. Drag that folder into the shared folder;
 * the script keeps access after the move.
 *
 * Script properties:
 *   KEY        required. Students get it in their link (…/carbon-offsets/#k=KEY).
 *   FOLDER_ID  set by setup(): the script-created PDF folder.
 *   SHEET_GID  optional. Tab holding the report list (default below).
 *
 * The report tab keeps its own columns (rank, company, report_year, report_title, url,
 * source_page_url, notes, coder). The script adds these columns at the right on first use:
 *   row_id | doc_type | status | drive_file | saved_by | saved_at
 * status: saved · dead_link · no_report · wrong_doc · (blank = still to do)
 * It also keeps a `companies` tab: company | rank | coder | claimed_at | done_at.
 */

var FOLDER_NAME = 'Carbon offsets PDFs';
var DEFAULT_SHEET_GID = 1358907780;
var BASE_COLS = ['rank', 'company', 'report_year', 'report_title', 'url', 'source_page_url', 'notes', 'coder'];
var ADD_COLS = ['row_id', 'doc_type', 'status', 'drive_file', 'saved_by', 'saved_at'];
var TYPES = { SR: 'Sustainability', AR: 'Annual report', '10K': '10-K', CDP: 'CDP response' };
var MARKS = ['dead_link', 'no_report', 'wrong_doc'];

function doGet(e) { return handle_(e.parameter || {}); }
function doPost(e) {
  var p; try { p = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'Bad request' }); }
  return handle_(p);
}

function handle_(p) {
  var key = String(PropertiesService.getScriptProperties().getProperty('KEY') || '').trim();
  if (!key || String(p.k || '').trim() !== key) return out_({ ok: false, error: 'Wrong or missing project key' });
  try {
    if (p.action === 'companies') return out_({ ok: true, companies: companies_() });
    if (p.action === 'company') return out_({ ok: true, rows: companyRows_(str_(p.company, 120)), claim: claimOf_(str_(p.company, 120)) });
    var coder = name_(p.coder);
    if (p.action === 'fetch') return out_({ ok: true, row: fetchToDrive_(Number(p.row_id), coder) });
    if (p.action === 'upload') return out_({ ok: true, row: uploadToDrive_(Number(p.row_id), coder, str_(p.filename, 200), String(p.data || '')) });
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (p.action === 'claim') return out_({ ok: true, claim: claim_(str_(p.company, 120), coder) });
      if (p.action === 'release') { release_(str_(p.company, 120), coder); return out_({ ok: true }); }
      if (p.action === 'finish') { finish_(str_(p.company, 120), coder); return out_({ ok: true }); }
      if (p.action === 'add') return out_({ ok: true, row: add_(p, coder) });
      if (p.action === 'mark') return out_({ ok: true, row: mark_(Number(p.row_id), str_(p.status, 20), str_(p.note, 1000), coder) });
    } finally { lock.releaseLock(); }
    return out_({ ok: false, error: 'Unknown action' });
  } catch (err) { return out_({ ok: false, error: String(err.message || err) }); }
}

/* ---------- helpers ---------- */

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function str_(s, max) { return String(s == null ? '' : s).trim().slice(0, max); }
function name_(s) { s = str_(s, 60); if (!s) throw new Error('Enter your name first'); return s; }
function pad3_(n) { n = String(parseInt(n, 10) || 0); return ('000' + n).slice(-3); }
function slug_(s) { return String(s).replace(/&/g, 'and').replace(/[^A-Za-z0-9]+/g, ''); }
function now_() { return new Date().toISOString().replace('T', ' ').slice(0, 16); }
function folderUrl_() { var id = PropertiesService.getScriptProperties().getProperty('FOLDER_ID'); return id ? 'https://drive.google.com/drive/folders/' + id : ''; }

/* ---------- Drive (REST API v3 with the drive.file scope) ---------- */

var FOLDER_MIME = 'application/vnd.google-apps.folder';

function drive_(method, url, opts) {
  opts = opts || {};
  var res = UrlFetchApp.fetch(url, {
    method: method, muteHttpExceptions: true,
    headers: Object.assign({ Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, opts.headers || {}),
    contentType: opts.contentType, payload: opts.payload
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Drive error ' + code + ': ' + res.getContentText().slice(0, 200));
  return res;
}
function q_(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function findInFolder_(parent, name, mime) {
  var q = "name = '" + q_(name) + "' and '" + parent + "' in parents and trashed = false" + (mime ? " and mimeType = '" + mime + "'" : '');
  var url = 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id)&q=' + encodeURIComponent(q);
  var files = JSON.parse(drive_('get', url).getContentText()).files || [];
  return files.length ? files[0].id : '';
}
function createFolder_(name, parent) {
  var meta = { name: name, mimeType: FOLDER_MIME };
  if (parent) meta.parents = [parent];
  var res = drive_('post', 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id',
    { contentType: 'application/json', payload: JSON.stringify(meta) });
  return JSON.parse(res.getContentText()).id;
}
// Root PDF folder: created by this script so drive.file covers it.
function rootFolder_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('FOLDER_ID');
  if (id) return id;
  id = createFolder_(FOLDER_NAME, '');
  props.setProperty('FOLDER_ID', id);
  return id;
}
function uploadPdf_(parent, name, bytes) {
  var start = drive_('post', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
    contentType: 'application/json; charset=UTF-8', headers: { 'X-Upload-Content-Type': 'application/pdf' },
    payload: JSON.stringify({ name: name, parents: [parent], mimeType: 'application/pdf' })
  });
  var h = start.getAllHeaders(), loc = h.Location || h.location;
  if (!loc) throw new Error('Drive did not start the upload');
  var res = drive_('put', loc, { contentType: 'application/pdf', payload: bytes });
  return 'https://drive.google.com/file/d/' + JSON.parse(res.getContentText()).id + '/view';
}

/** Run once from the editor (select setup, click Run). Logs the folder link to move into the shared folder. */
function setup() {
  var url = 'https://drive.google.com/drive/folders/' + rootFolder_();
  reportSheet_();
  Logger.log('PDF folder: ' + url + '\nDrag it into the shared carbon-offsets folder. The script keeps access after the move.');
  return url;
}

function reportSheet_() {
  var gid = Number(PropertiesService.getScriptProperties().getProperty('SHEET_GID') || DEFAULT_SHEET_GID);
  var sh = SpreadsheetApp.getActive().getSheets().filter(function (s) { return s.getSheetId() === gid; })[0];
  if (!sh) throw new Error('Report tab not found (SHEET_GID ' + gid + ')');
  return sh;
}

// Reads the report tab. Adds our columns at the far right if missing and gives every row a stable row_id.
function table_() {
  var sh = reportSheet_();
  var lastCol = sh.getLastColumn();
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var col = {};
  header.forEach(function (h, i) { if (h && !(h in col)) col[h] = i; });
  BASE_COLS.forEach(function (c) { if (!(c in col)) throw new Error('Report tab is missing the "' + c + '" column'); });
  var missing = ADD_COLS.filter(function (c) { return !(c in col); });
  if (missing.length) {
    sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    missing.forEach(function (c, i) { col[c] = lastCol + i; });
    lastCol += missing.length;
  }
  var n = sh.getLastRow() - 1;
  var values = n > 0 ? sh.getRange(2, 1, n, lastCol).getValues() : [];
  var maxId = 0, needs = [];
  values.forEach(function (r, i) { var id = Number(r[col.row_id]) || 0; if (id > maxId) maxId = id; if (!id) needs.push(i); });
  if (needs.length) {
    var ids = values.map(function (r) { return [r[col.row_id]]; });
    needs.forEach(function (i) { maxId += 1; ids[i] = [maxId]; values[i][col.row_id] = maxId; });
    sh.getRange(2, col.row_id + 1, ids.length, 1).setValues(ids);
  }
  return { sh: sh, col: col, values: values, width: lastCol, maxId: maxId };
}

function docType_(r, col) {
  var t = String(r[col.doc_type] || '').trim();
  if (TYPES[t]) return t;
  var title = String(r[col.report_title] || '');
  if (/^annual report/i.test(title)) return 'AR';
  if (/^10-?k\b/i.test(title)) return '10K';
  if (/^cdp\b/i.test(title)) return 'CDP';
  return 'SR';
}

function rowObj_(r, col) {
  return {
    row_id: Number(r[col.row_id]), rank: r[col.rank], company: String(r[col.company]),
    year: String(r[col.report_year] || ''), title: String(r[col.report_title] || ''),
    url: String(r[col.url] || ''), source: String(r[col.source_page_url] || ''),
    notes: String(r[col.notes] || ''), type: docType_(r, col),
    status: String(r[col.status] || ''), drive_file: String(r[col.drive_file] || ''),
    saved_by: String(r[col.saved_by] || ''), saved_at: String(r[col.saved_at] || '')
  };
}

function findRow_(t, id) {
  for (var i = 0; i < t.values.length; i++) if (Number(t.values[i][t.col.row_id]) === id) return i;
  throw new Error('Row ' + id + ' not found; reload the company');
}

function setCells_(t, i, obj) {
  Object.keys(obj).forEach(function (c) {
    t.values[i][t.col[c]] = obj[c];
    t.sh.getRange(i + 2, t.col[c] + 1).setValue(obj[c]);
  });
  return rowObj_(t.values[i], t.col);
}

/* ---------- companies tab (claims) ---------- */

function claimsSheet_() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName('companies');
  if (!sh) { sh = ss.insertSheet('companies'); sh.appendRow(['company', 'rank', 'coder', 'claimed_at', 'done_at']); sh.setFrozenRows(1); }
  return sh;
}
function claims_() {
  var v = claimsSheet_().getDataRange().getValues(), out = {};
  for (var i = 1; i < v.length; i++) if (v[i][0]) out[String(v[i][0])] = { row: i + 1, coder: String(v[i][2] || ''), claimed_at: String(v[i][3] || ''), done_at: String(v[i][4] || '') };
  return out;
}
function claimOf_(company) { return claims_()[company] || null; }

function claim_(company, coder) {
  var c = claimOf_(company), sh = claimsSheet_();
  if (c && c.coder && c.coder.toLowerCase() !== coder.toLowerCase()) throw new Error(company + ' is already claimed by ' + c.coder);
  var t = table_(), rank = '';
  for (var i = 0; i < t.values.length; i++) if (String(t.values[i][t.col.company]).trim() === company) { rank = t.values[i][t.col.rank]; break; }
  if (c) sh.getRange(c.row, 3, 1, 2).setValues([[coder, now_()]]);
  else sh.appendRow([company, rank, coder, now_(), '']);
  return claimOf_(company);
}
function release_(company, coder) {
  var c = claimOf_(company);
  if (!c || c.coder.toLowerCase() !== coder.toLowerCase()) throw new Error('You have not claimed ' + company);
  claimsSheet_().getRange(c.row, 3, 1, 3).setValues([['', '', '']]);
}
function finish_(company, coder) {
  var c = claimOf_(company);
  if (!c || c.coder.toLowerCase() !== coder.toLowerCase()) throw new Error('Claim ' + company + ' first');
  claimsSheet_().getRange(c.row, 5).setValue(now_());
}

/* ---------- reads ---------- */

function companies_() {
  var t = table_(), claims = claims_(), by = {}, order = [];
  t.values.forEach(function (r) {
    var name = String(r[t.col.company] || '').trim(); if (!name) return;
    if (!by[name]) { by[name] = { company: name, rank: Number(r[t.col.rank]) || 0, rows: 0, done_rows: 0 }; order.push(name); }
    var o = by[name];
    if (!r[t.col.url] && !r[t.col.report_year] && !r[t.col.status]) return; // note-only rows
    o.rows += 1;
    if (r[t.col.status]) o.done_rows += 1;
  });
  return order.map(function (n) {
    var o = by[n], c = claims[n];
    o.coder = c ? c.coder : ''; o.done = !!(c && c.done_at);
    return o;
  }).sort(function (a, b) { return a.rank - b.rank; });
}

function companyRows_(company) {
  var t = table_();
  return t.values.filter(function (r) { return String(r[t.col.company]).trim() === company; })
    .map(function (r) { return rowObj_(r, t.col); });
}

/* ---------- writes ---------- */

function add_(p, coder) {
  var company = str_(p.company, 120), type = str_(p.type, 5), year = str_(p.year, 4);
  if (!TYPES[type]) throw new Error('Pick a document type');
  if (!/^(19|20)\d\d$/.test(year)) throw new Error('Pick a year');
  var t = table_(), last = -1, rank = '';
  t.values.forEach(function (r, i) { if (String(r[t.col.company]).trim() === company) { last = i; rank = r[t.col.rank]; } });
  if (last < 0) throw new Error('Unknown company');
  var title = str_(p.title, 200) || (year + ' ' + (type === 'SR' ? 'Sustainability Report' : TYPES[type]));
  if (type !== 'SR' && title.toLowerCase().indexOf(TYPES[type].toLowerCase()) !== 0) title = TYPES[type] + ': ' + title;
  var row = [];
  for (var j = 0; j < t.width; j++) row.push('');
  row[t.col.rank] = rank; row[t.col.company] = company; row[t.col.report_year] = year; row[t.col.report_title] = title;
  row[t.col.url] = str_(p.url, 1000); row[t.col.source_page_url] = str_(p.source, 1000);
  row[t.col.notes] = str_(p.notes, 1000); row[t.col.coder] = coder;
  row[t.col.row_id] = t.maxId + 1; row[t.col.doc_type] = type;
  if (p.no_report) { row[t.col.status] = 'no_report'; row[t.col.saved_by] = coder; row[t.col.saved_at] = now_(); }
  t.sh.insertRowAfter(last + 2);
  t.sh.getRange(last + 3, 1, 1, t.width).setValues([row]);
  return rowObj_(row, t.col);
}

function mark_(id, status, note, coder) {
  if (status !== '' && MARKS.indexOf(status) < 0) throw new Error('Bad status');
  var t = table_(), i = findRow_(t, id), notes = String(t.values[i][t.col.notes] || '');
  if (note) notes = (notes ? notes + ' | ' : '') + note + ' (' + coder + ')';
  return setCells_(t, i, { status: status, notes: notes, saved_by: status ? coder : '', saved_at: status ? now_() : '' });
}

function saveBlob_(id, coder, blob) {
  var t = table_(), r = rowObj_(t.values[findRow_(t, id)], t.col);
  var base = pad3_(r.rank) + '_' + slug_(r.company), lock = LockService.getScriptLock(), folder;
  lock.waitLock(30000);
  try { folder = findInFolder_(rootFolder_(), base, FOLDER_MIME) || createFolder_(base, rootFolder_()); }
  finally { lock.releaseLock(); }
  // one student per company, so a second file with the same year and type is rare; it gets _2, _3…
  var stem = base + '_' + (r.year || 'undated') + '_' + r.type, name = stem + '.pdf', k = 2;
  while (findInFolder_(folder, name)) { name = stem + '_' + k + '.pdf'; k += 1; }
  var link = uploadPdf_(folder, name, blob.getBytes());
  lock.waitLock(30000);
  try {
    t = table_();
    return setCells_(t, findRow_(t, id), { status: 'saved', drive_file: link, doc_type: r.type, saved_by: coder, saved_at: now_() });
  } finally { lock.releaseLock(); }
}

function isPdf_(bytes) { return bytes.length > 4 && bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70; } // "%PDF"

// Copies a public PDF link into Drive. Sites that refuse the request get the manual Upload route instead.
function fetchToDrive_(id, coder) {
  var t = table_(), r = rowObj_(t.values[findRow_(t, id)], t.col);
  if (!/^https?:\/\//i.test(r.url)) throw new Error('This row has no link to fetch');
  var res;
  try { res = UrlFetchApp.fetch(r.url, { muteHttpExceptions: true, followRedirects: true }); }
  catch (err) { throw new Error('Could not reach the site. Download the PDF in your browser, then use Upload.'); }
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('The site answered HTTP ' + code + '. Download the PDF in your browser, then use Upload.');
  var blob = res.getBlob();
  if (!isPdf_(blob.getBytes())) throw new Error('The link is a web page, not a PDF. Open it, find the PDF (or print the page to PDF), then use Upload.');
  return saveBlob_(id, coder, blob.setContentType('application/pdf'));
}

function uploadToDrive_(id, coder, filename, data) {
  if (!data) throw new Error('No file received');
  var bytes = Utilities.base64Decode(data);
  if (!isPdf_(bytes)) throw new Error('That file is not a PDF. Save the report as PDF first.');
  return saveBlob_(id, coder, Utilities.newBlob(bytes, 'application/pdf', filename || 'report.pdf'));
}

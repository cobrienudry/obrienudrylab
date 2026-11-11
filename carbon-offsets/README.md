# Carbon offsets: report collection and summaries

Live: https://cobrienudry.github.io/obrienudrylab/carbon-offsets/ (students need the project key in their link: `…/carbon-offsets/#k=KEY`)

**Task 1, collect reports.** Students choose a company from a dropdown (companies not yet started, plus their own), see a 2015–2025 grid of which sustainability and annual reports are saved, listed or missing, and for each report click **Save to Drive** (the backend copies the PDF from its link into the Drive folder) or **Upload PDF** (for sites that block automated downloads). They can add missing reports, mark dead links or years with no report, and mark the company finished.

**Task 2, write a summary.** A form that builds a Markdown summary of how one company's offset reporting changed. Students download it and put it in the Drive folder. No backend.

| File | What it is |
|---|---|
| `index.html` | the page (both tasks) |
| `collect.js` | the Task 1 tool. `BACKEND_URL` at the top |
| `backend/Code.gs` | Google Apps Script that reads and writes the spreadsheet and saves PDFs to Drive |
| `backend/appsscript.json` | its manifest, which limits permissions to this spreadsheet and the files the script creates |

Until `BACKEND_URL` is set, Task 1 shows the by-hand instructions instead of the tool.

## Setup (once, ~5 minutes)

1. Open the report spreadsheet, then **Extensions → Apps Script**.
2. **Project Settings** (gear) → tick **Show "appsscript.json" manifest file in editor**. Back in the editor, replace `appsscript.json` with `backend/appsscript.json` and `Code.gs` with `backend/Code.gs`. Save. (The manifest turns on the **Drive API** service; if the sidebar under **Services** doesn't list it, click **+ → Drive API → Add**. Without it `setup` fails with "Drive error 403: Google Drive API has not been used in project…")
3. **Project Settings → Script properties → Add** `KEY` = the project key. Optional: `SHEET_GID` (the tab with the report list, default `1358907780`).
4. In the editor, pick **setup** in the function menu and click **Run**. Authorize it. Google asks only for:
   - *View and manage spreadsheets that this application has been installed in* (this spreadsheet only)
   - *See, edit, create and delete only the specific Google Drive files you use with this app* (files the script made)
   - *Connect to an external service* (downloading report PDFs, calling the Drive API)

   `setup` creates a folder **Carbon offsets PDFs** in your My Drive; its link is in the execution log. **Drag that folder into the shared carbon-offsets folder** so students can see the PDFs. The script keeps access after the move.
5. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Copy the web app URL (ends in `/exec`).
6. Paste that URL into `BACKEND_URL` in `collect.js`, commit and push.
7. Send students `https://cobrienudry.github.io/obrienudrylab/carbon-offsets/#k=KEY`. The key is remembered in their browser and removed from the address bar.

After editing `Code.gs`, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## What it writes

On first use the script adds columns at the right of the report tab: `row_id` (stable id), `doc_type` (SR / AR / 10K / CDP), `status` (saved / dead_link / no_report / wrong_doc; blank = to do), `drive_file`, `saved_by`, `saved_at`. Reports students add are inserted below the company's other rows, with their name in `coder`. Notes students give when marking a row are appended to `notes`.

A `companies` tab records claims: `company, rank, coder, claimed_at, done_at`. To free a company, clear its `coder` cell; to reopen a finished one, clear `done_at`.

PDFs go to `Carbon offsets PDFs/<RANK>_<Company>/<RANK>_<Company>_<YEAR>_<TYPE>.pdf` (e.g. `001_Amazon/001_Amazon_2023_SR.pdf`); a second file for the same year and type gets `_2`.

Limits: uploads up to about 35 MB (Apps Script request limit). Bigger files go in the folder by hand. The script can't see files people put in the folder themselves (that's what the narrow Drive permission means), so for those, paste the Drive link into `drive_file` and set `status` to `saved` in the sheet.

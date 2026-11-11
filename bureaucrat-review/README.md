# Bureaucrat & MOS review: RA site

Live: https://cobrienudry.github.io/obrienudrylab/bureaucrat-review/ (RAs need the project key in their link: `…/#k=KEY`)

RAs review two kinds of coding, one case at a time.

**MOS digitization** (the World Bank *Monthly Operational Summary*, 1955–2020, from `~/claude/MOS`):

| task | cases | what RAs do |
|---|---|---|
| **Extraction check** | 300 entries (X001–X300), 50 per era | One extracted MOS listing beside its scanned page (entry boxed). Classify the row (real / two merged / fragment / garbage / not found), then judge every extracted field: correct, minor OCR typos, wrong (type the correct value), or not printed |
| **Page completeness** | 120 pages (G001–G120), 20 per era | A whole scanned page beside every row the pipeline placed on it. Mark each row real / fragment / merged / garbage / not on this page, add listings the pipeline missed, and count the listings printed |
| **Linking across issues** | 350 pairs (L001–L350) | Two listings from different issues: same project, different, or can't tell. 250 pairs the pipeline linked (stratified by `project_id_method`: pid 40, pid_backfill 60, title_cluster 60 tabular + 60 paragraph, split 30) and 100 near-misses it did not link (same country, ≤12 months apart, title Jaccard ≥ 0.5). RAs are not told which is which |

Eras: 1955–69, 1970–87, 1988–96/09 (worst scans), 1996/10–2003, 2004–13, 2014–20. Hand-coded issues are excluded (they are the authoritative transcriptions). Built by `~/claude/bureaucrats/review_site_build/build_mos_tasks.py` (seed 20261110), which finds each row on its PDF page by word overlap, boxes it with PyMuPDF and renders the page, plus the pages before and after it, to `pages/*.jpg` (130 dpi; public World Bank documents, not encrypted). RAs can step to the previous or next page (buttons above the scan, or `[` and `]`) when an entry runs across a page break; the boxes show only on the entry's own page.

**Bureaucrat careers**:

| task | cases | what RAs do |
|---|---|---|
| **LinkedIn careers** | 200 (P001–P200, `career_histories_sample200`) | Check each job parsed from a LinkedIn PDF against what the PDF printed (shown under the coded values, differences highlighted), and re-judge the identity match to the WB contact |
| **Careers of MOS contacts, random** | 350 (M001–M352, `career_histories_mos350`) | Check the MOS and web positions, fix or drop rows, search for and **add missing jobs** (source URL required), re-judge the identity match |
| **Careers of MOS contacts, targeted** | 500 (T001–T500, `career_histories_mos_top500`) | Same as the random sample |

For every career position the RA picks **✓ Correct**, **✎ Fix** (edit employer, title, sector, role level, country, dates; changed fields show the old value) or **✗ Drop** (with a reason), and can add missing positions. Each person ends with an identity verdict and, for MOS contacts, how far they searched for missing jobs.

Same workflow as `aid-withdrawal-speech`: a coder code, a shared queue, and 15% of cases double-coded for agreement (cases waiting for their second review come first).

| File | What it is |
|---|---|
| `index.html` | the app (vanilla JS, no build step) |
| `assets/codebook.js` | **tasks, sectors, role levels, identity options, drop reasons**: edit here, bump `CB_VERSION` |
| `assets/config.js` | where reviews are saved (`BACKEND_URL`) |
| `assets/countries.js` | ISO3 codes accepted in the country field |
| `assets/mos.js` | the three MOS-digitization screens |
| `data/*.bin` | the case data, **encrypted** (AES-256-GCM, key from PBKDF2 of the project key) |
| `pages/*.jpg` | scanned MOS pages for the extraction and page tasks |
| `backend/Code.gs` | Google Apps Script that saves reviews to a Google Sheet |

## The data is encrypted

The repo is public, but the case data includes LinkedIn profile text and contact details, so `data/*.bin` is encrypted with the project key. Without the key the site shows only a key prompt. The key lives in `../review_site_build/KEY.txt` in the parent project (not in this repo). To rebuild the data after the career-history datasets change:

```
python3 ~/claude/bureaucrats/review_site_build/build_review_data.py   # career tasks
python3 ~/claude/bureaucrats/review_site_build/build_mos_tasks.py     # MOS tasks (~10 min)
```

then commit and push `data/`. Bump `DATA_VERSION` in the script so saves record which version they reviewed. To change the key, edit `KEY.txt`, rebuild, push, update the Apps Script `KEY` property and send RAs the new link.

## Where reviews are saved

**Without a backend** (`BACKEND_URL: ""`, the current setting) each RA's reviews stay in their browser. They press **Download my reviews** and send you the CSVs (one per table). There is no shared queue.

**With the Google Sheet backend** (recommended) reviews save centrally, the queue is shared, and double-coding works. Setup, once:

1. Create a new Google Sheet (e.g. "Bureaucrat review"). Open **Extensions → Apps Script**.
2. Replace the editor contents with `backend/Code.gs` and save.
3. **Project Settings → Script properties → Add**: `KEY` = the project key from `KEY.txt`.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Authorize it, then copy the web app URL (ends in `/exec`).
5. Paste that URL into `BACKEND_URL` in `assets/config.js`, commit and push.
6. Send RAs `https://cobrienudry.github.io/obrienudrylab/bureaucrat-review/#k=KEY`. They open it once per computer; the key is remembered and removed from the address bar.

The sheet gets `claims` (who is reviewing what), `saves` (latest save per coder × case, which the app reloads from), and two analysis tabs per codebook version. If you change `Code.gs`, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## Output

Every analysis tab starts with `coder, task, case_id`; a re-save replaces that coder's rows for the case. Tabs are named `<table> <codebook version>`. Downloaded CSVs are `review_<table>_<coder>.csv`.

**`fields`** (extraction): one row per coder × entry × field: `issue_date, era_bin, format_era, project_id, source_pdf, page, entry_type, field, extracted, verdict` (ok / typos / fix / blank), `corrected`.
**`entries`** (extraction): one row per coder × entry: `page_match, entry_type, n_fields, n_ok, n_typos, n_fixed, n_not_printed`, note, time.
**`page_rows`** (pages): one row per coder × listed row (`panel_row` = row number in `mos_projects_1950_2020.parquet`) plus one per missing entry the RA added (`verdict = missing`).
**`pages`** (pages): one row per coder × page: counts by verdict, `n_missing`, `n_printed` (the RA's count of listings on the page).
**`links`**: one row per coder × pair: `pair_kind` (linked / near_miss), `stratum`, `pipeline_linked`, both listings' issue, project_id, country and title, `verdict`, `reasons`, `agrees_with_pipeline`.

**`positions <version>`**: one row per coder × position.
`coder, task, case_id, position_id, source_type, action` (ok / fixed / dropped / added), `drop_reason, changed_fields` (`|`-separated), then the final values of `employer, title, sector, role_level, country_iso3, start_year, start_month, end_year, end_month` (the original values for ok and dropped rows), `source_url` (for added rows and sourced fixes), `position_note, codebook_version, data_version, saved_at`. Added rows get `position_id = <case_id>_A1, _A2…`. Every other `position_id` matches `positions.csv` in the source dataset.

**`persons <version>`**: one row per coder × case.
`coder, task, case_id, name, batch, identity_orig, identity_coded, identity_changed, completeness` (MOS tasks), `n_positions_orig, n_ok, n_fixed, n_dropped, n_added, case_note, seconds_spent, double_coded, codebook_version, data_version, saved_at`.

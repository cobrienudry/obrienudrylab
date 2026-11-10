# Bureaucrat career review: RA site

Live: https://cobrienudry.github.io/obrienudrylab/bureaucrat-review/ (RAs need the project key in their link: `…/#k=KEY`)

RAs review the coded career histories of World Bank counterpart bureaucrats one person at a time. There are three tasks:

| task | cases | what RAs do |
|---|---|---|
| **LinkedIn careers** | 200 (P001–P200, `career_histories_sample200`) | Check each job parsed from a LinkedIn PDF against what the PDF printed (shown under the coded values, differences highlighted), and re-judge the identity match to the WB contact |
| **MOS random sample** | 350 (M001–M352, `career_histories_mos350`) | Check the MOS and web positions, fix or drop rows, search for and **add missing jobs** (source URL required), re-judge the identity match |
| **MOS targeted set** | 500 (T001–T500, `career_histories_mos_top500`) | Same as the random sample |

For every position the RA picks **✓ Correct**, **✎ Fix** (edit employer, title, sector, role level, country, dates; changed fields show the old value) or **✗ Drop** (with a reason: wrong person, duplicate, not a job, unsupported, other). They can add missing positions. Each case ends with an identity verdict and, in the MOS tasks, how far they searched for missing jobs. MOS cases show the raw MOS listings (as printed, agency, project, email domain) and search links (Google, LinkedIn, Wikipedia, also under the MOS spelling).

Same workflow as `aid-withdrawal-speech`: a coder code, a shared queue, and 15% of cases double-coded for agreement (cases waiting for their second review come first).

| File | What it is |
|---|---|
| `index.html` | the app (vanilla JS, no build step) |
| `assets/codebook.js` | **tasks, sectors, role levels, identity options, drop reasons**: edit here, bump `CB_VERSION` |
| `assets/config.js` | where reviews are saved (`BACKEND_URL`) |
| `assets/countries.js` | ISO3 codes accepted in the country field |
| `data/*.bin` | the case data, **encrypted** (AES-256-GCM, key from PBKDF2 of the project key) |
| `backend/Code.gs` | Google Apps Script that saves reviews to a Google Sheet |

## The data is encrypted

The repo is public, but the case data includes LinkedIn profile text and contact details, so `data/*.bin` is encrypted with the project key. Without the key the site shows only a key prompt. The key lives in `../review_site_build/KEY.txt` in the parent project (not in this repo). To rebuild the data after the career-history datasets change:

```
python3 ~/claude/bureaucrats/review_site_build/build_review_data.py
```

then commit and push `data/`. Bump `DATA_VERSION` in the script so saves record which version they reviewed. To change the key, edit `KEY.txt`, rebuild, push, update the Apps Script `KEY` property and send RAs the new link.

## Where reviews are saved

**Without a backend** (`BACKEND_URL: ""`, the current setting) each RA's reviews stay in their browser. They press **Download my reviews** and send you the two CSVs. There is no shared queue.

**With the Google Sheet backend** (recommended) reviews save centrally, the queue is shared, and double-coding works. Setup, once:

1. Create a new Google Sheet (e.g. "Bureaucrat review"). Open **Extensions → Apps Script**.
2. Replace the editor contents with `backend/Code.gs` and save.
3. **Project Settings → Script properties → Add**: `KEY` = the project key from `KEY.txt`.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Authorize it, then copy the web app URL (ends in `/exec`).
5. Paste that URL into `BACKEND_URL` in `assets/config.js`, commit and push.
6. Send RAs `https://cobrienudry.github.io/obrienudrylab/bureaucrat-review/#k=KEY`. They open it once per computer; the key is remembered and removed from the address bar.

The sheet gets `claims` (who is reviewing what), `saves` (latest save per coder × case, which the app reloads from), and two analysis tabs per codebook version. If you change `Code.gs`, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## Output

**`positions <version>`**: one row per coder × position.
`coder, task, case_id, position_id, source_type, action` (ok / fixed / dropped / added), `drop_reason, changed_fields` (`|`-separated), then the final values of `employer, title, sector, role_level, country_iso3, start_year, start_month, end_year, end_month` (the original values for ok and dropped rows), `source_url` (for added rows and sourced fixes), `position_note, codebook_version, data_version, saved_at`. Added rows get `position_id = <case_id>_A1, _A2…`. Every other `position_id` matches `positions.csv` in the source dataset.

**`persons <version>`**: one row per coder × case.
`coder, task, case_id, name, batch, identity_orig, identity_coded, identity_changed, completeness` (MOS tasks), `n_positions_orig, n_ok, n_fixed, n_dropped, n_added, case_note, seconds_spent, double_coded, codebook_version, data_version, saved_at`.

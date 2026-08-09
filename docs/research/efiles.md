# Efiles (Portland public records) as a data source for a council vote-tracker

**Correction first: the domain is `efiles.portlandoregon.gov`, not `efiles.portland.gov`** (the latter does not resolve â€” DNS `ENOTFOUND`). It is run by the City Auditor's Office ([Search City Records (Efiles)](https://www.portland.gov/auditor/archives/city-archives/search-efiles)).

**Platform identification:** The site is **WebDrawer**, the read-only public web front-end for HP TRIM / Micro Focus / OpenText **Content Manager**. Evidence: the pages load `/css/webdrawer.css`, `/scripts/webdrawer.js`, and `/TrimIcon/...` image paths (raw HTML of https://efiles.portlandoregon.gov/Search), and JSON responses contain `"TrimType":"Record"` fields. TRIM-style record numbers (`D/89922`, `25/EF/666`, `26/ED/72461`) confirm it.

---

## 1. Council-related record types

Classifications observed (all under "City Auditor - City Recorder"):

| Type | Example | Coverage |
|---|---|---|
| **Council Ordinance** | `D/89922` "192178 Pay settlement of Gabriella Raffeiâ€¦ 2026-175 ordinance" â€” https://efiles.portlandoregon.gov/Record/17900441 | June 24, 2009â€“present ([council-clerk/records](https://www.portland.gov/auditor/council-clerk/records)) |
| **Council Resolutions** | `D/89804` "37739 Authorize submission of boundary changeâ€¦ resolution" â€” https://efiles.portlandoregon.gov/Record/17747730 | Aug 16, 2006â€“present (same source) |
| **Council Minutes** (full council + committees) | "Council meeting minutes January 2, 2025" â€” https://efiles.portlandoregon.gov/record/17141131 | 1990â€“present; since Aug 2022 the agenda is folded into the minutes record (same source) |
| **Session audio** (MP3, inside minutes folders) | `25/AUD/10` "January 2, 2025 AM Audio" â€” https://efiles.portlandoregon.gov/record/17141136 | Aug 2022â€“present inside minutes; earlier audio separate (same source) |
| **Exhibits / testimony / presentations / "additional documents"** | Sub-parts of the ordinance/resolution container, e.g. `D/87458#1â€¦#6` = "exhibit a/b/c", "presentation", "testimony" (JSON of https://efiles.portlandoregon.gov/Record/15850274) | attached per document |
| **Impact statements** | Present but inconsistently â€” 143 hits for "impact statement", mostly pre-2025 or embedded in packets (e.g. "2024-06 Land Division Code Update - Ordinance and Impact Statement", Uri 16918155). Not a distinct classification. | â€” |
| Also: Portland Policy Documents, Archival Records/Photos (browse filters on https://efiles.portlandoregon.gov/Search) | | |

## 2. URL patterns and the JSON API (yes, there is one)

**Human-facing patterns** (case-insensitive):
- Record detail: `https://efiles.portlandoregon.gov/record/{uri}` (uri = internal integer, e.g. 17900441)
- File download: `https://efiles.portlandoregon.gov/record/{uri}/file/document` (returns the actual PDF/MP3; returns an HTML error page titled "Efiles - Error" if the record is a folder with no electronic file â€” download the child document's uri instead)
- HTML preview shell: `https://efiles.portlandoregon.gov/recordhtml/{uri}/` (viewer chrome only â€” document text is NOT in the HTML)
- Search results: `https://efiles.portlandoregon.gov/Record?q={query}&pagesize=N&sortBy=recCreatedOn`

**JSON API â€” confirmed working.** Append `&format=json` to any `/Record` search or `/Record/{uri}` detail URL:
- `https://efiles.portlandoregon.gov/Record?q=anyWord:37609&format=json&pagesize=25` â†’ `{"Results":[...], "TotalResults":8, "HasMoreItems":true, ...}` (verified by direct curl)
- `https://efiles.portlandoregon.gov/Record/17900441?format=json` â†’ full metadata: `RecordTitle`, `RecordNumber`, `RecordClassification`, `RecordDateCreated`, `RecordContents` (lists child exhibits/testimony), `RecordExtension`, `RecordElectronicDocumentSize`, author locations, etc.
- **Pagination:** `pagesize` + `start` (1-based offset) â€” verified `start=3` shifts the window.
- **Sorting:** `sortBy=recCreatedOn` (asc) / `recCreatedOn-` (desc, verified).

**Query language** (TRIM search grammar; clause names visible in the search form and browse-page URLs at https://efiles.portlandoregon.gov/browse/index2):
- `anyWord:37609` (title/notes words), `number:25/ED/3980`, `createdOn:1940 to 1948` (date ranges), `keyword:N`, `saved:N` (saved searches), `container:[classification:5444]`, `type:[name:archival*]`, wildcards `*`, quoted phrases, `and`/`or` combinators.
- The Advanced Search UI offers `recContent` (full-document text search) â€” it exists but is **extremely slow** (a one-word content query ran >120 s without returning in my test) and phrase+date combinations returned 0. Treat content search as unreliable; search titles instead.
- Caveat: the UI's "Council Documents" checkbox sends `filter=container:[classification:5444]`, but combining it with `q=minutes` returned 0 results in my tests â€” the filter semantics need experimentation; plain `q=` searches work fine.

## 3. Works without JavaScript â€” yes

All record pages, search-result pages, and downloads are server-rendered plain HTML/JSON; I retrieved everything above with curl and WebFetch, no browser. The only JS-dependent parts: the search **form** (JS assembles the `q` parameter â€” irrelevant if you construct GET URLs yourself) and the `recordhtml` document previewer. WebFetch read https://efiles.portlandoregon.gov/record/15850274 and https://efiles.portlandoregon.gov/help/index without trouble.

## 4. Minutes for 2025â€“2026: yes â€” minutes with per-member roll-call votes; NOT verbatim transcripts

Official minutes for the new 12-member council and its committees are filed under "City Auditor - City Recorder - Council Minutes":

- **Full council:** "Council meeting minutes January 2, 2025" folder https://efiles.portlandoregon.gov/record/17141131 (`25/EF/666`), containing the minutes PDF `25/ED/3980` at https://efiles.portlandoregon.gov/record/17143785/file/document and MP3 audio `25/AUD/10` (Uri 17141136). Also "Council meeting minutes January 15-16, 2025" (Uri 17141135).
- **Committees (2026 examples):** Public Works Committee June 23, 2026 (Uri 17930495, `26/EF/8438`); Community and Public Safety Committee June 16, 2026 (Uri 17930437); Housing and Permitting Committee June 16, 2026 â€” DRAFT (Uri 17975174); City Life Committee June 23, 2026 â€” DRAFT (Uri 17922075). Some recent items remain marked "(DRAFT)".

**Content format** (verified by downloading and extracting the Jan 2, 2025 PDF): action minutes, not verbatim transcripts. They include attendance, motions with mover/seconder, **full roll-call votes naming every member** â€” e.g. "(Aye (12): Avalos, Dunphy, Smith, Kanai, Pirtle-Guiney, Ryan, Koyama Lane, Morillo, Novick, Clark, Green, Zimmerman)" â€” council actions per item ("Passed to second reading as amended"), ordinance/document numbers, and an appended **speaker list** (name + title/testimony role). There is **no attributed speech text**; for who-said-what you'd need the MP3 audio (filed) or the meeting video (not in efiles; the minutes reference the City's YouTube channel and Open Signal as broadcast venues).

## 5. Cross-linking with portland.gov agenda items

The join keys, verified in both directions:

- **efiles â†’ portland.gov:** efiles titles embed both the **ordinance/resolution number** and the portland.gov **document number** (`YYYY-NNN`): "â€¦Council Ordinance - **192178** Pay settlement of Gabriella Raffeiâ€¦ **2026-175** ordinance" (JSON of https://efiles.portlandoregon.gov/Record/17900441).
- **portland.gov â†’ efiles:** each council document page carries an explicit efiles link. https://www.portland.gov/council/documents/ordinance/settlement-gabriella-raffeis-bodily-injury-lawsuit shows Ordinance 192178, Document number 2026-179, introducer (Mayor Keith Wilson), meeting date, **individual councilmember votes** (11 aye, Pirtle-Guiney absent), and links to `https://efiles.portlandoregon.gov/record/17900441` labeled "Ordinance, supplemental documents, and testimony" (verified in raw HTML).
- **Warning:** in this very example the two sides disagree on the document number (efiles title says `2026-175`, portland.gov says `2026-179`) â€” clerk-entered titles have typos. Use the **ordinance/resolution number** as the primary join key; treat the `YYYY-NNN` in efiles titles as secondary.
- Minutes PDFs themselves list, per agenda item: "Ordinance number: 192021 Document number: 2025-001 Introduced by: â€¦ Council action: â€¦" â€” a third linkable surface.

## Practical takeaways for the vote-tracker

- The `format=json` WebDrawer API + `record/{uri}/file/document` gives you a fully scriptable, no-JS pipeline: search by `anyWord:{ordinance#}`, walk `RecordContents` for exhibits/testimony, download PDFs.
- **Votes are easier elsewhere:** portland.gov itself publishes per-member votes on each council document page and a voting-history section at https://www.portland.gov/council/votes (July 1, 2021â€“present, per https://www.portland.gov/auditor/council-clerk/records). Use efiles for canonical documents, exhibits, testimony, minutes PDFs, and audio; use portland.gov for structured vote/agenda data.
- No verbatim transcripts exist in efiles; roll-call detail is in minutes PDFs (parseable â€” the pattern `(Aye (N): name, nameâ€¦)` is consistent) and speech would require the filed MP3s or YouTube/Open Signal video.

Sources: https://efiles.portlandoregon.gov/Search Â· https://efiles.portlandoregon.gov/help/index Â· https://efiles.portlandoregon.gov/browse/index2 Â· https://efiles.portlandoregon.gov/Record/17900441?format=json Â· https://efiles.portlandoregon.gov/record/17141131 Â· https://efiles.portlandoregon.gov/record/17143785/file/document Â· https://www.portland.gov/auditor/council-clerk/records Â· https://www.portland.gov/auditor/archives/city-archives/search-efiles Â· https://www.portland.gov/council/documents/ordinance/settlement-gabriella-raffeis-bodily-injury-lawsuit

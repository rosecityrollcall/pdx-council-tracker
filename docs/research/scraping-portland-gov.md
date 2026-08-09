# Portland City Council Vote Data — Scraping Research (portland.gov)

## 1. URL patterns

**Weekly agendas:** `https://www.portland.gov/council/agenda/{YYYY}/{M}/{D}` (non-zero-padded month/day; a two-day Wed/Thu session lives at the Wednesday date). Real examples:
- https://www.portland.gov/council/agenda/2025/1/15 (Jan 15–16, 2025 — first new-council business agenda)
- https://www.portland.gov/council/agenda/2026/8/5 (Aug 5–6, 2026)
- https://www.portland.gov/council/agenda/2024/12/18 (commission era — same pattern)

**Archive/index:** `https://www.portland.gov/council/agenda/all?committee=950&page={0..12}` — 244 council agendas, 20/page, back to July 2021. Committee agendas have their own listing pages, e.g. `https://www.portland.gov/council/agenda/public-works-committee`.

**Individual agenda-item (council document) pages:** `https://www.portland.gov/council/documents/{type}[/{status}]/{identifier}` where type ∈ ordinance/resolution/report/proclamation/public-communication and identifier is either the ordinance/resolution number, the `YYYY-NNN` doc number, or an arbitrary slug. **Slugs are not constructible — harvest hrefs from agenda or votes pages.** Examples:
- https://www.portland.gov/council/documents/ordinance/passed/192020 (doc 2025-007, 10–2 vote)
- https://www.portland.gov/council/documents/report/accepted/2026-224
- https://www.portland.gov/council/documents/resolution/moda-term-sheet-0 (slug variant)

## 2. Per-councilor votes on item pages — YES

Document pages show final votes by name, plus every motion/amendment vote by name. Actual markup (from ordinance 192020):

```html
<span class="visually-hidden">Votes</span>
<ul class="list-unstyled mb-0"><li><strong>Aye (10): </strong>
<ul class="list-inline-comma"><li>Avalos</li><li>Dunphy</li>...</ul></li>
<li><strong>Nay (2): </strong>
<ul class="list-inline-comma"><li>Ryan</li><li>Novick</li></ul></li></ul>
```

Motion/amendment votes appear as inline prose on the same page: `Aye (11): Avalos, … / Nay (1): Ryan`, with mover/seconder ("Moved by Smith, seconded by Ryan").

## 3. Structured data — the big find is `/council/votes`

- **`https://www.portland.gov/council/votes`** — a Drupal view that is a flat table of **15,569 individual vote records (Jan 6, 2021 → present)**, one row per (document, member, vote). Server-rendered — works without JavaScript. Columns: Doc number | Council document (link) | Voting member | Vote (Yea/Nay/Absent/Abstain), grouped under `<time datetime="YYYY-MM-DD">` headings. GET filters: `voted`, `council_document` (text search), `member`, `page` (24 rows/page, 649 pages). **Caveat: final document votes only — amendment, first-reading, and committee roll calls exist only on document/agenda pages.**
- **JSON:API disabled** (404); no REST export; no RSS; no usable sitemap.
- **robots.txt: Crawl-delay: 2** — honor it.
- Old "PDX Council Connect" API (portlandoregon.gov) is the defunct commission-era stack.

## 4. Data depth and pre-2025 format

- Agenda archive back to July 2021; votes table starts Jan 6, 2021. Commission-era pages use the same format with 5 voters.
- `member=Morillo` → **319 documents with recorded votes** since Jan 2025. `member=Wilson` → tie-break votes only.
- Pre-July-2021 records live in Efiles (efiles.portlandoregon.gov — minutes 1990+, agendas 1985+).

## 5. Recommended scraping approach

1. **Primary entry: `/council/votes`** paginated (or per-member filters). ~160 pages for the new council at 2s delay.
2. **Second pass: document pages** harvested from votes-table hrefs (~320 unique docs Jan 2025–Aug 2026). Parse the `visually-hidden">Votes` block for final votes and the motion prose for amendment roll calls.
3. **Third pass (context): weekly agenda pages** for ordering, time-certain flags, and unvoted items.
4. Use doc number (`YYYY-NNN`) as primary key; store the URL slug too. One doc can appear on multiple agendas (continuances).
5. For incremental updates, re-fetch page 0 of `/council/votes` plus the current week's agenda. Normalize Yea/Aye vocabulary.

# PDX Council Tracker

A vote-tracking site for the Portland, Oregon City Council (the 12-member council seated
January 2025). It scrapes the public record from portland.gov, links every vote to primary
sources (agenda item pages, eFiles documents, meeting video), and layers curated context on
top — what was said (or conspicuously not said) on the dais, amendment fights, and how each
councilor's voting record compares to their public messaging.

**Design principle: let the record speak.** Every claim on the site links to a primary
source. The vote data is scraped verbatim from the City Clerk's published dispositions;
editorial context lives in clearly-marked annotation files, separate from the data.

## Architecture

```
portland.gov agenda + document pages          eGovPDX video / transcripts
        │  (scraped on a schedule)                    │  (curated excerpts)
        ▼                                             ▼
  scraper/scrape.py  ──────────────►  data/items.json, data/meetings.json
                                      data/councilors.json (hand-maintained)
                                      data/annotations/*.json (hand-curated context)
                                              │
                                              ▼
                                  scraper/build_site_data.py
                                              │
                                              ▼
                                     site/js/data.js  (inlined data)
                                     site/index.html  (static, no backend)
```

- **Scraper** (Python) runs in GitHub Actions on a weekly schedule — no local Python needed.
  It crawls `portland.gov/council/agenda/YYYY/M/D` pages and the linked
  `portland.gov/council/documents/...` item pages, which publish per-councilor vote
  breakdowns ("Aye (5): ...; Nay (7): ...").
- **Site** is fully static (plain HTML/CSS/JS, data inlined as `data.js`), so it works on
  any static host: GitHub Pages (recommended — free, auto-deploys from Actions), or
  Namecheap shared hosting via cPanel upload.
- **Annotations** are hand-written JSON files keyed by item ID — this is where transcript
  excerpts, "who said nothing," and messaging-vs-record commentary live.

## Data sources

| Source | What it provides |
|---|---|
| `portland.gov/council/votes` | **the backbone**: flat table of every final vote since Jan 2021 (15,569+ rows, one per document+member), filterable by member/vote/document; server-rendered, no API key |
| `portland.gov/council/documents/{type}/{slug}` | full item detail: sponsor, summary, per-councilor final votes, and amendment/motion roll calls (which exist *only* here, as prose) |
| `portland.gov/council/agenda/YYYY/M/D` | weekly agendas: item ordering, dispositions, continuances |
| `portland.gov/council/documents` | 12-day lookahead of scheduled legislation (updated Fridays 9am) — feeds an "upcoming votes" view |
| `efiles.portlandoregon.gov` | documents of record + official minutes with caption-derived transcripts, speaker lists, and MP3 audio; unauthenticated JSON search API (`Accept: application/json`) |
| eGov PDX YouTube (`@egovpdx8714`, "Portland City Council Sessions" playlist) | meeting video with human CC1 broadcast captions; fetch captions via yt-dlp from a residential IP (cloud IPs are blocked) |

Detailed source research (URL grammars, verified selectors, pitfalls) lives in
[docs/research/](docs/research/). Scraping honors portland.gov's `Crawl-delay: 2`.

**Known limits:** `/council/votes` records only *final* votes — amendment, first-reading,
and committee roll calls come from document/agenda page parsing. Committee votes and the
Feb–Mar 2026 committee restructure are not yet in scope. Official minutes lag by months,
so the freshest transcript source is YouTube captions.

## Local development

The site is static — open `site/index.html` in a browser. After editing anything in
`data/`, regenerate `site/js/data.js` (done automatically in CI; locally requires Python:
`python scraper/build_site_data.py`).

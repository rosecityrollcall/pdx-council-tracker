# Data schema

All data lives in JSON files in this directory. The scraper owns `items.json` and
`meetings.json`; humans own `councilors.json` and `annotations/`.

## councilors.json (hand-maintained)

```json
[
  {
    "slug": "zimmerman",            // unique key used in vote arrays
    "name": "Eric Zimmerman",
    "district": 4,                   // 1-4, or 0 for the mayor
    "role": "Councilor",            // Councilor | Mayor | Council President
    "since": "2025-01-01",
    "links": { "official": "https://www.portland.gov/council/districts/4/zimmerman" },
    "endorsements": [ { "org": "...", "year": 2024, "source": "url" } ]
  }
]
```

Vote arrays elsewhere reference councilors by **last-name slug** (`koyama-lane`,
`pirtle-guiney` are two-word slugs). The scraper normalizes the clerk's name strings
("Koyama Lane") to slugs via the `name_variants` field if present.

## items.json (scraper-owned)

One record per council document (resolution/ordinance/report/proclamation), keyed by the
clerk's document number. An item can appear across multiple meetings (first reading,
continuations, second reading) — those are `actions`.

```json
[
  {
    "id": "2026-280",
    "type": "resolution",
    "title": "Authorize a non-binding term sheet with Rip City Management LLC ...",
    "short_title": "Moda Center renovation term sheet",   // optional, hand-editable
    "sponsors": ["Mayor Keith Wilson"],
    "url": "https://www.portland.gov/council/documents/resolution/moda-term-sheet-0",
    "summary": "...",
    "status": "pending",             // pending | passed | failed | withdrawn | referred
    "actions": [
      {
        "date": "2026-08-06",
        "disposition": "Continued to August 12, 2026 at 2:00 pm",
        "votes": [
          {
            "motion": "Green-Avalos 1: Motion to amend Exhibit A ...",
            "kind": "amendment",     // amendment | passage | procedural
            "result": "failed",
            "ayes": ["koyama-lane", "morillo", "green", "avalos", "kanal"],
            "nays": ["novick", "clark", "zimmerman", "smith", "pirtle-guiney", "ryan", "dunphy"],
            "absent": []
          }
        ]
      }
    ]
  }
]
```

## meetings.json (scraper-owned)

```json
[
  {
    "date": "2026-08-06",
    "agenda_url": "https://www.portland.gov/council/agenda/2026/8/6",
    "video_url": "https://www.youtube.com/...",   // filled when known
    "item_ids": ["2026-280", "2026-242"]
  }
]
```

## annotations/{item-id}.json (hand-curated)

Editorial context, clearly separated from scraped data. Rendered in a visually distinct
"Context" panel on the item page, always alongside its sources.

```json
{
  "item_id": "2026-280",
  "headline": "Eleven amendments, one silent bloc",
  "body": "Markdown. What happened beyond the vote tally: who spoke, who didn't, what the amendments would have done, how this squares with campaign messaging.",
  "quotes": [
    { "speaker": "kanal", "text": "...", "t": "1:23:45",
      "source": "https://www.youtube.com/watch?v=...&t=5025" }
  ],
  "sources": [ { "label": "OPB coverage", "url": "..." } ]
}
```

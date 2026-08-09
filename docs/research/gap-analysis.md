# Gap Analysis: Portland Council Vote Tracker â€” Blocking Issues & Closed Gaps

## A. Gaps I closed this session (with answers)

1. **The `/council/votes` view omits first-reading roll calls, not just amendment votes.** Test: doc 2025-001 (Ord. 192021) had a Jan 2, 2025 first-reading roll call per the minutes, but https://www.portland.gov/council/votes?council_document=2025-001 shows only 12 rows, all dated Jan 15, 2025 (the final vote). The votes view is strictly one final-vote event per document. First-reading and amendment roll calls exist only in document-page prose and minutes PDFs. **Data-model consequence: you need a `vote_events` table keyed by (document, motion), not by document.**

2. **Committee roll calls are entirely absent from `/council/votes`.** Committee agenda pages DO publish per-member roll calls (e.g. Public Works 6/23/26, doc 2026-213: "Aye (5): Kanal, Koyama Lane, Green, Smith, Clark" â€” https://www.portland.gov/council/agenda/public-works-committee/2026/6/23), but https://www.portland.gov/council/votes?council_document=2026-213 returns **zero results**. If committee votes are in scope, the scraper must parse the five committee agenda listings â€” none of the six reports scoped this pass concretely.

3. **Mayor Wilson's tie-break votes DO appear in `/council/votes`.** https://www.portland.gov/council/votes?member=Wilson â†’ "Displaying 1 - 1 of 1": July 22, 2026, doc 2026-222 (PCEF budget amendment), Nay. His office page's voting-record subpage is **https://www.portland.gov/mayor/keith-wilson/votes** (link text "More voting records" on https://www.portland.gov/mayor) â€” likely the same data filtered, not a separate source.

4. **Name normalization requirement confirmed.** The votes view renders **full names** ("Angelita Morillo", per https://www.portland.gov/council/votes?council_document=2025-007); document pages render **last names only** ("Morillo"); minutes PDFs contain **typos** ("Kanai" for Kanal, per the Jan 2, 2025 minutes quoted in the efiles report). Build a canonical-name table keyed on last name with alias handling ("Koyama Lane" is a two-word surname; "Pirtle-Guiney" hyphenated).

5. **Working CSS selectors for `/council/votes`** (from pfarnach's scraper, https://raw.githubusercontent.com/pfarnach/pdx-city-council-vote-scraper/main/src/scrape.ts): rows `.view-council-votes tbody tr`; columns `.views-field-field-document-number`, `.views-field-field-name`, `.views-field-field-voted-as-follows`; paginate via `a[rel="next"]`. **Caution: his 200 ms sleep violates the site's `Crawl-delay: 2` â€” use 2 s.**

6. **Council-directory slugs verified for all 12 members** at https://www.portland.gov/council â€” the roster report's `districts/{n}/{first-last}` URLs are all correct as listed (avalos, dunphy, smith / ryan, pirtle-guiney, kanal / morillo, novick, koyama-lane / zimmerman, green, clark).

7. **efiles `?format=json` works** (contradiction between the efiles and transcripts reports resolved): https://efiles.portlandoregon.gov/Record?q=anyWord:%22Council%20meeting%20minutes%20August%22&format=json&pagesize=20&sortBy=recCreatedOn- returned valid JSON. Either `format=json` or the `Accept` header is fine.

8. **Minutes lag confirmed â€” no August 2026 minutes exist in efiles yet** (newest "August" minutes are Aug 13-14, 2025, uri 17431281). So the 19-filed-vs-11-voted Moda amendment question **cannot** be resolved from minutes this week; the meeting video is the only route.

9. **Moda motions partially clarified.** A structured re-fetch of https://www.portland.gov/council/documents/resolution/moda-term-sheet-0 lists the 11 roll-call amendment motions plus continuance motion(s) with no roll call; **Avalos 2â€“5 and 9â€“12 have no motion entries at all** â€” they were never moved (or are held for Aug 12), not voted down. Encode only the 11 roll calls. Note: two fetches of the same page returned different motion counts (14 vs 12) via the summarizer â€” **parse the raw HTML yourself; motions are plain paragraphs, regex on the pattern `Moved by X and seconded by Y. (Aye (N): â€¦; Nay (N): â€¦)`.**

10. **OLCV remains bot-blocked** â€” https://www.olcv.org/2024-portland-environmental-voter-guide/ returned HTTP 403 again. Needs a manual browser visit; don't attribute OLCV endorsements until then.

## B. Remaining blockers / unanswered technical questions

1. **Amendment-motion HTML is unstructured prose** (confirmed: plain paragraphs, no classed markup, unlike the clean `list-inline-comma` final-vote block). The regex grammar for motions (mover/seconder/target/outcome, voice votes, "Motion failed to pass", continuances, "as amended" variants) is unspecified across all six reports â€” this is the single riskiest parsing task this week. Sample a diverse doc set (multi-reading ordinances, consent items, withdrawn motions) before freezing the grammar.
2. **Absent/Abstain rendering on document pages** is unverified â€” the reports show Absent handling in only one example prose form. Confirm how the visually-hidden Votes block renders Absent/Abstain (separate `<li><strong>Absent (1):</strong>` list?) before writing the parser.
3. **No incremental-update trigger defined.** No RSS/sitemap exists; the plan says "re-fetch page 0 of /council/votes" but votes post with unknown latency after meetings (unmeasured). Also unverified: whether `page=0` ordering is strictly by meeting date descending.
4. **Zimmerman's Aug 6 floor participation** still unverifiable without the video. YouTube caption fetch requires a residential IP or PO-token plumbing (per the transcripts report) â€” that infrastructure isn't set up and is not a this-week dependency unless the messaging-vs-record feature ships with the Moda case study.
5. **The Moda final vote lands Aug 12** â€” mid-build. The resolution page https://www.portland.gov/council/documents/resolution/moda-term-sheet-0 and the votes view will change; schedule a re-scrape Aug 12 PM.
6. **All quoted councilor statements in the moda-case-study report passed through automated summarization** and are flagged by its own author as unverified verbatim â€” do not publish quotes without re-checking the WW/OPB article text directly.
7. **Committee-membership history is needed if committee votes are scoped**: the Febâ€“Mar 2026 restructure (8 committees â†’ 5) means member-to-committee mappings are time-dependent; no report captured the 2025 committee rosters.
8. **KGW pages time out for fetchers** (JS-heavy) and **OregonLive blocks Anthropic crawling** â€” anything sourced only to KGW snippets (e.g. the "19 amendments" framing, Zimmerman's pre-vote stance) needs browser verification or should be dropped.

## C. Report discrepancies to resolve before seeding data

- **efiles vs portland.gov doc numbers disagree** (2026-175 vs 2026-179 for Ord. 192178, per the efiles report) â€” join on ordinance/resolution number, never on the `YYYY-NNN` in efiles titles.
- **Votes-view vocabulary ("Yea") vs document-page vocabulary ("Aye")** â€” normalize to OCD `yes/no/absent/abstain` at ingest.
- **WW's "approved today by a 7-5 vote" line** conflicts with the official record (no Aug 6 approval vote; item continued) â€” already correctly flagged; do not encode.
- **Wilson vote-count drift**: agenda-votes report said `member=Wilson` â†’ 1 record and implied it was old; it is actually the July 22, **2026** tie-break â€” the count will grow with each tie, so don't hard-code mayor exclusion, just render him separately from the 12.

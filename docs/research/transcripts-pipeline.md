# Programmatic access to Portland City Council meeting transcripts (2025â€“2026)

Research date: 2026-08-08. Claims marked **[verified]** were tested first-hand today (HTTP fetches / rendered pages); others cite the linked source.

## 1. The eGovPDX YouTube channel

- **Correct channel identity:** The channel is named "eGov PDX", channel ID `UCcPIUh7CWwtBXisMPHWG65g`, and its actual handle is **`@egovpdx8714`** â€” NOT `@eGovPDX`. `https://www.youtube.com/@eGovPDX` returns **HTTP 404** **[verified]**. Handle/ID confirmed via YouTube oEmbed (`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=3kM0kEib_zw&format=json` â†’ `"author_name":"eGov PDX","author_url":"https://www.youtube.com/@egovpdx8714"`) **[verified]**.
- **Canonical archive = the "Portland City Council Sessions" playlist:** `https://www.youtube.com/playlist?list=PL4m94lCOY10kcH-ufAjNIh1ntElCElA4_` â€” 1,772 videos, owned by eGov PDX **[verified, rendered in browser]**. This is the exact URL every portland.gov agenda page links as "the City's YouTube Channel" ([Aug 12, 2026 agenda](https://www.portland.gov/council/agenda/2026/8/12), [clerk meetings page](https://www.portland.gov/auditor/council-clerk/meetings)).
- **Coverage since Jan 2025:** Continuous. Spot-checks found the new council's first meeting "Portland City Council Regular Meeting 01/02/25", "Portland City Council Regular Meeting PM  01/15/25" (`svevT4FhcoY`, streamed live Jan 15, 2025), and an unbroken stream of 2026 sessions/committees/work sessions through Aug 2026, plus scheduled upcoming streams (e.g. "Portland City Council PM Session 08/12/26") **[verified]**. The playlist description states: if content is unavailable in the playlist, phone the BTS Help Desk at 503-823-5199 with the recording date and AM/PM session â€” implying this playlist is intended as the complete archive **[verified]**. Pre-2025 (old council) meetings are on the same channel (e.g. [AM Session 09/04/24](https://www.youtube.com/watch?v=XPRa04j6ulg)).
- **Title conventions (inconsistent â€” parse defensively):** observed patterns **[verified from playlist]**:
  - `Portland City Council AM Session MM/DD/YY` / `PM Session MM/DD/YY` (dominant 2026 form)
  - 2025 variants: `Portland City Council Regular Meeting 01/02/25`, `Portland City Council Regular Meeting PM  01/15/25`, `Portland City Council Regular Session 05/13/26`, `Portland City Council Regular AM Session 06/10/26`, `Portland City Council Special Meeting  06/11/26`
  - Committees: `Portland City Council <Committee> Committee MM/DD/YY` â€” 2025 names (e.g. "Finance Committee", "Transportation and Infrastructure Committee", "Labor and Workforce Development") differ from 2026 names ("Finance & Governance Committee (Whole)", "Housing & Permitting", "Community & Public Safety", "Public Works", "City Life") â€” committee restructuring between years.
  - Work/budget sessions: `Portland City Council Work Session - <topic> MM/DD/YY`, `Portland City Council Budget Committee Meeting FY2026-27 ...`, `City Council AM Work Session 07/30/26` (note: missing "Portland" prefix), `Portland City Council TSCC Public Hearing 06/09/26`.
  - Quirks: date is sometimes `M/DD/YY` (`5/27/26`), sometimes preceded by `- `, double spaces occur. Recommendation: extract date with regex `\d{1,2}/\d{1,2}/\d{2}` and classify session type from keywords.
- **Captions â€” the key finding:** council videos carry **three English caption tracks** â€” checked on both a 2026 video (`3kM0kEib_zw`, Finance & Governance 04/15/26) and a Jan 2025 video (`svevT4FhcoY`) **[verified from `ytInitialPlayerResponse` in watch-page HTML]**:
  1. `English (auto-generated)` (`kind: "asr"` â€” YouTube ASR)
  2. `English - CC1` (trackName `CC1`)
  3. `English - DTVCC1` (trackName `DTVCC1`)
  
  CC1/DTVCC1 are the EIA-608/CEA-708 broadcast caption channels embedded in the live TV stream â€” i.e., the **human-produced live captioning from the televised broadcast**, matching the city's description of captions "produced through the closed captioning process for the televised city Council broadcast" ([efiles minutes](https://efiles.portlandoregon.gov/Record/17479759/File/Document)). These are substantially better than ASR for names/terms, though the city warns they are "not a verbatim transcript."
- **No chapters:** no `chapterRenderer`/`macroMarkers` in watch pages; video descriptions contain only `https://www.portland.gov/council/agenda` plus an Open Signal alternate-stream link **[verified]**.

## 2. The city's own video platform

- portland.gov does **not** self-host or embed replay video. Agenda pages ([example](https://www.portland.gov/council/agenda/2026/8/12)) list exactly three watch avenues **[verified]**:
  1. YouTube playlist `PL4m94lCOY10kcH-ufAjNIh1ntElCElA4_` (archive + live)
  2. Open Signal live stream: `https://reflect-opensignalpdx.cablecast.tv/cablecastapi/live?channel_id=5&use_cdn=true` (a **Cablecast/Tightrope Reflect** system). Its public JSON API works (`/cablecastapi/v1/shows?search=council`, 3,734 show records) but it exposes almost **no VODs** (3 total) â€” live/cablecast only, not a replay archive **[verified]**.
  3. Xfinity channels 30/330 (broadcast).
- Granicus is not used. The legacy `portlandoregon.gov/video/player` pages belong to the pre-2025 era.
- **YouTube is therefore the only programmatic video/caption source; efiles is the only document source.**

## 3. Programmatic transcript options (state of play, Aug 2026)

- **Raw caption-URL scraping is dead:** I fetched the `captionTracks[].baseUrl` (valid signature, residential IP, browser UA) directly â€” YouTube returned **HTTP 200 with a 0-byte body** **[verified]**. This matches the documented requirement of a **PO (proof-of-origin) token** for subtitle downloads: removing `pot=`/`c=WEB` params yields an empty body ([yt-dlp issue #13075](https://github.com/yt-dlp/yt-dlp/issues/13075), [PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/Po-Token-Guide)).
- **yt-dlp:** still the most reliable self-hosted route. Use `--write-subs --write-auto-subs --sub-langs "en.*"` to get both the CC1 broadcast track and ASR. When YouTube demands a subtitle POT, current fixes are the [bgutil-ytdlp-pot-provider](https://pypi.org/project/bgutil-ytdlp-pot-provider) plugin (auto-generates POTs) or manually passing `--extractor-args "youtube:po_token=web.subs+XXX"` ([issue #13075](https://github.com/yt-dlp/yt-dlp/issues/13075), [PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/Po-Token-Guide)). Enumerate the archive with `yt-dlp --flat-playlist -J` on the playlist or the channel uploads playlist (`UUcPIUh7CWwtBXisMPHWG65g`).
- **youtube-transcript-api (Python):** works from **residential IPs**; **cloud/datacenter IPs (AWS/GCP/Azure/DO) are blocked by ASN** â†’ `RequestBlocked`/`IpBlocked` ([project README](https://github.com/jdepoix/youtube-transcript-api), [issue #593 (2026)](https://github.com/jdepoix/youtube-transcript-api/issues/593)). Current workarounds: (a) run the fetcher on a residential connection (e.g. a home box cron job pushing transcripts to your cloud backend); (b) **rotating residential proxies** â€” Webshare is integrated into the library via `WebshareProxyConfig` (note: Webshare's free tier is datacenter-only and also blocked; residential requires the paid tier â€” [issue #593](https://github.com/jdepoix/youtube-transcript-api/issues/593)); (c) `GenericProxyConfig` with any residential proxy; (d) managed transcript APIs (e.g. Supadata) that own the proxy layer ([issue #593](https://github.com/jdepoix/youtube-transcript-api/issues/593)).
- **Official YouTube Data API is NOT a workaround for caption text:** `captions.download` requires OAuth (`youtube.force-ssl`/`youtubepartner`) and "requires the user to have permission to edit the video" â€” third parties cannot download captions for eGov PDX's videos; 200 quota units/call ([captions.download docs](https://developers.google.com/youtube/v3/docs/captions/download)). The Data API **is** the clean way to enumerate videos/titles/dates (`playlistItems.list` on `PL4m94lCOY10kcH-ufAjNIh1ntElCElA4_` or uploads playlist `UUcPIUh7CWwtBXisMPHWG65g`, API-key only).

## 4. Official captions/transcripts published by the city â€” YES, in efiles

- **Since the new council (2025), the clerk's official minutes bundle a caption-derived transcript.** The minutes PDFs state the text was "produced through the closed captioning process for the televised city Council broadcast and should not be considered a verbatim transcript," with official votes/motions/speaker names in the minutes proper; minutes "include the closed caption file, a speaker list, and audio files (mp3)". Examples in efiles: [Sept 3-4, 2025 Council](https://efiles.portlandoregon.gov/Record/17479759/File/Document), [July 8, 2025 Community & Public Safety Committee](https://efiles.portlandoregon.gov/Record/17430658/File/Document) (520 KB PDF **[verified downloaded]**), [March 25, 2025 CPS Committee](https://efiles.portlandoregon.gov/record/17275003/file/document), [Dec 15, 2025 Transportation & Infrastructure](https://efiles.portlandoregon.gov/record/17642294/file/document/).
- **efiles has an unauthenticated JSON API** (Micro Focus Content Manager "WebDrawer") **[verified]**:
  - Search: `GET https://efiles.portlandoregon.gov/Record?q=<TRIM query>&pageSize=N` with header `Accept: application/json` (the `?format=json` param behaved unreliably; use the Accept header).
  - Query syntax examples that worked: `q=title:"council minutes" AND registeredOn:2025` (175 results), `q=title:"Council meeting minutes January 15-16, 2025"`, `q=recContainer:17141135` (lists a container's children).
  - File download: `https://efiles.portlandoregon.gov/Record/{uri}/File/Document`.
  - Verified structure: minutes container "Council meeting minutes January 15-16, 2025" (uri 17141135) contains `January 15-16, 2025 Minutes` (PDF) + `January 15, 2025 PM Audio` (MP3) + `January 16, 2025 PM Audio` (MP3); committee container 17394152 contains Minutes PDF (uri 17430658) + Audio MP3 (uri 17430657) **[verified]**. Some records elsewhere in efiles are literal `.VTT` files, so check `RecordExtension`.
  - The efiles **web** search UI is JavaScript-rendered (WebFetch returns an empty shell) â€” use the JSON endpoint instead **[verified]**.
- portland.gov agenda pages **embed the written minutes as HTML** (dispositions, votes, motions per item) and link the efiles minutes record ([June 3-4, 2026 agenda](https://www.portland.gov/council/agenda/2026/6/3), [July 8, 2025 committee agenda](https://www.portland.gov/council/agenda/community-and-public-safety-committee/2025/7/8)) **[verified]**. Records overview: [Find Council meeting records](https://www.portland.gov/auditor/council-clerk/records) (minutes 1990â€“present; audio bundled with minutes Aug 2022â€“present). Contact: councilclerk@portlandoregon.gov. Captioning obligation: [Captioning and transcription policy](https://www.portland.gov/help/about/captioning-and-transcription-policy).

## 5. Agenda-item â†’ video-position timestamps: NONE exist

- Agenda pages: no per-item video links or timestamps ([June 3-4, 2026](https://www.portland.gov/council/agenda/2026/6/3)) **[verified]**.
- Council document/item pages: no video links at all (e.g. [Ordinance 192191](https://www.portland.gov/council/documents/ordinance/passed/192191) â€” shows the full 12-member roll call but nothing video-related) **[verified]**.
- YouTube videos: no chapter markers; descriptions are boilerplate **[verified]**.
- Practical mapping strategy: match meeting date + AM/PM from the video title to the agenda date/session, then locate items inside the transcript by searching for item numbers/titles and clerk phrases ("Item number ...") in the CC1 caption text (which carries timestamps in the VTT).

## Bonus findings for a vote-tracking site

- **The city already publishes granular vote data:** [portland.gov/council/votes](https://www.portland.gov/council/votes) â€” per-member Yea/Nay/Absent/Abstain rows for ordinances/resolutions/reports, Jan 6, 2021 â†’ present, 15,569 rows, filter/search UI, paginated 24/page, **no documented export or API** (portland.gov is Drupal; whether a JSON endpoint is exposed was not verified) **[verified page]**. Item pages under `/council/documents/...` also show roll calls **[verified]**.
- Agenda URL patterns for scraping: council `portland.gov/council/agenda/{yyyy}/{m}/{d}`, committees `portland.gov/council/agenda/{committee-slug}/{yyyy}/{m}/{d}`, index at [portland.gov/council/agenda/all](https://www.portland.gov/council/agenda/all) **[verified]**.

## Recommended pipeline

1. **Enumerate videos** via YouTube Data API `playlistItems.list` on `PL4m94lCOY10kcH-ufAjNIh1ntElCElA4_` (API key, cheap) or `yt-dlp --flat-playlist`.
2. **Fetch captions** with yt-dlp (`--write-subs --sub-langs "en.*"` to prefer the human CC1 track, ASR as fallback) from a **residential IP** or behind rotating residential proxies; add `bgutil-ytdlp-pot-provider` for POT resilience. Do not build on raw `timedtext` URLs (empty-body POT gating **[verified]**) or on Data API `captions.download` (owner-only).
3. **Cross-reference official records** from the efiles WebDrawer JSON API (minutes PDF = official votes + caption-derived transcript + speaker list; MP3 audio available) and scrape portland.gov agenda HTML / `council/votes` for vote rows.

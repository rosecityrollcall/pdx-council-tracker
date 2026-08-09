"""Scrape Portland City Council roll-call votes from portland.gov into data/*.json.

Two passes:
  1. /council/votes  - flat table of final-vote records (one row per document+member),
     server-rendered Drupal view, grouped under <time datetime> meeting-date headings.
  2. Each document page (/council/documents/...) - final-vote block plus amendment/motion
     roll calls, which exist ONLY as prose on document pages (they are absent from the
     votes view, as are first-reading and committee roll calls).

Politeness: portland.gov robots.txt mandates Crawl-delay: 2 - honored below. Raw HTML is
cached in data/raw/ so re-runs only refetch what's new.

Known-fragile area (verify on first CI run): the amendment-motion prose has no classed
markup; the regex grammar below was derived from Aug 2026 samples and needs checking
against multi-reading ordinances and voice votes.

Usage: python scraper/scrape.py --since 2025-01-01 [--max-index-pages N] [--refresh]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import time

import requests
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"
BASE = "https://www.portland.gov"
UA = "pdx-council-tracker (volunteer civic project; respects Crawl-delay 2)"
CRAWL_DELAY = 2.0

_last_fetch = [0.0]


def fetch(url: str, refresh: bool = False) -> str:
    """Fetch with cache + crawl delay."""
    RAW.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(url.encode()).hexdigest()[:16]
    slug = re.sub(r"[^a-z0-9]+", "-", url.split("portland.gov")[-1].lower()).strip("-")[:80]
    cache = RAW / f"{slug}-{key}.html"
    if cache.exists() and not refresh:
        return cache.read_text(encoding="utf-8")
    wait = CRAWL_DELAY - (time.monotonic() - _last_fetch[0])
    if wait > 0:
        time.sleep(wait)
    resp = requests.get(url, headers={"User-Agent": UA}, timeout=30)
    _last_fetch[0] = time.monotonic()
    resp.raise_for_status()
    cache.write_text(resp.text, encoding="utf-8")
    return resp.text


# --- name normalization -------------------------------------------------------
# The votes view prints full names ("Angelita Morillo"); document pages print
# last names only ("Morillo"); minutes contain typos ("Kanai"). Two-word and
# hyphenated surnames make naive splitting unsafe.
CANONICAL = {
    "avalos": ["candace avalos", "avalos"],
    "dunphy": ["jamie dunphy", "dunphy"],
    "smith": ["loretta smith", "smith"],
    "kanal": ["sameer kanal", "kanal", "kanai"],
    "pirtle-guiney": ["elana pirtle-guiney", "pirtle-guiney", "pirtle guiney"],
    "ryan": ["dan ryan", "ryan"],
    "koyama-lane": ["tiffany koyama lane", "koyama lane", "koyama-lane"],
    "morillo": ["angelita morillo", "morillo"],
    "novick": ["steve novick", "novick"],
    "clark": ["olivia clark", "clark"],
    "green": ["mitch green", "green"],
    "zimmerman": ["eric zimmerman", "zimmerman"],
    "wilson": ["keith wilson", "wilson", "mayor wilson", "mayor keith wilson"],
}
NAME_TO_SLUG = {alias: slug for slug, aliases in CANONICAL.items() for alias in aliases}

VOTE_WORDS = {"yea": "aye", "aye": "aye", "nay": "nay",
              "absent": "absent", "abstain": "abstain"}


def to_slug(name: str) -> str | None:
    return NAME_TO_SLUG.get(name.strip().lower().replace("’", "'"))


# --- pass 1: the votes view ---------------------------------------------------

def scrape_votes_index(since: str, max_pages: int, refresh: bool):
    """Yield {date, doc_number, doc_url, member_slug, vote} rows from /council/votes."""
    for page in range(max_pages):
        html = fetch(f"{BASE}/council/votes?page={page}", refresh=refresh and page == 0)
        soup = BeautifulSoup(html, "lxml")
        view = soup.select_one(".view-council-votes") or soup
        current_date = None
        oldest_on_page = None
        rows_found = 0
        # Walk in document order so each row inherits the nearest preceding date heading.
        for el in view.find_all(["time", "tr"]):
            if el.name == "time" and el.get("datetime"):
                current_date = el["datetime"][:10]
                oldest_on_page = current_date
                continue
            if el.name != "tr" or not el.find("td"):
                continue
            doc_cell = el.select_one(".views-field-field-document-number")
            member_cell = el.select_one(".views-field-field-name")
            vote_cell = el.select_one(".views-field-field-voted-as-follows")
            link = el.find("a", href=re.compile(r"/council/documents/"))
            if not (member_cell and vote_cell):
                continue
            slug = to_slug(member_cell.get_text(" ", strip=True))
            vote = VOTE_WORDS.get(vote_cell.get_text(strip=True).lower())
            if not (slug and vote):
                continue
            rows_found += 1
            # Link text carries the descriptive title, which the document page itself
            # loses after passage (its h1/og:title degrade to the ordinance number).
            doc_title = re.sub(r"[​‎﻿]", "", link.get_text(" ", strip=True)).strip() if link else None
            yield {
                "date": current_date,
                "doc_number": doc_cell.get_text(strip=True) if doc_cell else None,
                "doc_url": (BASE + link["href"]) if link and link["href"].startswith("/") else (link["href"] if link else None),
                "doc_title": doc_title if doc_title and not doc_title.isdigit() else None,
                "member": slug,
                "vote": vote,
            }
        if rows_found == 0:
            return  # past the last page
        if oldest_on_page and oldest_on_page < since:
            return


# --- pass 2: document pages ---------------------------------------------------

# Final-vote block: <span class="visually-hidden">Votes</span> followed by
# <ul class="list-unstyled"><li><strong>Aye (10): </strong><ul class="list-inline-comma">...
def parse_final_votes(soup: BeautifulSoup) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    marker = soup.find("span", class_="visually-hidden", string=re.compile(r"^\s*Votes\s*$"))
    block = marker.find_next("ul") if marker else None
    if not block:
        return out
    for li in block.find_all("li", recursive=False):
        strong = li.find("strong")
        if not strong:
            continue
        m = re.match(r"(Aye|Nay|Absent|Abstain)", strong.get_text(strip=True))
        if not m:
            continue
        kind = VOTE_WORDS[m.group(1).lower()]
        names = [to_slug(n.get_text(strip=True)) for n in li.select("ul.list-inline-comma li")]
        out[kind] = [n for n in names if n]
    return out


# Motion prose, e.g.:
#   "Motion to amend Exhibit A ...: Moved by Green and seconded by Avalos.
#    (Aye (5): Koyama Lane, Morillo, Green, Avalos, Kanal; Nay (7): Novick, ...)"
MOTION_RE = re.compile(
    r"Moved by (?P<mover>[A-Z][\w'\- ]+?) and seconded by (?P<seconder>[A-Z][\w'\- ]+?)\.",
)
TALLY_RE = re.compile(r"(Aye|Nay|Absent|Abstain)\s*\((\d+)\):\s*([^;)।]+)")


def parse_motions(soup: BeautifulSoup) -> list[dict]:
    """Extract motion roll calls from unstructured document-page prose."""
    motions = []
    for para in soup.find_all(["p", "li", "div"]):
        text = para.get_text(" ", strip=True)
        if "Moved by" not in text or "Aye" not in text:
            continue
        if len(text) > 1200 or para.find(["p", "div"]):  # container, not a leaf paragraph
            continue
        mv = MOTION_RE.search(text)
        tallies = {}
        for kind_word, _count, names in TALLY_RE.findall(text):
            kind = VOTE_WORDS[kind_word.lower()]
            slugs = [to_slug(n) for n in re.split(r",\s*", names.strip())]
            tallies[kind] = [s for s in slugs if s]
        if not tallies:
            continue
        label = text.split("Moved by")[0].strip(" :.;")[:300] or "Motion"
        result = "failed" if re.search(r"[Mm]otion (?:failed|did not pass)|failed to pass", text) else (
            "passed" if re.search(r"[Mm]otion (?:passed|carried)", text) else None)
        if result is None:
            ayes, nays = len(tallies.get("aye", [])), len(tallies.get("nay", []))
            result = "passed" if ayes > nays and ayes >= 7 else "failed"
        motions.append({
            "motion": label,
            "kind": "amendment" if re.search(r"amend", label, re.I) else "procedural",
            "result": result,
            "moved_by": to_slug(mv.group("mover")) if mv else None,
            "seconded_by": to_slug(mv.group("seconder")) if mv else None,
            "ayes": tallies.get("aye", []),
            "nays": tallies.get("nay", []),
            "absent": tallies.get("absent", []) + tallies.get("abstain", []),
        })
    return motions


TYPE_RE = re.compile(r"/council/documents/(ordinance|resolution|report|proclamation|public-communication)/")


def scrape_document(url: str, refresh: bool) -> dict | None:
    html = fetch(url, refresh=refresh)
    soup = BeautifulSoup(html, "lxml")
    h1 = soup.find("h1")
    if not h1:
        return None
    text = soup.get_text(" ", strip=True)
    doc_number = None
    m = re.search(r"Document number\s*:?\s*(20\d\d-\d{3})", text) or re.search(r"\b(20\d\d-\d{3})\b", text)
    if m:
        doc_number = m.group(1)
    type_m = TYPE_RE.search(url)
    intro = re.search(r"Introduced by\s*:?\s*(.{3,120}?)(?:\s{2,}|Council|Date|$)", text)
    final_votes = parse_final_votes(soup)
    motions = parse_motions(soup)
    return {
        "id": doc_number,
        "type": type_m.group(1) if type_m else "document",
        "title": h1.get_text(strip=True),
        "sponsors": [s.strip() for s in re.split(r",| and ", intro.group(1))] if intro else [],
        "url": url,
        "summary": "",
        "final_votes": final_votes,
        "motions": motions,
    }


# --- merge into data files ----------------------------------------------------

def merge(index_rows: list[dict], docs: dict[str, dict]) -> None:
    items_path = DATA / "items.json"
    existing = {it["id"]: it for it in json.loads(items_path.read_text(encoding="utf-8"))} if items_path.exists() else {}

    # Group index rows: (doc_url) -> date -> {member: vote}
    by_doc: dict[str, dict] = {}
    for r in index_rows:
        if not r["doc_url"]:
            continue
        d = by_doc.setdefault(r["doc_url"], {"doc_number": r["doc_number"], "doc_title": None, "dates": {}})
        d["dates"].setdefault(r["date"], {})[r["member"]] = r["vote"]
        if r.get("doc_title") and not d["doc_title"]:
            d["doc_title"] = r["doc_title"]

    for url, info in by_doc.items():
        doc = docs.get(url)
        if not doc:
            continue
        item_id = doc["id"] or info["doc_number"]
        if not item_id:
            continue
        prev = existing.get(item_id, {})
        if doc["final_votes"]:
            # The doc page's Votes block is authoritative for the final tally. The votes
            # view sometimes splits one roll call across two meeting-date headings, so
            # per-date reconstruction from index rows is only a fallback.
            fv = doc["final_votes"]
            final_vote = {
                "motion": "Final vote",
                "kind": "passage",
                "result": "passed" if len(fv.get("aye", [])) > len(fv.get("nay", [])) else "failed",
                "ayes": sorted(fv.get("aye", [])),
                "nays": sorted(fv.get("nay", [])),
                "absent": sorted(fv.get("absent", []) + fv.get("abstain", [])),
            }
            actions = [{"date": max(info["dates"]), "disposition": "",
                        "votes": doc["motions"] + [final_vote]}]
        else:
            actions = []
            for date, members in sorted(info["dates"].items()):
                votes = [{
                    "motion": "Final vote",
                    "kind": "passage",
                    "result": "passed" if sum(v == "aye" for v in members.values()) > sum(v == "nay" for v in members.values()) else "failed",
                    "ayes": sorted(m for m, v in members.items() if v == "aye"),
                    "nays": sorted(m for m, v in members.items() if v == "nay"),
                    "absent": sorted(m for m, v in members.items() if v in ("absent", "abstain")),
                }]
                actions.append({"date": date, "disposition": "", "votes": votes})
            if doc["motions"] and actions:
                actions[-1]["votes"] = doc["motions"] + actions[-1]["votes"]
        title = doc["title"]
        if (not title or title.isdigit() or re.match(r"^20\d\d-\d{3}$", title)) and info.get("doc_title"):
            title = info["doc_title"]
        if (not title or title.isdigit()) and prev.get("title") and not prev["title"].isdigit():
            title = prev["title"]
        merged = {
            "id": item_id,
            "type": doc["type"],
            "title": title,
            "sponsors": doc["sponsors"] or prev.get("sponsors", []),
            "url": url,
            "summary": prev.get("summary", ""),
            "status": "passed" if actions and actions[-1]["votes"][-1]["result"] == "passed" else "failed",
            "actions": actions,
        }
        if prev.get("short_title"):
            merged["short_title"] = prev["short_title"]
        if prev.get("summary") and not merged["summary"]:
            merged["summary"] = prev["summary"]
        # Never degrade: existing data (hand-curated or agent-extracted) wins whenever
        # it holds more roll calls than this scrape produced — motion-prose parsing is
        # best-effort and must not overwrite a richer record with a poorer one.
        def _nvotes(acts):
            return sum(len(a.get("votes", [])) for a in acts)
        if prev and _nvotes(prev.get("actions", [])) > _nvotes(actions):
            merged["actions"] = prev["actions"]
            merged["status"] = prev.get("status", merged["status"])
        existing[item_id] = merged

    items = sorted(existing.values(), key=lambda it: it["actions"][-1]["date"] if it.get("actions") else "", reverse=True)
    items_path.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")

    meetings_path = DATA / "meetings.json"
    meetings = {m["date"]: m for m in json.loads(meetings_path.read_text(encoding="utf-8"))} if meetings_path.exists() else {}
    for it in items:
        for ac in it.get("actions", []):
            if not ac.get("date"):
                continue
            mt = meetings.setdefault(ac["date"], {"date": ac["date"], "agenda_url": "", "item_ids": []})
            if it["id"] not in mt["item_ids"]:
                mt["item_ids"].append(it["id"])
            if not mt["agenda_url"]:
                y, mo, dy = ac["date"].split("-")
                mt["agenda_url"] = f"{BASE}/council/agenda/{y}/{int(mo)}/{int(dy)}"
    meetings_path.write_text(
        json.dumps(sorted(meetings.values(), key=lambda m: m["date"]), ensure_ascii=False, indent=1),
        encoding="utf-8")
    print(f"items: {len(items)}, meetings: {len(meetings)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="2025-01-01")
    ap.add_argument("--max-index-pages", type=int, default=200)
    ap.add_argument("--refresh", action="store_true", help="refetch page 0 and doc pages of pending items")
    args = ap.parse_args()

    rows = [r for r in scrape_votes_index(args.since, args.max_index_pages, args.refresh)
            if r["date"] and r["date"] >= args.since]
    print(f"votes-index rows since {args.since}: {len(rows)}")

    docs = {}
    for url in sorted({r["doc_url"] for r in rows if r["doc_url"]}):
        try:
            doc = scrape_document(url, refresh=args.refresh)
            if doc:
                docs[url] = doc
        except requests.RequestException as e:
            print(f"WARN: {url}: {e}")
    print(f"document pages parsed: {len(docs)}")
    merge(rows, docs)


if __name__ == "__main__":
    main()

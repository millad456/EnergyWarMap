#!/usr/bin/env python3
"""
EnergyWarMap — Automated Incident Fetcher
=========================================
Queries NewsAPI for recent energy infrastructure disruption articles,
uses DeepSeek (via OpenAI-compatible API) to extract structured data,
geocodes with Nominatim, and appends new rows to the CSV.

Usage:
    python scripts/fetch_incidents.py

Environment variables required:
    NEWSAPI_KEY         — NewsAPI.org API key
    DEEPSEEK_API_KEY    — DeepSeek API key
    DEEPSEEK_MODEL      — Model name (default: deepseek-chat)

Optional:
    CSV_PATH            — Path to CSV (default: mapData/DestroyedInfrastructureList.csv)
    LOOKBACK_DAYS       — How many days back to search (default: 2)
"""

import os
import csv
import json
import sys
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from openai import OpenAI

# ── Config ──────────────────────────────────────────────────────────
NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY", "")
DEEPSEEK_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
CSV_PATH = Path(os.environ.get("CSV_PATH", "mapData/DestroyedInfrastructureList.csv"))
LOOKBACK_DAYS = int(os.environ.get("LOOKBACK_DAYS", "2"))

# Report file — stores a summary JSON of each run so the GitHub Action
# can show what happened in its step output.
REPORT_PATH = Path("scripts/last_run_report.json")

# If run from repo root, resolve relative.  Also try the working dir.
if not CSV_PATH.exists():
    alt = Path.cwd() / CSV_PATH
    if alt.exists():
        CSV_PATH = alt.resolve()

# NewsAPI endpoint
NEWSAPI_URL = "https://newsapi.org/v2/everything"

# DeepSeek-compatible endpoint (OpenAI SDK)
DEEPSEEK_BASE = "https://api.deepseek.com/v1"

# Nominatim (free geocoding)
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_DELAY = 1.1  # seconds between requests (respect usage policy)

# ── Helpers ─────────────────────────────────────────────────────────

def log(msg: str):
    print(f"[fetch-incidents] {msg}", flush=True)


def fetch_news_articles(api_key: str, days: int) -> list[dict]:
    """Fetch recent news articles about energy infrastructure attacks."""
    from_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")

    queries = [
        '"oil refinery" attack drone',
        '"gas pipeline" explosion',
        '"energy infrastructure" drone strike',
        '"LNG facility" shutdown attack',
        '"oil depot" fire',
        '"refinery" strike drone Ukraine',
        '"pipeline" disrupted attack',
    ]

    all_articles: list[dict] = []
    seen_urls: set[str] = set()

    for query in queries:
        params = {
            "q": query,
            "from": from_date,
            "language": "en",
            "sortBy": "relevancy",
            "pageSize": 30,
            "apiKey": api_key,
        }
        try:
            resp = requests.get(NEWSAPI_URL, params=params, timeout=20)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") != "ok":
                log(f"NewsAPI error for '{query}': {data.get('message', 'unknown')}")
                continue
            for article in data.get("articles", []):
                url = article.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_articles.append(article)
            log(f"'{query}' → {len(data.get('articles', []))} articles ({len(all_articles)} unique total)")
        except requests.RequestException as e:
            log(f"NewsAPI request failed for '{query}': {e}")

        time.sleep(0.3)  # rate-limit politeness

    log(f"Total unique articles fetched: {len(all_articles)}")
    return all_articles


def extract_with_deepseek(articles: list[dict]) -> list[dict]:
    """
    Use DeepSeek to extract structured incident data from news articles.
    Returns list of dicts with fields matching the CSV schema.
    """
    if not articles:
        return []

    client = OpenAI(api_key=DEEPSEEK_KEY, base_url=DEEPSEEK_BASE)

    # Prepare article summaries for the prompt
    article_texts = []
    for i, a in enumerate(articles[:25]):  # limit to 25 per batch
        title = (a.get("title") or "").strip()
        desc = (a.get("description") or "").strip()[:500]
        content = (a.get("content") or "").strip()[:800]
        url = (a.get("url") or "").strip()
        source = (a.get("source") or {}).get("name", "")
        pub_date = (a.get("publishedAt") or "")[:10]
        combo = f"[{i+1}] Title: {title}\n    Source: {source} ({pub_date})\n    Description: {desc}\n    Snippet: {content}\n    URL: {url}"
        article_texts.append(combo)

    prompt = f"""You are a data extraction assistant for EnergyWarMap, a project tracking global disruptions to oil and gas infrastructure.

Below are {len(article_texts)} news articles about potential energy infrastructure incidents (attacks, explosions, fires, shutdowns, drone strikes, etc.).

For EACH article that describes a VERIFIABLE incident (not just political commentary or general market analysis), extract the following fields as a JSON object. If an article does NOT describe a specific incident, skip it.

Fields to extract:
- Facility (string): name of the facility (refinery, pipeline, port, field, etc.). Use "Unknown" if not specified.
- Country (string): country where the incident occurred.
- Facility Type (string): "Oil", "Gas", "Pipeline", or "Gas/Petrochemical"
- Lat (float or null): approximate latitude. Use null if unclear.
- Lon (float or null): approximate longitude. Use null if unclear.
- Description (string): 1-2 sentence summary of what happened.
- Date (string): date of incident in YYYY-MM-DD format, or a descriptive range like "Late March 2026". Use the article's publication date as fallback.
- Capacity (string): capacity affected or "No info found". Format like "~240,000 b/d", "0.173 bcm/d", "17% of total capacity".
- Source URL (string): the article URL.
- Attack Happened (string): "TRUE" if this describes a deliberate attack/drone strike/missile/sabotage, "FALSE" if it's an accident/technical failure.

Respond ONLY with a valid JSON array of objects. No markdown, no explanation.

Articles:
{chr(10).join(article_texts)}"""

    try:
        resp = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": "You extract structured incident data from news articles. Respond only with valid JSON arrays."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=4000,
        )
        raw = resp.choices[0].message.content.strip()
        log(f"DeepSeek response length: {len(raw)} chars")

        # Parse JSON — handle cases where the model wraps it in ```json ... ```
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

        extracted = json.loads(raw)
        if not isinstance(extracted, list):
            extracted = [extracted]
        log(f"DeepSeek extracted {len(extracted)} incident records")
        return extracted

    except json.JSONDecodeError as e:
        log(f"JSON parse error from DeepSeek: {e}")
        log(f"Raw response (first 500 chars): {raw[:500]}")
        return []
    except Exception as e:
        log(f"DeepSeek API error: {e}")
        return []


def geocode_facility(facility: str, country: str, approx_lat: float | None, approx_lon: float | None) -> tuple[float, float] | None:
    """
    Geocode a facility name to lat/lon using Nominatim.
    If the article already had approximate coordinates, return those.
    """
    if approx_lat is not None and approx_lon is not None:
        return (approx_lat, approx_lon)

    query = f"{facility}, {country}" if country else facility
    if not facility or facility == "Unknown":
        return None

    params = {
        "q": query,
        "format": "json",
        "limit": 1,
    }
    headers = {
        "User-Agent": "EnergyWarMap/1.0 (github.com/millad456/EnergyWarMap; educational project)"
    }
    try:
        time.sleep(NOMINATIM_DELAY)
        resp = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data:
            lat = float(data[0]["lat"])
            lon = float(data[0]["lon"])
            log(f"Geocoded '{query}' → ({lat:.4f}, {lon:.4f})")
            return (lat, lon)
        else:
            log(f"Geocoding failed for '{query}' — no results")
            return None
    except requests.RequestException as e:
        log(f"Geocoding request error for '{query}': {e}")
        return None


def load_existing_csv(path: Path) -> list[dict]:
    """Load existing CSV rows and return them + a set of known source URLs."""
    if not path.exists():
        log(f"CSV not found at {path}, starting fresh")
        return []

    rows = []
    with open(path, "r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Skip empty rows and the header-duplicate row
            facility = (row.get("Facility") or "").strip()
            if facility and facility != "Facility":
                rows.append(row)
    log(f"Loaded {len(rows)} existing rows from {path}")
    return rows


def known_source_urls(rows: list[dict]) -> set[str]:
    """Return set of all source URLs already in the CSV."""
    urls = set()
    for row in rows:
        url = (row.get("Source URL") or "").strip()
        if url:
            urls.add(url.rstrip("/"))
    return urls


def append_to_csv(path: Path, new_rows: list[dict]):
    """Append new rows to the CSV file."""
    if not new_rows:
        log("No new rows to append.")
        return

    fieldnames = [
        "Country", "Facility", "Facility Type", "Lat", "Lon",
        "Description", "Date", "Capacity", "Source URL",
        "Attack Happened", "Notes"
    ]

    file_exists = path.exists()
    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)

        # If file is empty or doesn't exist, write header
        if not file_exists or path.stat().st_size == 0:
            # We need the junk header row that PapaParse expects
            writer.writerow({k: "" for k in fieldnames})
            writer.writerow({k: k for k in fieldnames})
        else:
            # The CSV already has the two header rows, just append data
            pass

        for row in new_rows:
            writer.writerow(row)

    log(f"Appended {len(new_rows)} new rows to {path}")


def main():
    log("=== EnergyWarMap Incident Fetcher ===")

    # Validate API keys
    if not NEWSAPI_KEY:
        log("ERROR: NEWSAPI_KEY environment variable not set.")
        sys.exit(1)
    if not DEEPSEEK_KEY:
        log("ERROR: DEEPSEEK_API_KEY environment variable not set.")
        sys.exit(1)

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "lookback_days": LOOKBACK_DAYS,
        "articles_fetched": 0,
        "incidents_extracted": 0,
        "incidents_appended": 0,
        "errors": [],
    }

    # 1. Fetch news
    log(f"Fetching news from last {LOOKBACK_DAYS} days...")
    articles = fetch_news_articles(NEWSAPI_KEY, LOOKBACK_DAYS)
    report["articles_fetched"] = len(articles)

    if not articles:
        log("No articles found. Nothing to do.")
        REPORT_PATH.write_text(json.dumps(report, indent=2))
        return

    # 2. Extract with DeepSeek
    extracted = extract_with_deepseek(articles)
    report["incidents_extracted"] = len(extracted)

    if not extracted:
        log("DeepSeek extracted no incidents. Nothing to append.")
        REPORT_PATH.write_text(json.dumps(report, indent=2))
        return

    # 3. Load existing CSV and deduplicate
    existing = load_existing_csv(CSV_PATH)
    known_urls = known_source_urls(existing)

    new_incidents = []
    for inc in extracted:
        url = (inc.get("Source URL") or "").strip().rstrip("/")
        if url in known_urls:
            log(f"Skipping duplicate: {url}")
            continue

        # Geocode if needed
        lat = inc.get("Lat")
        lon = inc.get("Lon")
        if lat is not None and lon is not None:
            try:
                lat = round(float(lat), 5)
                lon = round(float(lon), 5)
            except (ValueError, TypeError):
                lat, lon = None, None

        coords = geocode_facility(
            inc.get("Facility", ""),
            inc.get("Country", ""),
            lat, lon,
        )
        if coords:
            final_lat, final_lon = coords
        else:
            final_lat, final_lon = lat, lon

        # Skip if we couldn't get coordinates and facility is unknown
        if final_lat is None and (not inc.get("Facility") or inc.get("Facility") == "Unknown"):
            log(f"Skipping row with no location data: {inc.get('Description', '')[:60]}")
            continue

        new_incidents.append({
            "Country": (inc.get("Country") or "").strip(),
            "Facility": (inc.get("Facility") or "").strip(),
            "Facility Type": (inc.get("Facility Type") or "Oil").strip(),
            "Lat": str(final_lat) if final_lat is not None else "",
            "Lon": str(final_lon) if final_lon is not None else "",
            "Description": (inc.get("Description") or "").strip(),
            "Date": (inc.get("Date") or "").strip(),
            "Capacity": (inc.get("Capacity") or "No info found").strip(),
            "Source URL": url,
            "Attack Happened": "TRUE" if (inc.get("Attack Happened") or "").upper() == "TRUE" else "TRUE",
            "Notes": "",
        })

    # 4. Append
    append_to_csv(CSV_PATH, new_incidents)
    report["incidents_appended"] = len(new_incidents)
    log(f"Done. {len(new_incidents)} new incidents added.")

    # Write report
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2))
    log(f"Report written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
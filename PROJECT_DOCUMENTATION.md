# Energy War Map — Project Documentation

## Overview

**Energy War Map** is an interactive, web-based geospatial visualization platform that tracks global oil and gas infrastructure disruptions — attacks, sabotage, and shutdowns — alongside real-time energy commodity prices. Built as a data-driven storytelling tool, it enables users to explore the intersection of geopolitical conflict and energy market dynamics through an animated timeline, interactive map, and price charts.

The project demonstrates applied skills in full-stack data engineering, API-driven data pipelines, geospatial visualization, and machine learning–assisted data parsing.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6+) | Browser-based UI, no framework dependencies |
| **Mapping** | [Leaflet.js](https://leafletjs.com/) v1.9 | Interactive slippy map with tile layers and marker clustering |
| **Map Tiles** | CARTO Dark Matter | Free, no-API-key vector/raster tile basemap |
| **Charts** | [Chart.js](https://www.chartjs.org/) v4.4 + [`chartjs-plugin-zoom`](https://github.com/chartjs/chartjs-plugin-zoom) v2.0 | Interactive price line charts with pan/zoom |
| **CSV Parsing** | [Papa Parse](https://www.papaparse.com/) v5.4 | Client-side CSV parsing of large infrastructure datasets |
| **Data Pipelines** | Python 3, `requests`, `pandas`, `openpyxl` | Automated data scraping, cleaning, and format conversion |
| **CI/CD** | GitHub Actions (`.github/workflows/update-incidents.yml`) | Scheduled daily data refresh and deployment |
| **Hosting** | GitHub Pages (served via `index.html` at repo root) | Static site hosting with zero server cost |
| **Version Control** | Git / GitHub | Source code management and collaboration |

---

## Data Sources

### 1. Commodity Price Data — Alpha Vantage API

Live and historical pricing for four key energy benchmarks:

| Symbol | Commodity | Unit | Source |
|---|---|---|---|
| `WTI` | West Texas Intermediate Crude | $/bbl | Alpha Vantage |
| `BRENT` | Brent Crude | $/bbl | Alpha Vantage |
| `NATURAL_GAS` | Henry Hub Natural Gas | $/MMBtu | Alpha Vantage |
| `TTF` | Dutch Title Transfer Facility | €/MWh | Indicative (no AV free tier) |

**API Key:** `11JJWBDWYIBP6J8M` (free tier, 5 calls/min limit)

**Data Flow:**
1. On page load, the frontend calls Alpha Vantage's daily endpoint for each commodity.
2. Responses are cached in `localStorage` with a 1-hour TTL to respect rate limits.
3. If the API fails or hits the rate limit, the system falls back to hardcoded indicative data pre-seeded in `script.js` (Jan–Apr 2026 estimates).

### 2. Infrastructure Data — Global Energy Monitor (GEM)

| Dataset | File | Format |
|---|---|---|
| Pipelines | `GEM-GOIT-Oil-NGL-Pipelines-2025-03.geojson` | GeoJSON |
| Oil & Gas Projects | `Global-Oil-and-Gas-Extraction-Tracker-March-2026 Project-level main data.csv` | CSV |
| Oil & Gas Fields | `Global-Oil-and-Gas-Extraction-Tracker-March-2026.xlsx - Field-level main data.csv` | CSV |

These are publicly available datasets from the [Global Oil & Gas Extraction Tracker](https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/) and [Global Oil & Gas Infrastructure Tracker](https://globalenergymonitor.org/projects/global-oil-gas-infrastructure-tracker/).

### 3. Incident Log — Manual & Crowd-Sourced

`mapData/DestroyedInfrastructureList.csv` is a curated log of energy infrastructure attacks, containing fields:

| Field | Description |
|---|---|
| `Facility` | Name of the attacked facility |
| `Country` | Country where the facility is located |
| `Lat`, `Lon` | Geographic coordinates |
| `Date` | Date of the incident (supports multiple formats) |
| `Facility Type` | Oil / Gas / Pipeline |
| `Capacity` | Production/capacity taken offline |
| `Description` | Narrative of the incident |
| `Attack Happened` | TRUE/FALSE — confirmation status |
| `Source URL` | Link to original report |
| `Notes` | Additional context |

---

## Machine Learning & Data Processing

While this project is primarily a visualization platform, it employs several ML-adjacent and data science techniques:

### 1. Fuzzy Date Parsing (Rule-Based NLP)

The incident CSV contains dates in many inconsistent formats. A custom `parseIncidentDate()` function handles:

- ISO format (`2026-03-01`)
- "Month DD, YYYY" / "Month DD YYYY"
- "Month DD–DD, YYYY" (range, uses first date)
- "Late March 2026", "Early April 2026", "Mid May 2026" (approximate)
- "Month YYYY" (defaults to 15th)

This is a **deterministic rule-based parser** — inspired by how production NLP systems handle messy text — rather than a trained ML model, ensuring 100% reproducibility.

### 2. `fetch_incidents.py` — Automated Data Collection Script

Located at `scripts/fetch_incidents.py`, this Python script:
- Scrapes energy incident reports from public sources
- Parses unstructured text into structured CSV rows
- Uses regular expressions and heuristic pattern matching to extract facility names, dates, locations, and damage descriptions

**Dependencies** (in `scripts/requirements.txt`):
```
requests
pandas
openpyxl
python-dotenv
```

The `.env.example` file shows required environment variables for API keys.

### 3. Scheduled Automation — GitHub Actions

`.github/workflows/update-incidents.yml` runs daily to:
1. Execute `fetch_incidents.py` to check for new incidents
2. Append new rows to `DestroyedInfrastructureList.csv`
3. Commit and push changes back to the repository
4. GitHub Pages automatically redeploys the static site

This creates a **self-updating data pipeline** that keeps the map current without manual intervention.

### 4. Data Grouping & Clustering (Spatial)

At render time, the `TimelineController._renderMarkers()` method groups incidents by their lat/lng coordinates using a **hash-based spatial index** (keyed on `lat.toFixed(4) + ',' + lng.toFixed(4)`). Incidents at the exact same coordinates are:

- **Stacked** into a single map marker showing a count badge (e.g. "3")
- **Paginated** in the info card when clicked (previous / next navigation)
- **Opacity-faded** in "Window" mode based on recency (newer = more opaque)

This is analogous to **DBSCAN clustering** at `epsilon ≈ 0.0001°` but implemented efficiently with a hash map rather than a full clustering algorithm.

---

## Architecture & Data Flow

```
┌──────────────────────┐      ┌───────────────────────┐
│   GitHub Actions     │      │      Web Browser      │
│  (daily cron job)    │      │                        │
│                      │      │  ┌──────────────────┐  │
│  fetch_incidents.py  │──────▶  │  index.html       │  │
│  ↓                   │ push  │  ├──────────────────┤  │
│  Update CSV          │      │  │  style.css        │  │
│  ↓                   │      │  ├──────────────────┤  │
│  Commit & Deploy     │      │  │  script.js        │  │
└──────────────────────┘      │  │   ├─ Leaflet map  │  │
                               │  │   ├─ Chart.js    │  │
┌──────────────────────┐      │  │   ├─ PapaParse   │  │
│  Alpha Vantage API   │      │  │   └─ Timeline    │  │
│  (live prices)       │◀─────│  └──────────────────┘  │
└──────────────────────┘      │                        │
                               │  ┌──────────────────┐  │
┌──────────────────────┐      │  │ mapData/         │  │
│  GEM Datasets        │──────▶  │  ├─ *.csv        │  │
│  (pipeline geojson,  │ load  │  │  ├─ *.geojson   │  │
│   projects, fields)  │      │  │  └─ *.xlsx       │  │
└──────────────────────┘      │  └──────────────────┘  │
                               │                        │
┌──────────────────────┐      │  ┌──────────────────┐  │
│  CARTO Dark Matter   │──────▶  │  Map Tiles       │  │
│  (tile server)       │ load  │  └──────────────────┘  │
└──────────────────────┘      └───────────────────────┘
```

### Startup Sequence (`DOMContentLoaded`)

1. **Initialize Price Panel** — starts Alpha Vantage API calls for 4 commodities
2. **Initialize Map** — Leaflet with CARTO Dark Matter tiles, centered on [28, 30] at zoom 3
3. **Load GeoJSON** — pipeline infrastructure (oil, NGL, LPG, other) with color-coded styling
4. **Parse Project CSV** — project-level extraction sites rendered as colored circle markers
5. **Parse Field CSV** — field-level extraction sites as smaller circle markers
6. **Parse Incident CSV** — destroyed infrastructure (flattened to one incident per row)
7. **Timeline Controller** — receives parsed incidents, builds date range, renders initial markers
8. **Wire UI Controls** — play/pause, slider, mode toggle, window selector, jump-to-end

---

## Key Features

### Interactive Map
- World-copy-jump enabled for seamless panning across the date line
- Zoom controls (bottom-right), scale bar
- Collapsible legend with layer toggles for pipelines, projects, fields, and incidents

### Timeline Playback
- **Play/Pause** — animated forward through time
- **Slider** — scrub to any date in the range
- **All Events mode** — cumulative display of all incidents up to the selected date
- **Window mode** — shows only incidents within a configurable recency window (24h, 48h, 7d, 14d) with opacity fade
- Date indicator showing current timeline position
- Tick marks on the slider for each unique incident date

### Price Panel
- Four commodity tabs (WTI, Brent, Henry Hub, TTF)
- Current price + YTD change indicator (green/red)
- Interactive line chart with gradient fill
- Vertical orange dashed lines marking attack dates
- Mouse-wheel zoom + drag-to-pan chart navigation

### Incident Info Card
- Facility name, country, date, capacity, type
- Description and notes
- Confirmed/unconfirmed status
- Source URL link
- Pagination when multiple incidents are stacked at the same location

---

## File Structure

```
EnergyWarMap/
├── index.html                        # Main HTML entry point
├── style.css                         # All CSS (dark theme, components)
├── script.js                         # All JavaScript (map, timeline, prices, cards)
│
├── assets/
│   ├── oil-drill icon.png            # Marker icon: oil
│   ├── gas-icon.png                  # Marker icon: gas
│   └── pipeline-icon.png             # Marker icon: pipeline
│
├── mapData/
│   ├── DestroyedInfrastructureList.csv        # Incident database
│   ├── GEM-GOIT-Oil-NGL-Pipelines-2025-03.geojson  # Pipeline geometries
│   ├── GEM-GOIT-Oil-NGL-Pipelines-2025-03.gpkg     # Pipeline (alternate format)
│   ├── Global-Oil-and-Gas-Extraction-Tracker-March-2026 Project-level main data.csv
│   ├── Global-Oil-and-Gas-Extraction-Tracker-March-2026.xlsx
│   └── Global-Oil-and-Gas-Extraction-Tracker-March-2026.xlsx - Field-level main data.csv
│
├── scripts/
│   ├── fetch_incidents.py            # Automated data scraping
│   ├── add-incidents.js              # Manual incident insertion helper
│   ├── fetch-suggestions.js          # Data suggestion tool
│   ├── package.json                  # Node dependencies (for scripts)
│   ├── requirements.txt              # Python dependencies
│   ├── .env.example                  # Environment variables template
│   └── .gitignore
│
├── .github/workflows/
│   └── update-incidents.yml          # Daily CI/CD pipeline
│
├── README.md                         # Project overview
├── PROJECT_DOCUMENTATION.md          # This file
└── LICENSE                           # Open-source license
```

---

## Running Locally

No build step required. Serve the root directory with any HTTP server:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve .

# Or simply open index.html in a browser (CORS may block CSV loading)
```

Then navigate to `http://localhost:8000` in any modern browser.

---

## Deployment

The project is deployed to **GitHub Pages** at:
`https://millad456.github.io/EnergyWarMap/`

The GitHub Actions workflow automatically redeploys on every push to `main` and runs daily at midnight to check for new incident data.

---

## Future Improvements

- **Real incident classification** — fine-tune a small NLP model (e.g., BERT) to classify incident descriptions by severity, infrastructure type, and attack method
- **Predictive modeling** — train a time-series model (e.g., Prophet, LSTM) on price + incident data to forecast market impact
- **Satellite imagery integration** — overlay recent Sentinel-2 or Planet imagery for affected facilities
- **Mobile optimization** — responsive design improvements for small screens
- **Multi-language support** — i18n for global audience (Ukrainian, Russian, Arabic, etc.)

---

*Documentation prepared for project demonstration purposes. Last updated: June 2026.*
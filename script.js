// ═══════════════════════════════════════════════════════════════════
//  EnergyWarMap — script.js
// ═══════════════════════════════════════════════════════════════════

/* ── 1. ALPHA VANTAGE — LIVE PRICE DATA ───────────────────────────── */
const AV_KEY    = '11JJWBDWYIBP6J8M';
const AV_BASE   = 'https://www.alphavantage.co/query';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Commodity config: avFn = null means not on AV free tier (TTF)
const COMMODITY_META = {
    wti:   { label: 'WTI Crude',   unit: '$/bbl',   color: '#ffb900', avFn: 'WTI'         },
    brent: { label: 'Brent Crude', unit: '$/bbl',   color: '#f97316', avFn: 'BRENT'       },
    henry: { label: 'Henry Hub',   unit: '$/MMBtu', color: '#22c55e', avFn: 'NATURAL_GAS' },
    ttf:   { label: 'TTF / NBP',   unit: '\u20ac/MWh', color: '#3b82f6', avFn: null       }
};

// Fallback hardcoded values (used if API fails / rate-limited)
const FALLBACK_LABELS = (() => {
    const labels = [];
    const start = new Date('2026-01-06');
    for (let i = 0; i < 115; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        labels.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    }
    return labels;
})();

const FALLBACK = {
    wti: {
        labels: FALLBACK_LABELS,
        values: [
            73.2, 73.8, 74.2, 74.5, 74.8, 74.3, 75.0, 75.6, 76.1, 75.8,
            75.2, 74.9, 74.5, 74.1, 73.5, 73.0, 72.6, 72.2, 72.0, 71.8,
            71.5, 71.1, 70.8, 70.6, 70.4, 70.1, 69.8, 69.4, 69.1, 68.9,
            68.6, 68.2, 67.9, 67.4, 67.0, 66.5, 66.0, 65.6, 65.3, 65.0,
            64.7, 64.3, 64.0, 63.5, 63.1, 62.9, 62.7, 62.4, 62.1, 61.8,
            61.5, 61.2, 60.8, 60.5, 60.1, 59.8, 59.5, 59.1, 58.8, 58.5,
            58.2, 57.9, 57.6, 57.4, 57.1, 56.8, 56.5, 56.2, 56.5, 56.9,
            57.3, 57.8, 58.2, 58.6, 58.9, 59.2, 59.6, 60.0, 60.4, 60.8,
            61.1, 61.4, 61.5, 61.7, 61.9, 62.1, 62.3, 62.5, 62.7, 62.9,
            63.0, 62.9, 62.8, 62.7, 62.6, 62.5, 62.4, 62.3, 62.2, 62.1,
            62.0, 61.9, 61.8, 61.7, 61.6, 61.5, 61.4, 61.3, 62.0, 62.1,
            62.1, 62.1, 62.1, 62.1, 62.1
        ]
    },
    brent: {
        labels: FALLBACK_LABELS,
        values: [
            76.5, 77.1, 77.5, 77.8, 78.2, 77.9, 78.5, 79.0, 79.4, 79.1,
            78.5, 78.2, 77.8, 77.4, 76.8, 76.3, 75.9, 75.5, 75.1, 74.9,
            74.6, 74.2, 73.9, 73.7, 73.6, 73.3, 73.0, 72.6, 72.3, 72.0,
            71.7, 71.3, 71.0, 70.5, 70.1, 69.6, 69.1, 68.7, 68.4, 68.1,
            67.8, 67.4, 67.1, 66.6, 66.2, 66.0, 65.9, 65.6, 65.3, 65.0,
            64.7, 64.4, 64.0, 63.7, 63.2, 62.9, 62.6, 62.2, 61.8, 61.5,
            61.2, 60.9, 60.6, 60.5, 60.2, 59.9, 59.6, 59.1, 59.4, 59.8,
            60.2, 60.7, 61.1, 61.5, 61.8, 62.1, 62.5, 62.9, 63.3, 63.7,
            64.0, 64.3, 64.4, 64.6, 64.8, 65.0, 65.2, 65.4, 65.6, 65.8,
            66.0, 65.9, 65.8, 65.7, 65.6, 65.5, 65.4, 65.3, 65.2, 65.1,
            65.0, 64.9, 64.8, 64.7, 64.6, 64.5, 64.4, 64.3, 65.0, 65.2,
            65.2, 65.2, 65.2, 65.2, 65.2
        ]
    },
    henry: {
        labels: FALLBACK_LABELS,
        values: [
            3.42, 3.55, 3.68, 3.82, 4.10, 4.35, 4.58, 4.72, 4.85, 4.71,
            4.60, 4.48, 4.35, 4.52, 4.52, 4.40, 4.28, 4.15, 4.20, 4.12,
            4.05, 3.98, 3.95, 3.88, 3.95, 3.88, 3.82, 3.76, 3.78, 3.72,
            3.66, 3.60, 3.61, 3.55, 3.52, 3.48, 3.44, 3.48, 3.48, 3.44,
            3.40, 3.38, 3.35, 3.32, 3.35, 3.30, 3.28, 3.26, 3.22, 3.20,
            3.18, 3.16, 3.22, 3.28, 3.35, 3.38, 3.42, 3.48, 3.55, 3.50,
            3.48, 3.52, 3.55, 3.55, 3.58, 3.62, 3.66, 3.71, 3.72, 3.75,
            3.78, 3.82, 3.85, 3.88, 3.88, 3.90, 3.92, 3.94, 3.96, 3.98,
            4.00, 4.02, 4.02, 4.01, 4.00, 3.99, 3.98, 3.97, 3.96, 3.95,
            3.94, 3.93, 3.92, 3.91, 3.90, 3.89, 3.88, 3.87, 3.85, 3.83,
            3.82, 3.81, 3.80, 3.79, 3.78, 3.77, 3.76, 3.75, 3.81, 3.81,
            3.81, 3.81, 3.81, 3.81, 3.81
        ]
    },
    ttf: {
        labels: FALLBACK_LABELS,
        values: [
            38.5, 39.2, 40.1, 41.0, 42.1, 43.2, 44.8, 46.2, 47.8, 47.0,
            46.1, 45.2, 44.5, 45.2, 45.2, 44.3, 43.5, 42.6, 40.6, 40.0,
            39.4, 38.8, 37.9, 37.4, 37.9, 37.4, 36.9, 36.3, 35.4, 35.0,
            34.6, 34.1, 33.8, 33.4, 33.1, 32.8, 32.5, 32.2, 32.1, 31.8,
            31.5, 31.2, 30.5, 30.2, 30.5, 30.0, 29.8, 29.6, 29.8, 29.4,
            29.1, 28.9, 29.2, 29.6, 30.5, 30.2, 30.5, 31.0, 31.4, 31.1,
            30.9, 31.2, 31.5, 31.4, 31.8, 32.2, 32.6, 33.9, 34.2, 34.6,
            35.0, 35.4, 35.8, 36.2, 36.2, 36.6, 37.0, 37.4, 37.8, 38.2,
            38.5, 38.7, 38.8, 38.9, 39.0, 39.1, 39.2, 39.3, 39.4, 39.5,
            39.6, 39.5, 39.4, 39.3, 39.2, 39.1, 39.0, 38.9, 38.7, 38.5,
            38.3, 38.1, 37.9, 37.7, 37.5, 37.3, 37.1, 36.9, 39.0, 39.4,
            39.4, 39.4, 39.4, 39.4, 39.4
        ]
    }
};

// Live store — populated by loadAllPrices()
const PRICE_DATA = { wti: null, brent: null, henry: null, ttf: null };

// Format a Date to match chart label style: "6 Jan"
function fmtLabel(d) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Fetch one commodity; returns {labels, values, source}
async function fetchCommodity(key) {
    const meta = COMMODITY_META[key];
    const start = new Date('2026-01-06');

    if (!meta.avFn) return { ...FALLBACK[key], source: 'indicative' };

    const cacheKey = 'av_' + key;
    try {
        const c = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (c && (Date.now() - c.ts) < CACHE_TTL)
            return { labels: c.labels, values: c.values, source: 'cache' };
    } catch (_) {}

    try {
        const url = AV_BASE + '?function=' + meta.avFn + '&interval=daily&apikey=' + AV_KEY;
        const res  = await fetch(url);
        const json = await res.json();
        const raw  = json.data;
        if (!Array.isArray(raw)) throw new Error(json['Information'] || json['Note'] || 'bad response');

        const filtered = raw
            .filter(d => new Date(d.date) >= start && d.value !== '.' && d.value !== '')
            .reverse();
        if (!filtered.length) throw new Error('empty after filter');

        const labels = filtered.map(d => fmtLabel(new Date(d.date)));
        const values = filtered.map(d => parseFloat(d.value));
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), labels, values }));
        console.log('[AV] ' + key + ' live: ' + values.length + ' points');
        return { labels, values, source: 'live' };
    } catch (err) {
        console.warn('[AV] ' + key + ' failed (' + err.message + ') — fallback');
        return { ...FALLBACK[key], source: 'fallback' };
    }
}

async function loadAllPrices() {
    setLoading(true);
    const keys    = ['wti', 'brent', 'henry', 'ttf'];
    const results = await Promise.all(keys.map(k => fetchCommodity(k)));
    keys.forEach((k, i) => { PRICE_DATA[k] = results[i]; });
    setLoading(false);
    buildPriceChart(activeCommodity);
}

function setLoading(loading) {
    const wrap = document.getElementById('price-chart-wrap');
    if (wrap) wrap.style.opacity = loading ? '0.35' : '1';
    const hint = document.getElementById('chart-zoom-hint');
    if (hint) hint.style.display = loading ? 'none' : 'flex';
    const src = document.getElementById('price-source-tag');
    if (src) {
        src.textContent = loading ? 'Loading live data...' : '';
        src.className = 'price-source-tag loading';
    }
}

// Attack dates → indices resolved against loaded labels
const ATTACK_DATES = [
    '2026-02-26','2026-03-01','2026-03-02','2026-03-09','2026-03-14',
    '2026-03-16','2026-03-18','2026-03-19','2026-03-22','2026-03-26',
    '2026-03-29','2026-04-01','2026-04-03','2026-04-05','2026-04-07',
    '2026-04-08','2026-04-09','2026-04-14','2026-04-16','2026-04-19',
    '2026-04-20'
];
let attackIndices = [];


/* ── 2. PRICE PANEL LOGIC ─────────────────────────────────────────── */
let priceChart = null;
let activeCommodity = 'wti';

// Chart.js plugin — draw orange vertical lines at attack dates
const attackLinesPlugin = {
    id: 'attackLines',
    afterDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;
        const xScale = scales.x;
        ctx.save();
        attackIndices.forEach(idx => {
            const xPx = xScale.getPixelForValue(idx);
            if (xPx < chartArea.left || xPx > chartArea.right) return;
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 140, 0, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 4]);
            ctx.moveTo(xPx, chartArea.top);
            ctx.lineTo(xPx, chartArea.bottom);
            ctx.stroke();
        });
        ctx.restore();
        ctx.setLineDash([]);
    }
};
Chart.register(attackLinesPlugin);

function buildPriceChart(commodity) {
    const entry = PRICE_DATA[commodity];
    if (!entry) return; // still loading

    const meta = COMMODITY_META[commodity];
    const { labels, values, source } = entry;
    const first = values[0];
    const last = values[values.length - 1];
    const delta = last - first;
    const pct = ((delta / first) * 100).toFixed(1);
    const isUp = delta >= 0;

    document.getElementById('price-value').childNodes[0].textContent = last.toFixed(2);
    document.getElementById('price-unit').textContent = meta.unit;
    const deltaEl = document.getElementById('price-delta');
    deltaEl.textContent = (isUp ? '+' : '') + delta.toFixed(2) + ' (' + (isUp ? '+' : '') + pct + '%)';
    deltaEl.className = 'price-delta ' + (isUp ? 'up' : 'down');

    // Resolve attack line positions against this dataset's actual labels
    attackIndices = ATTACK_DATES
        .map(iso => fmtLabel(new Date(iso)))
        .map(lbl => labels.indexOf(lbl))
        .filter(i => i >= 0);

    // Source badge
    const srcTag = document.getElementById('price-source-tag');
    if (srcTag) {
        const txt = source === 'live'      ? 'Live • Alpha Vantage'
                  : source === 'cache'     ? 'Cached • Alpha Vantage'
                  : source === 'fallback'  ? 'API unavailable • indicative'
                  :                          'Indicative data';
        srcTag.textContent = txt;
        srcTag.className   = 'price-source-tag' + (source === 'live' || source === 'cache' ? ' live' : ' stale');
    }

    const ctx = document.getElementById('price-chart').getContext('2d');
    const gradientFill = ctx.createLinearGradient(0, 0, 0, 180);
    gradientFill.addColorStop(0, meta.color + '35');
    gradientFill.addColorStop(1, meta.color + '00');

    const allMin = Math.min(...values);
    const allMax = Math.max(...values);
    const pad = (allMax - allMin) * 0.15;

    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                borderColor: meta.color,
                borderWidth: 2,
                backgroundColor: gradientFill,
                fill: true,
                tension: 0.4,
                pointRadius: values.length > 60 ? 0 : 3,
                pointBackgroundColor: meta.color,
                pointBorderColor: '#0a0e1a',
                pointBorderWidth: 1.5,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: meta.color,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10,14,26,0.97)',
                    borderColor: meta.color + '80',
                    borderWidth: 1,
                    titleColor: '#8b9abd',
                    bodyColor: '#f0f4ff',
                    titleFont: { family: 'Inter', size: 11 },
                    bodyFont: { family: 'JetBrains Mono', size: 12, weight: 'bold' },
                    padding: 10,
                    callbacks: {
                        afterTitle: (items) => {
                            const idx = items[0].dataIndex;
                            return attackIndices.includes(idx) ? '⚠ Attack reported' : '';
                        },
                        label: (item) => ' ' + item.parsed.y.toFixed(2) + ' ' + meta.unit
                    }
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: true, speed: 0.08 },
                        pinch: { enabled: true },
                        mode: 'x'
                    },
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    limits: {
                        x: { min: 'original', max: 'original', minRange: 3 }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        color: '#4b5675',
                        font: { family: 'JetBrains Mono', size: 9 },
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 9
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.04)',
                        drawBorder: false
                    },
                    border: { color: 'rgba(255,255,255,0.08)' }
                },
                y: {
                    display: true,
                    position: 'left',
                    min: Math.floor(allMin - pad),
                    max: Math.ceil(allMax + pad),
                    ticks: {
                        color: '#4b5675',
                        font: { family: 'JetBrains Mono', size: 9 },
                        maxTicksLimit: 5,
                        callback: (v) => v.toFixed(1)
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.05)',
                        drawBorder: false
                    },
                    border: { color: 'rgba(255,255,255,0.08)', dash: [3, 3] }
                }
            }
        }
    };

    if (priceChart) {
        priceChart.destroy();
        priceChart = null;
    }
    priceChart = new Chart(ctx, chartConfig);
}

function initPricePanel() {
    const panel = document.getElementById('price-panel');
    const header = document.getElementById('price-panel-header');
    const toggle = document.getElementById('price-panel-toggle');
    const tabs = document.getElementById('commodity-tabs');
    let loaded = true; // since we load it immediately

    // Load data immediately on startup
    loadAllPrices();

    header.addEventListener('click', () => {
        const mini = panel.classList.toggle('minimized');
        toggle.textContent = mini ? '\u25be' : '\u25b4';
        if (!mini) {
            setTimeout(() => buildPriceChart(activeCommodity), 50);
        }
    });

    tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.commodity-tab');
        if (!btn) return;
        tabs.querySelectorAll('.commodity-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCommodity = btn.dataset.commodity;
        buildPriceChart(activeCommodity);
    });

    // Reset zoom button
    const resetBtn = document.getElementById('chart-reset-zoom');
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (priceChart) priceChart.resetZoom();
        });
    }
}

/* ── 3. INCIDENT INFO CARD ────────────────────────────────────────── */
const incidentCard = document.getElementById('incident-card');
const icClose = document.getElementById('incident-card-close');

function showIncidentCard(row) {
    document.getElementById('ic-facility').textContent = row.Facility || 'Unknown Facility';
    document.getElementById('ic-country').textContent = row.Country || '—';
    document.getElementById('ic-date').textContent = row.Date || '—';
    document.getElementById('ic-capacity').textContent = row.Capacity || '—';
    document.getElementById('ic-description').textContent = row.Description || 'No description available.';
    document.getElementById('ic-type').textContent = row['Facility Type'] || '—';

    // Notes field
    const notesEl = document.getElementById('ic-notes');
    const notes = (row.Notes || '').trim();
    if (notes && notes !== '' && notes !== 'No info found') {
        notesEl.textContent = notes;
        notesEl.parentElement.style.display = 'flex';
    } else {
        notesEl.parentElement.style.display = 'none';
    }

    // Status (no confirmed badge — just label)
    const confirmed = (row['Attack Happened'] || '').trim().toUpperCase() === 'TRUE';
    document.getElementById('ic-status').textContent = confirmed ? 'Confirmed' : 'Unconfirmed';

    // Source: plain URL text
    const srcLink = document.getElementById('ic-source-link');
    const src = (row['Source URL'] || '').trim();
    if (src && src.startsWith('http')) {
        srcLink.href = src;
        srcLink.textContent = src;
        srcLink.style.display = 'block';
    } else {
        srcLink.style.display = 'none';
    }

    incidentCard.classList.add('visible');
}

icClose.addEventListener('click', () => {
    incidentCard.classList.remove('visible');
});

/* ── 4. ICON + MARKER HELPERS ─────────────────────────────────────── */
// Normalise Facility Type to one of: 'Oil' | 'Gas' | 'Pipeline'
function normaliseFacilityType(raw) {
    const t = (raw || '').toLowerCase().trim();
    if (t.includes('pipeline')) return 'Pipeline';
    if (t.includes('gas')) return 'Gas';
    return 'Oil';
}

// All incident markers are uniformly orange — icons distinguish type
function getMarkerConfig(facilityType) {
    const t = normaliseFacilityType(facilityType);
    if (t === 'Pipeline') {
        return { icon: './assets/pipeline-icon.png', animName: 'Orange' };
    }
    if (t === 'Gas') {
        return { icon: './assets/gas-icon.png', animName: 'Orange' };
    }
    return { icon: './assets/oil-drill icon.png', animName: 'Orange' };
}

// Build a custom DivIcon — coloured circle with icon inside + glow pulse
function makeIncidentIcon(facilityType) {
    const cfg = getMarkerConfig(facilityType);
    const size = 36;
    // Uniform orange for all attack markers
    const dotColor = '#f97316';
    const glowColor = '249,115,22';

    const html = `
        <div class="incident-marker" style="
            width:${size}px; height:${size}px;
            background:${dotColor};
            border-radius:50%;
            border: 2px solid rgba(255,255,255,0.35);
            display:flex; align-items:center; justify-content:center;
            position:relative;
            box-shadow: 0 0 0 0 rgba(${glowColor}, 0.7);
            animation: marker-glow-Orange 2s ease-in-out infinite;
        ">
            <img src="${cfg.icon}" style="
                width:${size * 0.58}px; height:${size * 0.58}px;
                object-fit:contain;
                filter: brightness(0) invert(1);
                pointer-events:none;
                display:block;
            " />
        </div>`;

    return L.divIcon({
        html,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
}

/* ── 5. MAP INITIALISATION ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, initialising map…');

    initPricePanel();

    /* -- MAP -- */
    var map = L.map('map', {
        worldCopyJump: true,
        zoomControl: false
    }).setView([28, 30], 3);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // CartoDB Dark Matter — free, unrestricted dark theme map.
    // Note: Replaced Stadia Maps due to 401 Unauthorized on GitHub Pages. 
    // CartoDB mostly uses English labels.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
    }).addTo(map);


    /* -- LAYER GROUPS -- */
    var layers = {
        pipelines: {
            oil: L.layerGroup(),
            ngl: L.layerGroup(),
            lpg: L.layerGroup(),
            other: L.layerGroup()
        },
        projects: {
            oil: L.layerGroup().addTo(map),
            gas: L.layerGroup().addTo(map),
            other: L.layerGroup().addTo(map)
        },
        fields: {
            oil: L.layerGroup().addTo(map),
            gas: L.layerGroup().addTo(map),
            other: L.layerGroup().addTo(map)
        },
        destroyed: L.layerGroup().addTo(map)
    };

    /* ── LEGEND ──────────────────────────────────────────────────── */
    var legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
        var div = L.DomUtil.create('div', 'legend');
        div.id = 'map-legend';
        div.innerHTML =
            '<div class="legend-header" id="legend-header">' +
            '<span>Map Legend</span>' +
            '<span class="toggle-icon">▾</span>' +
            '</div>' +
            '<div class="legend-content">' +
            '<h4>Disruptions</h4>' +
            '<div class="legend-item"><input type="checkbox" id="ext-destroyed" checked>' +
            '<span class="inc-swatch all-incident-swatch"></span>Damaged / Destroyed</div>' +
            '<h4>Pipelines</h4>' +
            '<div class="legend-item"><input type="checkbox" id="pipe-oil"> <span class="color-key" style="background:#e74c3c;opacity:0.7"></span>Oil Pipelines</div>' +
            '<div class="legend-item"><input type="checkbox" id="pipe-ngl"> <span class="color-key" style="background:#3498db;opacity:0.7"></span>NGL Pipelines</div>' +
            '<div class="legend-item"><input type="checkbox" id="pipe-lpg"> <span class="color-key" style="background:#f1c40f;opacity:0.7"></span>LPG Pipelines</div>' +
            '<div class="legend-item"><input type="checkbox" id="pipe-other"> <span class="color-key" style="background:#94a3b8;opacity:0.7"></span>Other Pipelines</div>' +
            '<h4>Projects (Large)</h4>' +
            '<div class="legend-item"><input type="checkbox" id="proj-oil" checked> <span class="color-key circle" style="background:#c0392b"></span>Oil Projects</div>' +
            '<div class="legend-item"><input type="checkbox" id="proj-gas" checked> <span class="color-key circle" style="background:#27ae60"></span>Gas Projects</div>' +
            '<div class="legend-item"><input type="checkbox" id="proj-other" checked> <span class="color-key circle" style="background:#8e44ad"></span>Other / Mixed</div>' +
            '<h4>Fields (Small)</h4>' +
            '<div class="legend-item"><input type="checkbox" id="field-oil" checked> <span class="color-key circle" style="background:#c0392b;width:8px;height:8px;margin-left:4px;margin-right:12px"></span>Oil Fields</div>' +
            '<div class="legend-item"><input type="checkbox" id="field-gas" checked> <span class="color-key circle" style="background:#27ae60;width:8px;height:8px;margin-left:4px;margin-right:12px"></span>Gas Fields</div>' +
            '<div class="legend-item"><input type="checkbox" id="field-other" checked> <span class="color-key circle" style="background:#8e44ad;width:8px;height:8px;margin-left:4px;margin-right:12px"></span>Other Fields</div>' +
            '</div>';
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        return div;
    };
    legend.addTo(map);

    /* ── LEGEND CONTROLS ─────────────────────────────────────────── */
    function setupControls() {
        var header = document.getElementById('legend-header');
        var legendDiv = document.getElementById('map-legend');
        header.addEventListener('click', function () {
            legendDiv.classList.toggle('collapsed');
        });

        var toggleMap = {
            'pipe-oil': layers.pipelines.oil,
            'pipe-ngl': layers.pipelines.ngl,
            'pipe-lpg': layers.pipelines.lpg,
            'pipe-other': layers.pipelines.other,
            'proj-oil': layers.projects.oil,
            'proj-gas': layers.projects.gas,
            'proj-other': layers.projects.other,
            'field-oil': layers.fields.oil,
            'field-gas': layers.fields.gas,
            'field-other': layers.fields.other,
            'ext-destroyed': layers.destroyed
        };

        Object.keys(toggleMap).forEach(function (id) {
            var cb = document.getElementById(id);
            if (!cb) return;
            cb.addEventListener('change', function () {
                this.checked ? map.addLayer(toggleMap[id]) : map.removeLayer(toggleMap[id]);
            });
        });
    }
    setupControls();

    /* ── PIPELINES ───────────────────────────────────────────────── */
    fetch('./mapData/GEM-GOIT-Oil-NGL-Pipelines-2025-03.geojson')
        .then(r => r.json())
        .then(data => {
            L.geoJSON(data, {
                style: function (feature) {
                    var fuel = feature.properties.Fuel || 'Unknown';
                    var color = '#94a3b8';
                    if (fuel.includes('Oil')) color = '#e74c3c';
                    else if (fuel.includes('NGL')) color = '#3498db';
                    else if (fuel.includes('LPG')) color = '#f1c40f';
                    return { color, weight: 1.5, opacity: 0.55 };
                },
                onEachFeature: function (feature, layer) {
                    if (!feature.properties) return;
                    var p = feature.properties;
                    layer.bindPopup(
                        '<strong>' + (p.PipelineName || 'Unnamed Pipeline') + '</strong><br>' +
                        'Fuel: ' + (p.Fuel || 'N/A') + '<br>' +
                        'Status: ' + (p.Status || 'N/A') + '<br>' +
                        'Countries: ' + (p.Countries || 'N/A')
                    );
                    var fuel = p.Fuel || '';
                    if (fuel.includes('Oil')) layer.addTo(layers.pipelines.oil);
                    else if (fuel.includes('NGL')) layer.addTo(layers.pipelines.ngl);
                    else if (fuel.includes('LPG')) layer.addTo(layers.pipelines.lpg);
                    else layer.addTo(layers.pipelines.other);
                }
            });
        })
        .catch(() => console.warn('Pipeline GeoJSON not found – skipping.'));

    /* ── PROJECT EXTRACTION CSV ──────────────────────────────────── */
    Papa.parse('./mapData/Global-Oil-and-Gas-Extraction-Tracker-March-2026 Project-level main data.csv', {
        download: true, header: true,
        complete: function (results) {
            results.data.forEach(function (row) {
                var lat = parseFloat(row.Latitude);
                var lng = parseFloat(row.Longitude);
                if (isNaN(lat) || isNaN(lng)) return;
                var fuel = (row['Fuel type'] || '').toLowerCase();
                var color = fuel.includes('oil') ? '#c0392b' : (fuel.includes('gas') ? '#27ae60' : '#8e44ad');
                var marker = L.circleMarker([lat, lng], {
                    radius: 5.5, fillColor: color, color: 'rgba(255,255,255,0.3)',
                    weight: 1, opacity: 1, fillOpacity: 0.75
                });
                var popup = '<strong>Project: ' + (row['Project Name'] || 'Unnamed') + '</strong><br>' +
                    'Type: ' + (row['Fuel type'] || 'N/A') + '<br>' +
                    'Status: ' + (row['Status'] || 'N/A');
                if (row['Wiki URL (project)']) popup += '<br><a href="' + row['Wiki URL (project)'] + '" target="_blank">GEM Wiki ↗</a>';
                marker.bindPopup(popup);
                if (fuel.includes('oil')) marker.addTo(layers.projects.oil);
                else if (fuel.includes('gas')) marker.addTo(layers.projects.gas);
                else marker.addTo(layers.projects.other);
            });
        }
    });

    /* ── FIELD EXTRACTION CSV ────────────────────────────────────── */
    Papa.parse('./mapData/Global-Oil-and-Gas-Extraction-Tracker-March-2026.xlsx - Field-level main data.csv', {
        download: true, header: true,
        complete: function (results) {
            results.data.forEach(function (row) {
                var lat = parseFloat(row.Latitude);
                var lng = parseFloat(row.Longitude);
                if (isNaN(lat) || isNaN(lng)) return;
                var fuel = (row['Fuel type'] || '').toLowerCase();
                var color = fuel.includes('oil') ? '#c0392b' : (fuel.includes('gas') ? '#27ae60' : '#8e44ad');
                var marker = L.circleMarker([lat, lng], {
                    radius: 3, fillColor: color, color: 'rgba(255,255,255,0.2)',
                    weight: 1, opacity: 1, fillOpacity: 0.55
                });
                var popup = '<strong>Field: ' + (row['Unit Name'] || 'Unnamed') + '</strong><br>' +
                    'Type: ' + (row['Fuel type'] || 'N/A') + '<br>' +
                    'Status: ' + (row['Status'] || 'N/A');
                if (row['Wiki URL (field)']) popup += '<br><a href="' + row['Wiki URL (field)'] + '" target="_blank">GEM Wiki ↗</a>';
                marker.bindPopup(popup);
                if (fuel.includes('oil')) marker.addTo(layers.fields.oil);
                else if (fuel.includes('gas')) marker.addTo(layers.fields.gas);
                else marker.addTo(layers.fields.other);
            });
        }
    });

    /* ── DESTROYED INFRASTRUCTURE CSV ───────────────────────────── */
    // New schema: Country, Facility, Facility Type, Lat, Lon,
    //             Description, Date, Capacity, Source URL,
    //             Attack Happened, Notes
    // Row 0 in the CSV is an empty header row — Papa skips it when
    // header:true is used and we skipEmptyLines.
    var incidentCount = 0;

    Papa.parse('./mapData/DestroyedInfrastructureList.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,
        // The CSV starts with a junk row of bare commas (,,,,,,,,,).
        // PapaParse reads the FIRST non-whitespace line as the header,
        // so that junk row becomes the header and the real column names
        // end up as data. Strip it here before parsing begins.
        beforeFirstChunk: function (chunk) {
            var lines = chunk.split('\n');
            // Remove lines that contain no real text (only commas/spaces)
            while (lines.length && lines[0].replace(/[,\s]/g, '') === '') {
                lines.shift();
            }
            return lines.join('\n');
        },
        complete: function (results) {
            var rows = results.data.filter(function (row) {
                return row.Facility && row.Facility.trim() !== '' && row.Facility !== 'Facility';
            });

            rows.forEach(function (row) {
                // Use the new Lat / Lon column names
                var lat = parseFloat(row.Lat);
                var lng = parseFloat(row.Lon);
                if (isNaN(lat) || isNaN(lng)) return;

                incidentCount++;

                var facilityType = (row['Facility Type'] || 'Oil').trim();
                var icon = makeIncidentIcon(facilityType);

                var marker = L.marker([lat, lng], { icon, title: row.Facility });

                // Click → custom card (no default popup)
                marker.on('click', function (e) {
                    L.DomEvent.stopPropagation(e);
                    showIncidentCard(row);
                });

                marker.addTo(layers.destroyed);
            });

            document.getElementById('badge-count').textContent =
                incidentCount + ' Incident' + (incidentCount !== 1 ? 's' : '');
        }
    });

    L.control.scale({ metric: true, imperial: true, position: 'bottomright' }).addTo(map);
});
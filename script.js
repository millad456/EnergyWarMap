// ═══════════════════════════════════════════════════════════════════
//  EnergyWarMap — script.js
// ═══════════════════════════════════════════════════════════════════

/* ── 1. ALPHA VANTAGE — LIVE PRICE DATA ───────────────────────────── */
// ⚠ Alpha Vantage API key — exposed client-side because this is a static site.
//    For production, proxy through a serverless function.
const AV_KEY = '11JJWBDWYIBP6J8M';
const AV_BASE = 'https://www.alphavantage.co/query';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── Named constants ─────────────────────────────────────────────
const DAY_MS = 1000 * 60 * 60 * 24;
const SLIDER_STEP = 0.5;
const COORD_PRECISION = 4;
const MARKER_SIZE = 36;
const MARKER_ICON_RATIO = 0.58;
const WINDOW_FADE_THRESHOLD = 0.5;

// Commodity config: avFn = null means not on AV free tier (TTF)
const COMMODITY_META = {
    wti: { label: 'WTI Crude', unit: '$/bbl', color: '#ffb900', avFn: 'WTI' },
    brent: { label: 'Brent Crude', unit: '$/bbl', color: '#f97316', avFn: 'BRENT' },
    henry: { label: 'Henry Hub', unit: '$/MMBtu', color: '#22c55e', avFn: 'NATURAL_GAS' },
    ttf: { label: 'TTF / NBP', unit: '\u20ac/MWh', color: '#3b82f6', avFn: null }
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
    } catch (_) { }

    try {
        const url = AV_BASE + '?function=' + meta.avFn + '&interval=daily&apikey=' + AV_KEY;
        const res = await fetch(url);
        const json = await res.json();
        const raw = json.data;
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
        console.warn('[AV] ' + key + ' failed (' + err.message + ') - fallback');
        return { ...FALLBACK[key], source: 'fallback' };
    }
}

async function loadAllPrices() {
    setLoading(true);
    const keys = ['wti', 'brent', 'henry', 'ttf'];
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
// Populated dynamically from CSV after parse — also accepts hardcoded seed dates
var ATTACK_DATES = [
    '2026-02-26', '2026-03-01', '2026-03-02', '2026-03-09', '2026-03-14',
    '2026-03-16', '2026-03-18', '2026-03-19', '2026-03-22', '2026-03-26',
    '2026-03-29', '2026-04-01', '2026-04-03', '2026-04-05', '2026-04-07',
    '2026-04-08', '2026-04-09', '2026-04-14', '2026-04-16', '2026-04-19',
    '2026-04-20', '2026-04-25', '2026-04-28',
    '2026-06-10', '2026-06-16', '2026-06-18', '2026-06-20', '2026-06-21',
    '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28'
];
let attackIndices = [];

/** Extract unique dates from parsed incidents and add them to ATTACK_DATES */
function updateAttackDates(incidents) {
    var seen = {};
    for (var i = 0; i < ATTACK_DATES.length; i++) {
        seen[ATTACK_DATES[i]] = true;
    }
    for (var i = 0; i < incidents.length; i++) {
        var iso = fmtDateShort(incidents[i].date);
        if (iso && iso !== '—' && !seen[iso]) {
            // Try to get the original YYYY-MM-DD from the CSV row
            var rawDate = (incidents[i].row.Date || '').trim();
            if (rawDate && !seen[rawDate]) {
                ATTACK_DATES.push(rawDate);
                seen[rawDate] = true;
            }
        }
    }
    // Rebuild chart if it exists
    if (priceChart) {
        buildPriceChart(activeCommodity);
    }
}


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
        const txt = source === 'live' ? 'Live • Alpha Vantage'
            : source === 'cache' ? 'Cached • Alpha Vantage'
                : source === 'fallback' ? 'API unavailable • indicative'
                    : 'Indicative data';
        srcTag.textContent = txt;
        srcTag.className = 'price-source-tag' + (source === 'live' || source === 'cache' ? ' live' : ' stale');
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

    // Load data immediately on startup
    loadAllPrices();

    header.addEventListener('click', () => {
        const mini = panel.classList.toggle('minimized');
        toggle.textContent = mini ? '\u25be' : '\u25b4';
        if (!mini) {
            setTimeout(() => buildPriceChart(activeCommodity), 50);
        }
        // Slide the incident log panel alongside the price panel
        var ilp = document.getElementById('incident-log-panel');
        if (ilp) {
            // When price panel is minimized (~200px wide), ILP sits at ~230px right
            // When expanded (360px), ILP sits at 390px right (14px margin + 360px + 16px gap)
            ilp.style.right = mini ? '230px' : '390px';
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

let currentIncidentRows = [];
let currentIncidentIndex = 0;

function updateIncidentCardPage(row, index, total) {
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

    // Status
    const confirmed = (row['Attack Happened'] || '').trim().toUpperCase() === 'TRUE';
    document.getElementById('ic-status').textContent = confirmed ? 'Confirmed' : 'Unconfirmed';

    // Source URL
    const srcLink = document.getElementById('ic-source-link');
    const src = (row['Source URL'] || '').trim();
    if (src && src.startsWith('http')) {
        srcLink.href = src;
        srcLink.textContent = src;
        srcLink.style.display = 'block';
    } else {
        srcLink.style.display = 'none';
    }

    // Pagination
    const pagDiv = document.getElementById('ic-pagination');
    const pagInfo = document.getElementById('ic-pag-info');
    if (total > 1) {
        pagDiv.style.display = 'flex';
        pagInfo.textContent = (index + 1) + '/' + total;
        document.getElementById('ic-prev').disabled = (index === 0);
        document.getElementById('ic-next').disabled = (index === total - 1);
    } else {
        pagDiv.style.display = 'none';
    }
}

function showIncidentCard(rows) {
    if (!Array.isArray(rows)) rows = [rows];
    currentIncidentRows = rows;
    currentIncidentIndex = 0;
    updateIncidentCardPage(rows[0], 0, rows.length);
    incidentCard.classList.add('visible');
}

function showIncidentCardIndex(index) {
    if (!currentIncidentRows.length) return;
    currentIncidentIndex = index;
    updateIncidentCardPage(currentIncidentRows[index], index, currentIncidentRows.length);
    incidentCard.classList.add('visible');
}

icClose.addEventListener('click', () => {
    incidentCard.classList.remove('visible');
});

// Pagination button handlers
document.getElementById('ic-prev').addEventListener('click', function (e) {
    e.preventDefault();
    if (currentIncidentIndex > 0) showIncidentCardIndex(currentIncidentIndex - 1);
});
document.getElementById('ic-next').addEventListener('click', function (e) {
    e.preventDefault();
    if (currentIncidentIndex < currentIncidentRows.length - 1) showIncidentCardIndex(currentIncidentIndex + 1);
});

/* ── 4. ICON + MARKER HELPERS ─────────────────────────────────────── */
// Normalise Facility Type to one of: 'Oil' | 'Gas' | 'Pipeline'
function normaliseFacilityType(raw) {
    const t = (raw || '').toLowerCase().trim();
    if (t.includes('pipeline')) return 'Pipeline';
    if (t.includes('gas station') || t === 'gas station') return 'Gas Station';
    if (t.includes('gas')) return 'Gas';
    return 'Oil';
}

// All incident markers are uniformly orange — icons distinguish type
function getMarkerConfig(facilityType) {
    const t = normaliseFacilityType(facilityType);
    if (t === 'Gas Station') {
        return { icon: './assets/gas-station-icon.png', animName: 'Orange' };
    }
    if (t === 'Pipeline') {
        return { icon: './assets/pipeline-icon.png', animName: 'Orange' };
    }
    if (t === 'Gas') {
        return { icon: './assets/gas-icon.png', animName: 'Orange' };
    }
    return { icon: './assets/oil-drill icon.png', animName: 'Orange' };
}

// Build a custom DivIcon — coloured circle with icon inside + glow pulse
// count: optional number > 1 shows a strike-count badge on the icon
// opacity: 0..1 (default 1), used for window-mode fading
function makeIncidentIcon(facilityType, count, opacity) {
    if (opacity === undefined || opacity === null) opacity = 1;
    const cfg = getMarkerConfig(facilityType);
    const size = 36;
    const dotColor = '#f97316';
    const glowColor = '249,115,22';
    const multiStrike = (typeof count === 'number' && count > 1);

    const filterStyle = 'filter: brightness(0) invert(1);';
    const html = `
        <div class="incident-marker" style="
            width:${size}px; height:${size}px;
            background:${dotColor};
            border-radius:50%;
            border: 2px solid rgba(255,255,255,${0.25 + 0.1 * opacity});
            display:flex; align-items:center; justify-content:center;
            position:relative;
            box-shadow: 0 0 0 0 rgba(${glowColor}, ${0.3 + 0.4 * opacity});
            animation: marker-glow-Orange ${2.5 - 0.5 * opacity}s ease-in-out infinite;
            opacity: ${opacity};
        ">
            <img src="${cfg.icon}" style="
                width:${size * 0.58}px; height:${size * 0.58}px;
                object-fit:contain;
                ${filterStyle}
                pointer-events:none;
                display:block;
            " />
            ${multiStrike ? '<span class="marker-count-badge">' + count + '</span>' : ''}
        </div>`;

    return L.divIcon({
        html,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
}

/* ─── INCIDENT LOG PANEL ──────────────────────────────────────────── */
class IncidentLogPanel {
    constructor(map) {
        this.map = map;
        this.incidents = [];
        this.sortDir = 'desc'; // newest first by default
        this._panel = document.getElementById('incident-log-panel');
        this._list = document.getElementById('ilp-list');
        this._badge = document.getElementById('ilp-badge');
        this._sortDesc = document.getElementById('ilp-sort-desc');
        this._sortAsc = document.getElementById('ilp-sort-asc');

        // Toggle expand/collapse
        document.getElementById('ilp-header').addEventListener('click', () => {
            this._panel.classList.toggle('collapsed');
        });

        // Sort buttons
        this._sortDesc.addEventListener('click', (e) => {
            e.stopPropagation();
            this._setSort('desc');
        });
        this._sortAsc.addEventListener('click', (e) => {
            e.stopPropagation();
            this._setSort('asc');
        });
    }

    _setSort(dir) {
        this.sortDir = dir;
        this._sortDesc.classList.toggle('active', dir === 'desc');
        this._sortAsc.classList.toggle('active', dir === 'asc');
        this._renderRows();
    }

    /** Called when incident data is ready from CSV parse */
    setIncidents(incidents) {
        this.incidents = incidents;
        this._badge.textContent = incidents.length;
        this._renderRows();
    }

    _renderRows() {
        if (!this.incidents.length) {
            this._list.innerHTML = '<div class="ilp-empty">No incidents loaded.</div>';
            return;
        }

        // Sort by date
        const sorted = [...this.incidents].sort((a, b) => {
            const diff = a.date.getTime() - b.date.getTime();
            return this.sortDir === 'desc' ? -diff : diff;
        });

        let html = '';
        for (const inc of sorted) {
            const row = inc.row;
            const country = (row.Country || '—').trim();
            const facility = inc.facility;
            const dateStr = (row.Date || '—').trim();
            const sourceUrl = (row['Source URL'] || '').trim();
            const lat = inc.lat;
            const lng = inc.lng;

            // Truncate source URL for display
            let sourceDisplay = 'source';
            if (sourceUrl) {
                try {
                    const u = new URL(sourceUrl);
                    sourceDisplay = u.hostname.replace('www.', '') + u.pathname.split('/').slice(0, 2).join('/');
                    if (sourceDisplay.length > 30) sourceDisplay = sourceDisplay.slice(0, 28) + '…';
                } catch (_) {
                    sourceDisplay = sourceUrl.length > 30 ? sourceUrl.slice(0, 28) + '…' : sourceUrl;
                }
            }

            html += `
                <div class="ilp-row" data-lat="${lat}" data-lng="${lng}" data-row-index="${this.incidents.indexOf(inc)}">
                    <div class="ilp-row-marker"></div>
                    <div class="ilp-row-content">
                        <div class="ilp-row-facility">${this._esc(facility)}</div>
                        <div class="ilp-row-meta">
                            <span class="ilp-country">${this._esc(country)}</span>
                            <span class="ilp-date">${this._esc(dateStr)}</span>
                        </div>
                    </div>
                    ${sourceUrl ? `<a href="${this._esc(sourceUrl)}" target="_blank" rel="noopener" class="ilp-row-source" title="${this._esc(sourceUrl)}">${this._esc(sourceDisplay)}</a>` : ''}
                </div>`;
        }

        this._list.innerHTML = html;

        // Click handler on rows — pan to marker and show card
        this._list.querySelectorAll('.ilp-row').forEach((el) => {
            el.addEventListener('click', (e) => {
                // Don't interfere with source link clicks
                if (e.target.closest('.ilp-row-source')) return;

                const lat = parseFloat(el.dataset.lat);
                const lng = parseFloat(el.dataset.lng);
                if (isNaN(lat) || isNaN(lng)) return;

                // Pan map to the incident location
                this.map.setView([lat, lng], 8, { animate: true });

                // Find the incident and show its card
                const idx = parseInt(el.dataset.rowIndex, 10);
                const inc = this.incidents[idx];
                if (inc) {
                    showIncidentCard([inc.row]);
                }

                // Optionally collapse the panel after clicking
                // Comment this out if you want it to stay open:
                // this._panel.classList.add('collapsed');
            });
        });
    }

    _esc(str) {
        if (!str) return '';
        var m = { '&': '\x26\x61\x6d\x70\x3b', '<': '\x26\x6c\x74\x3b', '>': '\x26\x67\x74\x3b', '"': '\x26\x71\x75\x6f\x74\x3b', "'": '\x26\x23\x33\x39\x3b' };
        return String(str).replace(/[&<>"']/g, function(ch) { return m[ch]; });
    }
}

/* ── 6. TIMELINE CONTROLLER ───────────────────────────────────────── */

/**
 * Parse a messy incident date string into a usable Date object.
 */
function parseIncidentDate(str) {
    if (!str || typeof str !== 'string') return null;
    const s = str.trim();
    if (!s) return null;

    // ISO date: YYYY-MM-DD
    {
        const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    }

    // "Month DD–DD, YYYY" or "Month DD-DD, YYYY" — use the first day
    {
        const m = s.match(/^([A-Za-z]+)\s+(\d{1,2})\s*[–-]\s*\d{1,2},?\s*(\d{4})/);
        if (m) return new Date(+m[3], monthIndex(m[1]), +m[2]);
    }

    // "Month DD, YYYY" or "Month DD YYYY"
    {
        const m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
        if (m) return new Date(+m[3], monthIndex(m[1]), +m[2]);
    }

    // "Late / Early / Mid Month YYYY"
    {
        const m = s.match(/^(Late|Early|Mid)\s+([A-Za-z]+)\s+(\d{4})/i);
        if (m) {
            const day = m[1].toLowerCase() === 'early' ? 5 : m[1].toLowerCase() === 'mid' ? 15 : 25;
            return new Date(+m[3], monthIndex(m[2]), day);
        }
    }

    // "Month YYYY" — use 15th
    {
        const m = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
        if (m) return new Date(+m[2], monthIndex(m[1]), 15);
    }

    return null;
}

function monthIndex(name) {
    const months = {
        jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
        jul:6, aug:7, sep:8, oct:9, nov:10, dec:11
    };
    return months[name.toLowerCase().slice(0, 3)] ?? 0;
}

function fmtDateShort(d) {
    if (!d || isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * TimelineController — manages the date slider, playback, and marker visibility.
 *
 * Incidents are stored flat: one per CSV row (each with its own date).
 * At render time, incidents at the same lat/lng are grouped into a single stacked marker.
 */
class TimelineController {
    constructor(map, destroyedLayer) {
        this.map = map;
        this.layer = destroyedLayer;
        this.incidents = [];
        this.markers = new Map();

        // Cache DOM refs once
        this._sliderEl = document.getElementById('tl-slider');
        this._dateLabelEl = document.getElementById('tl-date');
        this._ticksEl = document.getElementById('tl-ticks');

        this.dateMin = null;
        this.dateMax = null;
        this.currentDate = null;
        this.totalDays = 1;

        this.mode = 'cumulative';
        this.windowDays = 7;

        this._ready = false;
    }

    /** Load parsed incidents. Called once after CSV parse. */
    setIncidents(incidents) {
        this.incidents = incidents;

        // Compute date range across all incidents
        let allDates = [];
        for (const inc of incidents) {
            if (inc.date && !isNaN(inc.date.getTime())) allDates.push(inc.date);
        }
        if (allDates.length === 0) {
            console.warn('[Timeline] No parseable dates found.');
            return;
        }

        allDates.sort((a, b) => a - b);
        this.dateMin = new Date('2026-01-01');
        this.dateMax = new Date(allDates[allDates.length - 1]);
        this.totalDays = Math.max(1, Math.round((this.dateMax - this.dateMin) / DAY_MS));
        this.currentDate = new Date(this.dateMax);
        this._ready = true;

        console.log('[Timeline] ' + incidents.length + ' incidents, range ' + fmtDateShort(this.dateMin) + ' → ' + fmtDateShort(this.dateMax));

        this._updateSliderBounds();
        this._syncSliderToDate();
        this._updateDateLabel();
        this._buildTicks();
        this._renderMarkers();
    }

    setDate(date) {
        if (!date || !this._ready) return;
        if (this.dateMin && date < this.dateMin) date = new Date(this.dateMin);
        if (this.dateMax && date > this.dateMax) date = new Date(this.dateMax);
        this.currentDate = date;
        this._syncSliderToDate();
        this._updateDateLabel();
        this._renderMarkers();
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'window' && this.incidents.length) {
            // Jump to the most recent incident date so the window shows something
            let latest = null;
            for (const inc of this.incidents) {
                if (inc.date && (!latest || inc.date > latest)) latest = inc.date;
            }
            if (latest) this.setDate(new Date(latest));
        } else {
            this._renderMarkers();
        }
    }
    setWindowDays(days) { this.windowDays = parseInt(days, 10) || 2; if (this.mode === 'window') this._renderMarkers(); }

    _updateSliderBounds() {
        const slider = this._sliderEl;
        if (!slider) return;
        slider.max = String(this.totalDays);
        slider.min = '0';
        slider.step = String(SLIDER_STEP);
    }

    _syncSliderToDate() {
        const slider = this._sliderEl;
        if (!slider || !this.dateMin || !this.currentDate) return;
        const days = (this.currentDate - this.dateMin) / DAY_MS;
        slider.value = String(Math.max(0, Math.min(this.totalDays, days)));
    }

    _updateDateLabel() {
        const el = this._dateLabelEl;
        if (el && this.currentDate) {
            el.textContent = fmtDateShort(this.currentDate);
        }
    }

    _buildTicks() {
        const container = this._ticksEl;
        if (!container || !this.dateMin || !this.incidents.length) return;

        const range = this.dateMax - this.dateMin;
        const seen = new Set();
        const positions = [];

        for (const inc of this.incidents) {
            const d = inc.date;
            if (!d || isNaN(d.getTime())) continue;
            const key = d.toISOString().slice(0, 10);
            if (seen.has(key)) continue;
            seen.add(key);
            const pct = Math.max(0, Math.min(100, ((d - this.dateMin) / range) * 100));
            positions.push({ pct, date: d });
        }

        container.innerHTML = '';
        for (const pos of positions) {
            const tick = document.createElement('div');
            tick.className = 'tl-tick';
            tick.style.left = pos.pct + '%';
            tick.title = fmtDateShort(pos.date);
            container.appendChild(tick);
        }
        this._tickPositions = positions;
    }

    _renderMarkers() {
        if (!this._ready || !this.currentDate) return;

        const currentMs = this.currentDate.getTime();
        // Group visible incidents by location key "lat,lng"
        const locationGroups = new Map();

        for (const inc of this.incidents) {
            const incidentMs = inc.date ? inc.date.getTime() : NaN;
            if (isNaN(incidentMs)) continue;

            let show = false;
            let opacity = 1;

            if (this.mode === 'cumulative') {
                show = incidentMs <= currentMs;
            } else {
                const windowMs = this.windowDays * DAY_MS;
                const age = currentMs - incidentMs;
                if (age >= 0 && age <= windowMs) {
                    show = true;
                    const half = windowMs / 2;
                    if (age > half) {
                        opacity = 1 - ((age - half) / half) * 0.5;
                    }
                }
            }

            if (!show) continue;

            const key = inc.lat.toFixed(4) + ',' + inc.lng.toFixed(4);
            if (!locationGroups.has(key)) {
                locationGroups.set(key, {
                    lat: inc.lat,
                    lng: inc.lng,
                    type: inc.type,
                    opacity: opacity,
                    rows: []
                });
            }
            const group = locationGroups.get(key);
            group.rows.push(inc.row);
            // Use the minimum opacity across grouped incidents
            group.opacity = Math.min(group.opacity, opacity);
        }

        // Remove markers for locations no longer visible
        for (const [key, markerData] of this.markers) {
            if (!locationGroups.has(key)) {
                this.layer.removeLayer(markerData.marker);
                this.markers.delete(key);
            }
        }

        // Add or update visible markers
        for (const [key, group] of locationGroups) {
            let markerData = this.markers.get(key);
            const count = group.rows.length;
            const opacity = group.opacity;

            if (!markerData) {
                const facilityType = group.type;
                const icon = makeIncidentIcon(facilityType, count, opacity);
                const marker = L.marker([group.lat, group.lng], {
                    icon,
                    title: group.rows.length + ' incident(s)'
                });
                // Store rows directly on the marker object so click always gets latest data
                marker._incidentRows = group.rows;
                marker.on('click', function () {
                    showIncidentCard(this._incidentRows);
                });
                this.layer.addLayer(marker);
                this.markers.set(key, { marker, rows: group.rows });
            } else {
                const marker = markerData.marker;
                // Update stored rows directly on the marker object
                marker._incidentRows = group.rows;
                const oldCount = markerData.rows.length;
                if (oldCount !== count || Math.abs(markerData._lastOpacity - opacity) > 0.01) {
                    const icon = makeIncidentIcon(group.type, count, opacity);
                    marker.setIcon(icon);
                }
                markerData.rows = group.rows;
                markerData._lastOpacity = opacity;
            }
        }

        this._updateActiveTicks();
    }

    _updateActiveTicks() {
        if (!this._tickPositions || !this.currentDate) return;
        const container = document.getElementById('tl-ticks');
        if (!container) return;
        const currentMs = this.currentDate.getTime();
        const ticks = container.querySelectorAll('.tl-tick');
        this._tickPositions.forEach((pos, i) => {
            if (ticks[i]) ticks[i].classList.toggle('active', pos.date.getTime() <= currentMs);
        });
    }
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

    // CartoDB Dark Matter — free tile layer, no API key needed.
    L.tileLayer('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
            // Clicking the entire legend item toggles the checkbox
            var item = cb.closest('.legend-item');
            if (item) {
                item.addEventListener('click', function (e) {
                    if (e.target === cb || e.target.tagName === 'INPUT') return;
                    cb.checked = !cb.checked;
                    var event = new Event('change');
                    cb.dispatchEvent(event);
                });
            }
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
        .catch(function(err) { console.warn('Pipeline GeoJSON not found - skipping.'); });

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

    /* ── INCIDENT LOG PANEL ──────────────────────────────────────── */
    var incidentLogPanel = new IncidentLogPanel(map);

    /* ── DESTROYED INFRASTRUCTURE CSV ───────────────────────────── */
    var timelineCtrl = new TimelineController(map, layers.destroyed);

    Papa.parse('./mapData/DestroyedInfrastructureList.csv?v=6', {
        download: true,
        header: true,
        skipEmptyLines: true,
        beforeFirstChunk: function (chunk) {
            var lines = chunk.split('\n');
            while (lines.length && lines[0].replace(/[,\s]/g, '') === '') {
                lines.shift();
            }
            return lines.join('\n');
        },
        complete: function (results) {
            var rows = results.data.filter(function (row) {
                return row.Facility && row.Facility.trim() !== '' && row.Facility !== 'Facility';
            });

            // Flatten: each CSV row becomes its own incident with its own date
            var parsedIncidents = [];

            rows.forEach(function (row) {
                var lat = parseFloat(row.Lat);
                var lng = parseFloat(row.Lon);
                if (isNaN(lat) || isNaN(lng)) return;

                var facilityType = (row['Facility Type'] || 'Oil').trim();
                var date = parseIncidentDate(row.Date);
                if (!date || isNaN(date.getTime())) {
                    date = new Date('2026-01-01');
                }

                parsedIncidents.push({
                    facility: row.Facility || 'Unknown',
                    lat: lat,
                    lng: lng,
                    type: facilityType,
                    date: date,
                    row: row      // store the raw CSV row for the info card
                });
            });

            var badge = document.getElementById('badge-count');
            if (badge) {
                badge.textContent = parsedIncidents.length + ' Incident' + (parsedIncidents.length !== 1 ? 's' : '');
            }

            // Feed incidents to the timeline controller AND the incident log panel
            timelineCtrl.setIncidents(parsedIncidents);
            incidentLogPanel.setIncidents(parsedIncidents);
            // Add incident dates to the price chart's attack lines
            updateAttackDates(parsedIncidents);
        }
    });

    /* ── TIMELINE CONTROLS ────────────────────────────────────────── */
    // Slider
    var slider = document.getElementById('tl-slider');
    slider.addEventListener('input', function () {
        var days = parseFloat(slider.value);
        if (timelineCtrl.dateMin) {
            var d = new Date(timelineCtrl.dateMin);
            d.setDate(d.getDate() + days);
            timelineCtrl.setDate(d);
        }
    });

    // Mode toggle
    document.getElementById('tl-mode-group').addEventListener('click', function (e) {
        var btn = e.target.closest('.tl-mode');
        if (!btn) return;
        document.querySelectorAll('.tl-mode').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var mode = btn.dataset.mode;
        document.getElementById('tl-window').style.display = mode === 'window' ? 'inline-block' : 'none';
        timelineCtrl.setMode(mode);
    });

    // Window size
    document.getElementById('tl-window').addEventListener('change', function (e) {
        timelineCtrl.setWindowDays(e.target.value);
    });

    L.control.scale({ metric: true, imperial: true, position: 'bottomright' }).addTo(map);
});
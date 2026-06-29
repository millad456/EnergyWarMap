#!/usr/bin/env node

/**
 * fetch-suggestions.js
 *
 * Queries NewsAPI for recent energy infrastructure attack stories,
 * cross-references against the existing CSV, and writes suggested
 * new incidents to suggestions/YYYY-MM-DD-new-incidents.json for
 * manual review.
 *
 * Usage:
 *   node fetch-suggestions.js [--days=7] [--skip-dedup]
 *
 * Requires: NEWS_API_KEY in .env file
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ── CONFIG ──────────────────────────────────────────────────────────── */

// Load .env
const envPath = resolve(__dirname, '.env');
let NEWS_API_KEY = null;
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key.trim() === 'NEWS_API_KEY') {
      NEWS_API_KEY = rest.join('=').trim();
      break;
    }
  }
}
if (!NEWS_API_KEY || NEWS_API_KEY === 'your_key_here') {
  console.error('Error: NEWS_API_KEY not set in scripts/.env');
  console.error('Get a key at https://newsapi.org/register');
  process.exit(1);
}

const CSV_PATH = resolve(__dirname, '..', 'mapData', 'DestroyedInfrastructureList.csv');
const SUGGESTIONS_DIR = resolve(__dirname, '..', 'suggestions');

// Trusted sources — only results from these domains are kept
const TRUSTED_SOURCES = [
  'bbc.co.uk', 'bbc.com',
  'reuters.com',
  'aljazeera.com',
  'kyivindependent.com',
  'cnbc.com',
  'wsj.com',
  'bloomberg.com',
  'themoscowtimes.com',
  'jpost.com',
  'cbc.ca',
  'theguardian.com',
  'apnews.com',
  'ft.com',
  'independent.co.uk',
  'voanews.com',
];

// Search queries to run
const SEARCH_QUERIES = [
  '"energy infrastructure" drone attack',
  'oil refinery drone strike',
  'pipeline drone attack',
  'gas facility attack',
  'oil depot strike',
  'LNG facility attack missile',
  'petrochemical plant fire attack',
  'oil well explosion attack',
  'energy facility drone Ukraine Russia',
  'Middle East energy infrastructure attack',
];

/* ── HELPERS ─────────────────────────────────────────────────────────── */

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Parse the existing CSV and return a Set of source URLs
 * already in the dataset (for deduplication).
 */
function loadExistingUrls(csvPath) {
  if (!existsSync(csvPath)) {
    console.warn('CSV not found:', csvPath);
    return new Set();
  }
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n');
  const existingUrls = new Set();
  for (let i = 2; i < lines.length; i++) {
    // Simple CSV parsing: find the 10th column (Source URL)
    const url = extractCsvField(lines[i], 9); // 0-indexed: column 9
    if (url && url.startsWith('http')) {
      existingUrls.add(url.trim().toLowerCase());
    }
  }
  return existingUrls;
}

/** Extract a field from a CSV line (handles quoted fields). */
function extractCsvField(line, colIndex) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped quotes
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields[colIndex] || '';
}

/**
 * Try to extract country name from article title/description.
 */
function guessCountry(title, description) {
  const countries = [
    'Russia', 'Ukraine', 'Iran', 'Israel', 'Saudi Arabia', 'UAE',
    'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Iraq',
    'Oman', 'Yemen', 'Syria', 'Lebanon', 'Jordan', 'Egypt', 'Turkey',
    'USA', 'United States', 'Australia', 'India', 'Vietnam',
  ];
  const combined = `${title} ${description}`.toLowerCase();
  for (const c of countries) {
    if (combined.includes(c.toLowerCase())) {
      if (c === 'United Arab Emirates') return 'UAE';
      if (c === 'United States') return 'USA';
      return c;
    }
  }
  return '';
}

/**
 * Guess facility type from title/description.
 */
function guessFacilityType(title, description) {
  const combined = `${title} ${description}`.toLowerCase();
  if (combined.includes('pipeline')) return 'Pipeline';
  if (combined.includes('lng') || combined.includes('gas field') || combined.includes('gas facility') || combined.includes('gas plant')) return 'Gas ';
  if (combined.includes('petrochemical') || combined.includes('gtl')) return 'Gas/Petrochemical';
  if (combined.includes('oil field') || combined.includes('oil well') || combined.includes('oil depot') || combined.includes('refinery')) return 'Oil';
  return 'Oil'; // default
}

/* ── MAIN ────────────────────────────────────────────────────────────── */

async function main() {
  const args = process.argv.slice(2);
  let lookbackDays = 7;

  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      lookbackDays = parseInt(arg.split('=')[1], 10) || 7;
    }
  }

  const fromDate = daysAgo(lookbackDays);
  console.log(`\n🔍 Searching NewsAPI for the past ${lookbackDays} days (since ${fromDate})…\n`);

  const existingUrls = loadExistingUrls(CSV_PATH);
  console.log(`📋 Loaded ${existingUrls.size} existing source URLs for dedup.\n`);

  const apiBase = 'https://newsapi.org/v2/everything';
  const allArticles = new Map(); // url -> article (dedup)

  for (const query of SEARCH_QUERIES) {
    const url = `${apiBase}?q=${encodeURIComponent(query)}&from=${fromDate}&sortBy=publishedAt&pageSize=50&language=en&apiKey=${NEWS_API_KEY}`;

    try {
      const res = await fetch(url);
      const json = await res.json();

      if (json.status === 'error') {
        console.error(`  ✗ Query "${query}": ${json.message}`);
        continue;
      }

      const articles = json.articles || [];
      console.log(`  ✓ "${query}" — ${articles.length} results`);

      for (const article of articles) {
        const articleUrl = (article.url || '').toLowerCase();
        if (allArticles.has(articleUrl)) continue;

        // Filter to trusted sources
        const sourceDomain = new URL(article.url).hostname.replace('www.', '');
        const isTrusted = TRUSTED_SOURCES.some(s => sourceDomain.endsWith(s));
        if (!isTrusted) continue;

        allArticles.set(articleUrl, article);
      }
    } catch (err) {
      console.error(`  ✗ Query "${query}": ${err.message}`);
    }
  }

  console.log(`\n📰 Total after source filtering: ${allArticles.size} articles from trusted sources.\n`);

  // Cross-reference with existing URLs and build suggestions
  const suggestions = [];
  for (const [url, article] of allArticles) {
    if (existingUrls.has(url)) {
      console.log(`  ⏭ Already in CSV: ${article.title?.substring(0, 80)}`);
      continue;
    }

    const country = guessCountry(article.title || '', article.description || '');
    const facilityType = guessFacilityType(article.title || '', article.description || '');
    const date = article.publishedAt ? article.publishedAt.split('T')[0] : 'Unknown';

    suggestions.push({
      title: article.title,
      url: article.url,
      source: article.source?.name || 'Unknown',
      publishedAt: article.publishedAt || 'Unknown',
      description: (article.description || '').substring(0, 300),
      // Pre-filled guesses — YOU MUST VERIFY THESE
      suggestedCountry: country,
      suggestedFacilityType: facilityType,
      suggestedDate: date,
      // Fields you'll fill in during review:
      facility: '',
      facilityType: facilityType,
      lat: '',
      lon: '',
      capacity: 'No info found',
      confirmedDate: date,
      notes: '',
      verified: false, // Set to true after your review
    });
  }

  // Write suggestions
  if (!existsSync(SUGGESTIONS_DIR)) {
    mkdirSync(SUGGESTIONS_DIR, { recursive: true });
  }

  const today = new Date().toISOString().split('T')[0];
  const outputPath = resolve(SUGGESTIONS_DIR, `${today}-new-incidents.json`);
  writeFileSync(outputPath, JSON.stringify(suggestions, null, 2), 'utf-8');

  console.log(`✅ ${suggestions.length} new suggestion(s) written to:`);
  console.log(`   ${outputPath}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Review the JSON — fill in facility name, coordinates, verify facts`);
  console.log(`   2. Set "verified": true for confirmed entries`);
  console.log(`   3. Run: node scripts/add-incidents.js suggestions/${today}-new-incidents.json`);
  console.log(`\n   (You can also edit the JSON directly in VS Code)\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
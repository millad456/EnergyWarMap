#!/usr/bin/env node

/**
 * add-incidents.js
 *
 * Reads a verified suggestions JSON file and appends new incidents
 * to DestroyedInfrastructureList.csv with deduplication checks.
 *
 * Usage:
 *   node add-incidents.js suggestions/YYYY-MM-DD-new-incidents.json
 *
 * The JSON entries must have "verified": true set after review.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = resolve(__dirname, '..', 'mapData', 'DestroyedInfrastructureList.csv');

/* ── CSV HELPERS ─────────────────────────────────────────────────────── */

/**
 * Parse the existing CSV and return all rows as arrays of fields.
 * Also returns the raw first line (header) for writing.
 */
function loadExistingRows(csvPath) {
  if (!existsSync(csvPath)) {
    console.error('Error: CSV not found:', csvPath);
    process.exit(1);
  }
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n');
  
  // First line is the junk empty row, second line is real header
  const header = lines[1] || '';
  
  const rows = [];
  const existingUrls = new Set();
  
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseCsvLine(line);
    if (fields.length < 10) continue;
    
    const url = (fields[9] || '').trim().toLowerCase();
    if (url.startsWith('http')) {
      existingUrls.add(url);
    }
    rows.push(fields);
  }
  
  return { lines, header, existingUrls };
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
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
  return fields;
}

function escapeCsvField(val) {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function formatCsvRow(fields) {
  return fields.map(f => escapeCsvField(f)).join(',');
}

/* ── VALIDATION ──────────────────────────────────────────────────────── */

function validateEntry(entry, index) {
  const errors = [];
  
  if (!entry.facility || entry.facility.trim() === '') {
    errors.push('Missing facility name');
  }
  if (!entry.facilityType || entry.facilityType.trim() === '') {
    errors.push('Missing facility type');
  }
  
  const lat = parseFloat(entry.lat);
  const lon = parseFloat(entry.lon);
  if (isNaN(lat) || lat < -90 || lat > 90) {
    errors.push(`Invalid lat: "${entry.lat}"`);
  }
  if (isNaN(lon) || lon < -180 || lon > 180) {
    errors.push(`Invalid lon: "${entry.lon}"`);
  }
  
  if (!entry.confirmedDate || entry.confirmedDate.trim() === '') {
    errors.push('Missing confirmed date');
  }
  
  if (!entry.url || !entry.url.startsWith('http')) {
    errors.push('Missing or invalid source URL');
  }
  
  return errors;
}

/* ── MAIN ────────────────────────────────────────────────────────────── */

async function main() {
  const args = process.argv.slice(2);
  const jsonPath = args[0];
  
  if (!jsonPath) {
    console.error('Usage: node add-incidents.js <suggestions-json>');
    console.error('Example: node add-incidents.js suggestions/2026-06-28-new-incidents.json');
    process.exit(1);
  }
  
  const fullJsonPath = resolve(jsonPath);
  if (!existsSync(fullJsonPath)) {
    console.error('Error: JSON file not found:', fullJsonPath);
    process.exit(1);
  }
  
  // Load suggestions
  const raw = readFileSync(fullJsonPath, 'utf-8');
  let suggestions;
  try {
    suggestions = JSON.parse(raw);
  } catch (err) {
    console.error('Error: Invalid JSON:', err.message);
    process.exit(1);
  }
  
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    console.log('No suggestions to add.');
    process.exit(0);
  }
  
  // Filter to verified only
  const verified = suggestions.filter(s => s.verified === true);
  if (verified.length === 0) {
    console.log(`Found ${suggestions.length} suggestion(s), but none are marked "verified": true.`);
    console.log('Review the JSON file first and set "verified": true for confirmed entries.');
    process.exit(0);
  }
  
  console.log(`📋 ${suggestions.length} total suggestion(s), ${verified.length} verified for adding.\n`);
  
  // Load existing CSV
  const { lines, header, existingUrls } = loadExistingRows(CSV_PATH);
  
  // Validate and dedup
  const toAdd = [];
  let skippedDedup = 0;
  let skippedInvalid = 0;
  
  for (let i = 0; i < verified.length; i++) {
    const entry = verified[i];
    
    // Validate
    const errors = validateEntry(entry, i);
    if (errors.length > 0) {
      console.log(`  ✗ Entry #${i + 1}: ${entry.facility || entry.title || 'Unknown'}`);
      errors.forEach(e => console.log(`    - ${e}`));
      skippedInvalid++;
      continue;
    }
    
    // Dedup by URL
    const url = (entry.url || '').trim().toLowerCase();
    if (existingUrls.has(url)) {
      console.log(`  ⏭ Entry #${i + 1}: ${entry.facility} — URL already in CSV`);
      skippedDedup++;
      continue;
    }
    
    toAdd.push(entry);
    existingUrls.add(url);
  }
  
  if (skippedInvalid > 0 || skippedDedup > 0) {
    console.log(`\n  ⚠ Skipped: ${skippedInvalid} invalid, ${skippedDedup} duplicates\n`);
  }
  
  if (toAdd.length === 0) {
    console.log('No new entries to add after validation and deduplication.');
    process.exit(0);
  }
  
  // Build new CSV
  const newRows = toAdd.map(entry => {
    return [
      entry.suggestedCountry || '',           // Country
      entry.facility || '',                    // Facility
      entry.facilityType || 'Oil',             // Facility Type
      entry.lat || '',                         // Lat
      entry.lon || '',                         // Lon
      entry.description || '',                 // Description
      entry.confirmedDate || '',               // Date
      entry.capacity || 'No info found',       // Capacity
      entry.url || '',                         // Source URL
      'TRUE',                                  // Attack Happened
      entry.notes || '',                       // Notes
    ];
  });
  
  // Reconstruct CSV
  const csvContent = [
    lines[0],          // junk empty row
    header,            // real header
    ...lines.slice(2).filter(l => l.trim()),  // existing data rows
    ...newRows.map(formatCsvRow),
  ].join('\n') + '\n';
  
  // Backup existing
  const backupPath = CSV_PATH + '.bak';
  writeFileSync(backupPath, readFileSync(CSV_PATH, 'utf-8'), 'utf-8');
  
  // Write new
  writeFileSync(CSV_PATH, csvContent, 'utf-8');
  
  console.log(`✅ Added ${toAdd.length} new incident(s) to the CSV.`);
  console.log(`📁 Backup saved to: ${backupPath}`);
  console.log(`\nEntries added:`);
  toAdd.forEach(entry => {
    console.log(`  • ${entry.facility} (${entry.suggestedCountry || '?'}) — ${entry.confirmedDate}`);
  });
  console.log(`\n💡 Next: git add mapData/DestroyedInfrastructureList.csv && git commit -m "Add ${toAdd.length} new incident(s)"`);
  console.log(`   Also update ATTACK_DATES in script.js if there are new dates present.\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
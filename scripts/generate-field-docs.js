#!/usr/bin/env node

/**
 * Field Documentation Generator
 *
 * Validates field annotations and checks for missing documentation.
 * Future enhancement: Auto-generate markdown from database types.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIELD_SOURCES_PATH = path.join(__dirname, '../docs/field-sources.json');
const DATA_DICT_PATH = path.join(__dirname, '../docs/DATA_DICTIONARY.md');
const DATABASE_TYPES_PATH = path.join(__dirname, '../src/types/database.ts');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filepath, name) {
  if (!fs.existsSync(filepath)) {
    log('red', `❌ Missing: ${name}`);
    log('yellow', `   Expected at: ${filepath}`);
    return false;
  }
  return true;
}

function loadFieldSources() {
  try {
    const content = fs.readFileSync(FIELD_SOURCES_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    log('red', `❌ Failed to load field sources: ${error.message}`);
    process.exit(1);
  }
}

function validateFieldSources(sources) {
  const validSources = ['GE', 'Custom', 'System', 'Computed'];
  const validSyncStatuses = ['synced', 'partial', 'missing'];
  let hasErrors = false;

  Object.entries(sources).forEach(([table, fields]) => {
    Object.entries(fields).forEach(([fieldName, config]) => {
      // Check required 'source' field
      if (!config.source) {
        log('red', `❌ ${table}.${fieldName}: Missing 'source' field`);
        hasErrors = true;
      } else if (!validSources.includes(config.source)) {
        log('red', `❌ ${table}.${fieldName}: Invalid source '${config.source}'`);
        log('yellow', `   Valid: ${validSources.join(', ')}`);
        hasErrors = true;
      }

      // Check syncStatus for GE fields
      if (config.source === 'GE') {
        if (!config.syncStatus) {
          log('yellow', `⚠️  ${table}.${fieldName}: GE field missing 'syncStatus'`);
        } else if (!validSyncStatuses.includes(config.syncStatus)) {
          log('red', `❌ ${table}.${fieldName}: Invalid syncStatus '${config.syncStatus}'`);
          log('yellow', `   Valid: ${validSyncStatuses.join(', ')}`);
          hasErrors = true;
        }
      }
    });
  });

  return !hasErrors;
}

function getFieldStats(sources) {
  const stats = {
    total: 0,
    bySource: { GE: 0, Custom: 0, System: 0, Computed: 0 },
    byTable: {},
    syncStatus: { synced: 0, partial: 0, missing: 0 },
  };

  Object.entries(sources).forEach(([table, fields]) => {
    stats.byTable[table] = Object.keys(fields).length;

    Object.values(fields).forEach((config) => {
      stats.total++;
      stats.bySource[config.source]++;

      if (config.syncStatus) {
        stats.syncStatus[config.syncStatus]++;
      }
    });
  });

  return stats;
}

function displayStats(stats) {
  log('cyan', '\n📊 Field Statistics:');
  log('blue', `   Total fields: ${stats.total}`);

  log('cyan', '\n   By Source:');
  Object.entries(stats.bySource).forEach(([source, count]) => {
    const emoji = { GE: '🔵', Custom: '🟢', System: '🟡', Computed: '🟣' }[source];
    log('blue', `   ${emoji} ${source}: ${count}`);
  });

  log('cyan', '\n   By Table:');
  Object.entries(stats.byTable).forEach(([table, count]) => {
    log('blue', `   • ${table}: ${count} fields`);
  });

  log('cyan', '\n   GE Sync Coverage:');
  const geTotal = stats.bySource.GE;
  if (geTotal > 0) {
    Object.entries(stats.syncStatus).forEach(([status, count]) => {
      const percentage = ((count / geTotal) * 100).toFixed(1);
      const emoji = { synced: '✓', partial: '⚠️', missing: '❌' }[status];
      log('blue', `   ${emoji} ${status}: ${count} (${percentage}%)`);
    });
  }
}

function checkForNewFields() {
  // This would parse database.ts and compare with field-sources.json
  // For now, just check if database.ts exists and is newer

  if (!fs.existsSync(DATABASE_TYPES_PATH)) {
    log('yellow', '\n⚠️  Database types not found. Run: npm run db:types');
    return;
  }

  const typesModified = fs.statSync(DATABASE_TYPES_PATH).mtime;
  const docsModified = fs.statSync(DATA_DICT_PATH).mtime;

  if (typesModified > docsModified) {
    log('yellow', '\n⚠️  Database types were updated after documentation');
    log('yellow', '   Please review and update docs/DATA_DICTIONARY.md');
    log('yellow', '   and docs/field-sources.json if needed');
  } else {
    log('green', '\n✓ Documentation is up to date with database types');
  }
}

function main() {
  log('cyan', '\n🔍 Validating Field Documentation...\n');

  // Check files exist
  const hasFieldSources = checkFileExists(FIELD_SOURCES_PATH, 'field-sources.json');
  const hasDataDict = checkFileExists(DATA_DICT_PATH, 'DATA_DICTIONARY.md');

  if (!hasFieldSources || !hasDataDict) {
    log('red', '\n❌ Missing required files. Please create them first.');
    process.exit(1);
  }

  // Load and validate
  const sources = loadFieldSources();
  log('green', '✓ Loaded field sources');

  const isValid = validateFieldSources(sources);
  if (!isValid) {
    log('red', '\n❌ Validation failed. Please fix errors above.');
    process.exit(1);
  }
  log('green', '✓ Field sources validated');

  // Display stats
  const stats = getFieldStats(sources);
  displayStats(stats);

  // Check for updates needed
  checkForNewFields();

  log('green', '\n✅ Documentation check complete!\n');
}

// Run main function
main();

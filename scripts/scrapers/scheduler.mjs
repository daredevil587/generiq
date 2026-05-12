#!/usr/bin/env node
/**
 * scheduler.mjs
 *
 * Keeps running and fires all price scrapers every 24 hours at 03:00.
 * Start once and leave running (e.g. in a PM2 process or Windows Service).
 *
 * Usage:
 *   node scripts/scrapers/scheduler.mjs
 *
 *   Or with PM2 (auto-restart on crash):
 *   pm2 start scripts/scrapers/scheduler.mjs --name generiq-scraper
 */

import cron from 'node-cron';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function runScrapers() {
  console.log(`\n[${new Date().toLocaleString('en-GB')}] Starting scheduled scrape...`);
  try {
    execSync(
      `node "${join(__dirname, 'run-all-scrapers.mjs')}"`,
      { stdio: 'inherit', timeout: 2 * 60 * 60 * 1000 },
    );
  } catch (err) {
    console.error('Scraper run failed:', err.message);
  }
}

// Run immediately on startup
runScrapers();

// Then every day at 03:00
cron.schedule('0 3 * * *', runScrapers, { timezone: 'Europe/London' });

console.log('\nScheduler running. Price scrapers will fire daily at 03:00 London time.');
console.log('Press Ctrl+C to stop.\n');

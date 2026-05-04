// JobRadar demo recorder.
//
// Drives Playwright through the live UI on :5174 and records a 1280x720
// webm via Playwright's built-in video capture. ffmpeg then converts to
// an mp4 that's embed-friendly on GitHub.
//
// Run with the dev server already up:
//   npm run dev          (in another terminal)
//   node scripts/record-demo.mjs
//
// Needs: ADMIN_PASSWORD in .env, an existing profile with at least one
// posting (so the Kanban demo isn't empty). Won't make any new agent
// calls — uses the data already in the DB.

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..');
dotenv.config({ path: path.join(repoRoot, '.env') });

const PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error('ADMIN_PASSWORD missing in .env');
  process.exit(1);
}

const VIDEO_DIR = path.join(repoRoot, 'docs/videos');
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const URL = 'http://localhost:5174';
const VIEWPORT = { width: 1280, height: 720 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeNice(page, selector, text) {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char);
    await sleep(45 + Math.random() * 35);
  }
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: VIEWPORT,
  recordVideo: { dir: VIDEO_DIR, size: VIEWPORT },
});
const page = await context.newPage();

try {
  // ── 1. LOGIN ───────────────────────────────────────────────────────
  await page.goto(URL);
  await page.waitForSelector('input[type="password"]');
  await sleep(1500);
  await typeNice(page, 'input[type="password"]', PASSWORD);
  await sleep(500);
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Kanban', { state: 'visible' });
  await sleep(1500);

  // ── 2. KANBAN OVERVIEW ─────────────────────────────────────────────
  // Let the viewer admire the posting card.
  await sleep(3500);

  // ── 3. PROFILES PAGE ───────────────────────────────────────────────
  // Show the list of saved searches.
  await page.click('a[href="/profiles"]');
  await page.waitForLoadState('networkidle');
  await sleep(3000);

  // ── 4. BACK TO KANBAN ──────────────────────────────────────────────
  await page.click('a[href="/"]');
  await page.waitForLoadState('networkidle');
  await sleep(2000);

  // ── 5. STATUS TRANSITION (New → Saved) ─────────────────────────────
  const savedBtn = page.locator('button:has-text("→ Saved")').first();
  if (await savedBtn.count()) {
    await savedBtn.scrollIntoViewIfNeeded();
    await sleep(800);
    await savedBtn.click();
    await sleep(2500);
  }

  // ── 6. STATUS TRANSITION (Saved → Applied) ─────────────────────────
  const appliedBtn = page.locator('button:has-text("→ Applied")').first();
  if (await appliedBtn.count()) {
    await appliedBtn.click();
    await sleep(2500);
  }

  // ── 7. ADD A NOTE ──────────────────────────────────────────────────
  const addNoteBtn = page.locator('text=Add note').first();
  if (await addNoteBtn.count()) {
    await addNoteBtn.click();
    await sleep(700);
    await typeNice(
      page,
      'textarea[placeholder*="Notes"]',
      'Strong match — emailing recruiter Monday.'
    );
    await sleep(800);
    await page.locator('button[title="Save notes"]').first().click();
    await sleep(2500);
  }

  // ── 8. ARCHIVE TO RESET STATE FOR NEXT RECORDING ───────────────────
  // Move the card back to "new" so re-running this script starts clean.
  // Done off-camera — close fast.
  await sleep(1500);
} catch (err) {
  console.error('Recording errored:', err.message);
}

await context.close();
await browser.close();

// Reset the card back to "new" so the demo is reproducible. Done via
// direct API call so we don't pollute the recording.
try {
  const { default: prisma } = await import('../server/src/config/database.js');
  await prisma.jobPosting.updateMany({
    data: { userStatus: 'new', appliedAt: null, userNotes: null },
  });
  console.log('reset all postings to "new" for next demo');
  await prisma.$disconnect();
} catch (err) {
  console.warn('could not reset DB state:', err.message);
}

const videos = fs
  .readdirSync(VIDEO_DIR)
  .filter((f) => f.endsWith('.webm') && f !== 'jobradar-demo.webm')
  .map((f) => ({ name: f, mtime: fs.statSync(path.join(VIDEO_DIR, f)).mtime }))
  .sort((a, b) => b.mtime - a.mtime);

if (videos.length === 0) {
  console.error('no video produced');
  process.exit(1);
}

const latest = path.join(VIDEO_DIR, videos[0].name);
const target = path.join(VIDEO_DIR, 'jobradar-demo.webm');
fs.renameSync(latest, target);
console.log('saved:', target);

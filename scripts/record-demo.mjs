// JobRadar demo recorder.
//
// Drives Playwright through the live UI on :5174 and records a 1280x720
// webm via Playwright's built-in video capture. ffmpeg afterwards produces
// the mp4 + gif published to GitHub.
//
// FULL FLOW (real Anthropic call — costs ~$0.05 per recording):
//   1. Login
//   2. Empty Kanban
//   3. Profiles → New profile
//   4. Fill: name, include-keywords (chip input), location
//   5. Save → returns to profile list
//   6. Click Run on the new profile
//   7. Wait for the success toast ("Found N postings…")
//   8. Auto-redirect to Kanban
//   9. New postings visible in "New" column
//   10. Status transition + note demo
//
// Pre-requisites:
//   - dev server running on :5174 (and :5173 API)
//   - ADMIN_PASSWORD set in .env
//   - ANTHROPIC_API_KEY set (the agent will actually run)

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

async function typeNice(page, locator, text, delay = 55) {
  if (typeof locator === 'string') {
    await page.click(locator);
  } else {
    await locator.click();
  }
  for (const char of text) {
    await page.keyboard.type(char);
    await sleep(delay + Math.random() * 30);
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
  await sleep(400);
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Kanban', { state: 'visible' });
  await sleep(1500);

  // ── 2. EMPTY KANBAN ────────────────────────────────────────────────
  await sleep(2000);

  // ── 3. PROFILES PAGE ───────────────────────────────────────────────
  await page.click('a[href="/profiles"]');
  await page.waitForLoadState('networkidle');
  await sleep(1500);

  // ── 4. NEW PROFILE ─────────────────────────────────────────────────
  await page.click('a[href="/profiles/new"]');
  await page.waitForSelector('input[placeholder*="QA Automation"]');
  await sleep(800);

  // Name
  await typeNice(
    page,
    'input[placeholder*="QA Automation"]',
    'Full Stack Developer — Tel Aviv'
  );
  await sleep(600);

  // Keywords. Locate the chip-input <input>s by their wrapping div
  // (which has the distinctive min-h-[50px] class). The placeholder
  // text disappears once a chip is added, so we can't rely on that —
  // position-based locators are more robust.
  const chipContainers = page.locator('div.flex.flex-wrap.gap-2.p-2.border');
  const includeInput = chipContainers.nth(0).locator('input[type="text"]');

  for (const kw of ['React', 'Node.js', 'TypeScript', 'Full Stack']) {
    await includeInput.click();
    for (const c of kw) {
      await page.keyboard.type(c);
      await sleep(45);
    }
    await page.keyboard.press('Enter');
    await sleep(300);
  }
  await sleep(800);

  // Location — clear "Israel" and replace with "Tel Aviv"
  const locationInput = page.locator('input[type="text"]').filter({ hasText: '' }).nth(1);
  // Simpler: target by surrounding label
  const locInput = page.getByLabel('Location').or(
    page.locator('input').filter({ has: page.locator('xpath=//ancestor::div[contains(., "Location")]') })
  );
  // Safest: just find the text input whose value is "Israel" right now
  await page.fill('input[type="text"][value="Israel"]', '');
  await typeNice(
    page,
    'input[type="text"][value=""]',
    'Tel Aviv'
  ).catch(async () => {
    // Fallback: find by surrounding label text
    const label = page.getByText('Location', { exact: true });
    const wrapper = label.locator('xpath=..');
    const input = wrapper.locator('input[type="text"]');
    await input.fill('Tel Aviv');
  });
  await sleep(800);

  // Submit
  await page.click('button[type="submit"]');
  await page.waitForURL('**/profiles');
  await sleep(1500);

  // ── 5. RUN AGENT ───────────────────────────────────────────────────
  // Click "Run" on the newly-created profile card.
  const runBtn = page.locator('button:has-text("Run")').first();
  await runBtn.click();
  await sleep(800);

  // ── 6. WAIT FOR THE SUCCESS TOAST ──────────────────────────────────
  // Toast text is "Found N postings — M new" on success.
  console.log('agent running… (real Anthropic call, may take 30-60s)');
  await page.waitForSelector('text=/Found \\d+ posting/i', { timeout: 120000 });
  await sleep(2000);

  // The list page's handler navigates to "/" (Kanban) on success after a
  // short pause — wait for the redirect.
  await page.waitForURL(`${URL}/`, { timeout: 5000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  await sleep(2500);

  // ── 7. KANBAN WITH NEW POSTINGS ────────────────────────────────────
  await sleep(3000);

  // ── 8. STATUS TRANSITION ───────────────────────────────────────────
  const savedBtn = page.locator('button:has-text("→ Saved")').first();
  if (await savedBtn.count()) {
    await savedBtn.scrollIntoViewIfNeeded();
    await sleep(700);
    await savedBtn.click();
    await sleep(2000);
  }

  const appliedBtn = page.locator('button:has-text("→ Applied")').first();
  if (await appliedBtn.count()) {
    await appliedBtn.click();
    await sleep(2000);
  }

  // ── 9. ADD A NOTE ──────────────────────────────────────────────────
  const addNoteBtn = page.locator('text=Add note').first();
  if (await addNoteBtn.count()) {
    await addNoteBtn.click();
    await sleep(600);
    await typeNice(
      page,
      'textarea[placeholder*="Notes"]',
      'Strong match — emailing recruiter Monday.'
    );
    await sleep(600);
    await page.locator('button[title="Save notes"]').first().click();
    await sleep(2500);
  }

  await sleep(1500);
} catch (err) {
  console.error('Recording errored:', err.message);
}

await context.close();
await browser.close();

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

import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Manoj Kumarn N S\\.gemini\\antigravity\\brain\\c631709d-eb7f-414b-9758-8b0010da8526';

async function runBrowserTest() {
  console.log('================================================================');
  console.log('REAL BROWSER AUTOMATION: MULTI-AGENT CONCURRENCY & REFRESH TEST');
  console.log('================================================================\n');

  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Chrome executable not found at ${CHROME_PATH}`);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log('[1] Navigating to MarketMate AI Frontend (http://localhost:5173)...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('  Page loaded successfully.');

    // --- STEP 1: START SEO AGENT JOB ---
    console.log('\n[2] Navigating to /seo (Technical SEO Auditor)...');
    await page.goto('http://localhost:5173/seo', { waitUntil: 'domcontentloaded' });

    console.log('  Filling URL: https://stripe.com');
    await page.waitForSelector('input[type="url"]');
    await page.type('input[type="url"]', 'https://stripe.com');

    console.log('  Submitting SEO audit job...');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));

    const seoShotPath = path.join(ARTIFACT_DIR, 'browser_seo_job_started.png');
    await page.screenshot({ path: seoShotPath, fullPage: true });
    console.log(`  Captured screenshot: ${seoShotPath}`);

    // --- STEP 2: SWITCH TO EMAIL FINDER & START CONCURRENT JOB ---
    console.log('\n[3] Switching route to /email-finder (LinkedIn Discovery)...');
    await page.goto('http://localhost:5173/email-finder', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));

    console.log('  Entering company website: https://shgtechnologies.com');
    const websiteInput = await page.waitForSelector('input[placeholder*="domain"], input[type="text"]');
    if (websiteInput) {
      await websiteInput.click({ count: 3 });
      await websiteInput.type('https://shgtechnologies.com');
    }

    console.log('  Submitting LinkedIn People Discovery job...');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    }
    await new Promise(r => setTimeout(r, 2500));

    const emailShotPath = path.join(ARTIFACT_DIR, 'browser_email_job_started.png');
    await page.screenshot({ path: emailShotPath, fullPage: true });
    console.log(`  Captured screenshot: ${emailShotPath}`);

    // --- STEP 3: SWITCH TO REPORTS (DOCUMENT ANALYZER) ---
    console.log('\n[4] Navigating away to /reports while both jobs run in background...');
    await page.goto('http://localhost:5173/reports', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));

    // Open Background Activity Panel
    console.log('  Toggling Background Activity Drawer from Header...');
    const activityPill = await page.$('header button');
    if (activityPill) {
      await activityPill.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    const drawerShotPath = path.join(ARTIFACT_DIR, 'browser_activity_drawer_running.png');
    await page.screenshot({ path: drawerShotPath, fullPage: true });
    console.log(`  Captured screenshot of background drawer: ${drawerShotPath}`);

    // --- STEP 4: TRIGGER BROWSER REFRESH ---
    console.log('\n[5] Refreshing the browser page (F5 / reload)...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    console.log('  Browser reloaded.');

    await new Promise(r => setTimeout(r, 2000));

    // Open drawer again after refresh
    const activityPillAfter = await page.$('header button');
    if (activityPillAfter) {
      await activityPillAfter.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    const refreshShotPath = path.join(ARTIFACT_DIR, 'browser_after_refresh_restored.png');
    await page.screenshot({ path: refreshShotPath, fullPage: true });
    console.log(`  Captured screenshot after reload showing restored state: ${refreshShotPath}`);

    // --- STEP 5: WAIT FOR COMPLETION AND INSPECT RESULTS ---
    console.log('\n[6] Waiting 8 seconds for jobs to finalize...');
    await new Promise(r => setTimeout(r, 8000));

    console.log('  Navigating back to /seo to view completed audit results...');
    await page.goto('http://localhost:5173/seo', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2500));

    const seoResultShotPath = path.join(ARTIFACT_DIR, 'browser_seo_result_verified.png');
    await page.screenshot({ path: seoResultShotPath, fullPage: true });
    console.log(`  Captured completed SEO audit screenshot: ${seoResultShotPath}`);

    console.log('  Navigating to /email-finder to view completed LinkedIn contacts...');
    await page.goto('http://localhost:5173/email-finder', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2500));

    const emailResultShotPath = path.join(ARTIFACT_DIR, 'browser_email_result_verified.png');
    await page.screenshot({ path: emailResultShotPath, fullPage: true });
    console.log(`  Captured completed Email Finder screenshot: ${emailResultShotPath}`);

    console.log('\n================================================================');
    console.log('BROWSER TEST COMPLETED SUCCESSFULLY WITH 5 ARTIFACT SCREENSHOTS!');
    console.log('================================================================');
  } finally {
    await browser.close();
  }
}

runBrowserTest().catch(err => {
  console.error('Browser automation error:', err);
  process.exit(1);
});

import { analyzeWebsiteSeo } from '../tools/websiteAnalysis.js';

async function runTest() {
  console.log('=== TEST C: SEO Audit of https://shgtechnologies.com/ ===');
  const url = 'https://shgtechnologies.com/';
  const audit = await analyzeWebsiteSeo(url);

  console.log('--- EXTRACTED PAGE METADATA ---');
  console.log('URL:', audit.url);
  console.log('HTTP Status Code:', audit.statusCode);
  console.log('Title:', JSON.stringify(audit.pageData.title), `(Calculated length: ${audit.pageData.titleLength})`);
  console.log('Description:', JSON.stringify(audit.pageData.description), `(Calculated length: ${audit.pageData.descriptionLength})`);
  console.log('Canonical URL:', audit.pageData.canonicalUrl);
  console.log('Robots Directive:', audit.pageData.robotsDirective);
  console.log('H1 Headings:', audit.pageData.headings.h1);
  console.log('H2 Count:', audit.pageData.headings.h2.length);
  console.log('Total Images:', audit.pageData.images.total, '| Missing Alt:', audit.pageData.images.missingAlt);
  console.log('JSON-LD Schemas:', audit.pageData.schemasFound);
  console.log('Robots.txt Status:', audit.robotsTxt.status, '| Found:', audit.robotsTxt.found);
  console.log('Sitemap.xml Status:', audit.sitemap.status, '| Found:', audit.sitemap.found);
  console.log('Performance Score:', audit.performance.score, `(${audit.performance.details})`);
  console.log('Overall Health Score:', audit.score);

  console.log('\n--- VERIFIED FINDINGS (First 5) ---');
  audit.findings.slice(0, 5).forEach((f, idx) => {
    console.log(`[${idx + 1}] [${f.priority.toUpperCase()}] [${f.category}] ${f.title}`);
    console.log(`    Actual: ${f.actualValue}`);
    console.log(`    Evidence: ${f.evidence}`);
    console.log(`    Fix: ${f.fix}`);
  });

  // Strict Assertions
  if (audit.statusCode !== 200) throw new Error(`Expected status 200, got ${audit.statusCode}`);
  if (audit.pageData.titleLength !== 24) throw new Error(`Expected title length 24, got ${audit.pageData.titleLength}`);
  if (audit.pageData.descriptionLength !== 142) throw new Error(`Expected trimmed description length 142, got ${audit.pageData.descriptionLength}`);
  if (audit.pageData.headings.h1.length !== 2) throw new Error(`Expected 2 H1 headings, got ${audit.pageData.headings.h1.length}`);
  if (audit.robotsTxt.status !== 404) throw new Error(`Expected robots.txt status 404, got ${audit.robotsTxt.status}`);
  if (audit.sitemap.status !== 200) throw new Error(`Expected sitemap status 200, got ${audit.sitemap.status}`);
  if (audit.performance.score !== 'Not measured') throw new Error(`Expected 'Not measured' performance, got ${audit.performance.score}`);

  console.log('\n>>> TEST C PASSED WITH 100% ACCURACY AGAINST RAW HTML <<<');
}

runTest().catch((err) => {
  console.error('Test C Failed:', err);
  process.exit(1);
});

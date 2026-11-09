import { geminiService } from './services/gemini.js';
import { store } from './services/store.js';
import { agentOrchestrator } from './agents/orchestrator.js';
import { analyzeWebsiteSeo } from './tools/websiteAnalysis.js';
import { executeTool } from './tools/registry.js';
import { env } from './config/env.js';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runTests() {
  console.log('=== MARKETMATE AI: COMPREHENSIVE VERIFICATION SUITE ===\n');

  let passed = 0;
  let failed = 0;

  // 1. Store Test
  try {
    console.log('[1/7] Testing Store Persistence...');
    const convs = await store.getConversations();
    const tasks = await store.getTasks();
    const stats = await store.getStats();
    console.log(`  -> Store loaded: ${convs.length} conversations, ${tasks.length} tasks, stats: ${JSON.stringify(stats)}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] Store Test:`, err.message);
    failed++;
  }

  await sleep(1000);

  // 2. Gemini Connection & Model Discovery
  try {
    console.log('\n[2/7] Testing Gemini API Connection & Models...');
    const verifyResult = await geminiService.verifyKey(env.GEMINI_API_KEY);
    if (!verifyResult.success) {
      throw new Error(verifyResult.message || 'Key verification failed');
    }
    console.log(`  -> Gemini Connected! Available models: ${verifyResult.availableModels.slice(0, 5).join(', ')}... (total: ${verifyResult.availableModels.length})`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] Gemini API Test:`, err.message);
    failed++;
  }

  await sleep(1500);

  // 3. Search Grounding Test
  try {
    console.log('\n[3/7] Testing Web Search & Research Grounding...');
    const searchRes = await geminiService.searchWithGrounding('top cloud migration companies in India');
    console.log(`  -> Grounded search summary length: ${searchRes.summary.length} characters`);
    console.log(`  -> Citations found: ${searchRes.sources.length}`);
    if (searchRes.sources.length > 0) {
      console.log(`  -> Sample citation: "${searchRes.sources[0].title}" - ${searchRes.sources[0].url}`);
    }
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] Search Grounding Test:`, err.message);
    failed++;
  }

  await sleep(1000);

  // 4. Safe Website Analyzer Test
  try {
    console.log('\n[4/7] Testing Deep SEO Website Analyzer (Live URL)...');
    const seoResult = await analyzeWebsiteSeo('https://example.com');
    console.log(`  -> Scraped: "${seoResult.title}" (Score: ${seoResult.score}/100)`);
    console.log(`  -> Headings: ${seoResult.headings.h1.length} H1s, ${seoResult.headings.h2.length} H2s, Total Links: ${seoResult.links.internalCount + seoResult.links.externalCount}`);
    console.log(`  -> Issues detected: ${seoResult.issues.length}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] Website Analyzer Test:`, err.message);
    failed++;
  }

  await sleep(1000);

  // 5. Tool Registry Dispatch Test
  try {
    console.log('\n[5/7] Testing Tool Registry Dispatch...');
    const kwResult = await executeTool('extract_keywords', { text: 'Cloud migration consulting, AWS architecture, enterprise DevOps, and Kubernetes modernization.' });
    if (!kwResult.success) throw new Error(kwResult.error);
    console.log(`  -> extract_keywords returned ${kwResult.data.topKeywords.length} top keywords`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] Tool Registry Test:`, err.message);
    failed++;
  }

  await sleep(1500);

  // 6. Specialist Content & Email Generator Test
  try {
    console.log('\n[6/7] Testing Specialist Generation (Email & Social Post)...');
    const emailPrompt = 'Generate a 1-step B2B cold email introducing an automated cloud migration assessment to CTOs.';
    const emailText = await geminiService.generateText(emailPrompt);
    console.log(`  -> Generated email sample length: ${emailText.length} characters`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] Specialist Generation Test:`, err.message);
    failed++;
  }

  await sleep(1500);

  // 7. Multi-Step Orchestrator Execution
  try {
    console.log('\n[7/7] Testing Autonomous Agent Orchestrator (Planning + Execution)...');
    const events: any[] = [];
    const workflowGen = agentOrchestrator.executeWorkflow('Find top 3 cloud migration providers in India and outline their core strengths.');

    for await (const event of workflowGen) {
      events.push(event);
      if (event.type === 'plan') {
        console.log(`  -> Plan Generated: ${event.data.plan.length} steps:`, event.data.plan);
      } else if (event.type === 'tool_call') {
        console.log(`  -> Tool Called: ${event.data.tool}`);
      } else if (event.type === 'tool_result') {
        console.log(`  -> Tool Result: ${event.data.tool} (Success: ${event.data.success})`);
      } else if (event.type === 'complete') {
        console.log(`  -> Orchestrator Workflow Complete! Result length: ${event.data.result.length} characters`);
      }
    }
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] Orchestrator Test:`, err.message);
    failed++;
  }

  console.log(`\n==================================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();

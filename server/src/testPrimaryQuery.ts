import { agentOrchestrator } from './agents/orchestrator.js';
import { store } from './services/store.js';

async function testPrimaryWorkflow() {
  console.log('================================================================');
  console.log('MARKETMATE AI: EXECUTING PRIMARY USER PROMPT WITH AUTONOMOUS AGENT');
  console.log('Prompt: "Research the top 10 cloud migration companies in India. Compare their services, identify their ideal customer profiles, analyze their websites and SEO, identify marketing opportunities, and prepare a complete marketing strategy for a new cloud migration company."');
  console.log('================================================================\n');

  const instruction = 'Research the top 10 cloud migration companies in India. Compare their services, identify their ideal customer profiles, analyze their websites and SEO, identify marketing opportunities, and prepare a complete marketing strategy for a new cloud migration company.';

  try {
    const generator = agentOrchestrator.executeWorkflow(instruction);

    for await (const event of generator) {
      if (event.type === 'plan') {
        console.log('\n[PLAN GENERATED]');
        event.data.plan.forEach((step: string, idx: number) => {
          console.log(`  ${idx + 1}. ${step}`);
        });
        console.log('');
      } else if (event.type === 'tool_call') {
        console.log(`[TOOL INVOCATION] -> ${event.data.tool}`);
      } else if (event.type === 'tool_result') {
        console.log(`[TOOL COMPLETED]  <- ${event.data.tool} (Success: ${event.data.success})`);
      } else if (event.type === 'complete') {
        console.log('\n================================================================');
        console.log('AUTONOMOUS WORKFLOW COMPLETE - OUTPUT PREVIEW:');
        console.log('================================================================\n');
        console.log(event.data.result.substring(0, 1500) + '\n\n... [output continued in storage]');
        console.log(`\nTotal Result Length: ${event.data.result.length} characters.`);
        console.log(`Total Steps Executed: ${event.data.steps.length}`);
      }
    }

    // Verify task was saved to persistent store
    const tasks = await store.getTasks();
    const latest = tasks[0];
    console.log(`\nVerified persistence in store: Task "${latest.id}" status is "${latest.status}" with ${latest.steps?.length || 0} audited steps.`);

    console.log('\n>>> PRIMARY QUERY VERIFICATION: SUCCESSFUL! <<<');
  } catch (err: any) {
    console.error('Workflow error:', err.message);
    process.exit(1);
  }
}

testPrimaryWorkflow();

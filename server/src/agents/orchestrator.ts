import { geminiService } from '../services/gemini.js';
import { executeTool, toolDeclarations } from '../tools/registry.js';
import { store } from '../services/store.js';
import { Task, TaskStep } from '../types/index.js';

export interface OrchestrationEvent {
  type: 'plan' | 'tool_call' | 'tool_result' | 'step_update' | 'final_chunk' | 'complete' | 'error';
  data: any;
}

export class AgentOrchestrator {
  private maxIterations = 3;

  /**
   * Execute an autonomous multi-step agent workflow
   */
  public async *executeWorkflow(
    instruction: string,
    existingTaskId?: string,
    modelOverride?: string
  ): AsyncGenerator<OrchestrationEvent, string, unknown> {
    const taskId = existingTaskId || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const task: Task = {
      id: taskId,
      instruction,
      category: this.categorizeInstruction(instruction),
      status: 'planning',
      startTime: new Date().toISOString(),
      plan: [],
      steps: []
    };

    await store.saveTask(task);

    try {
      // 1. Initial Planning Phase
      yield { type: 'step_update', data: { status: 'planning', message: 'Analyzing objective and generating execution plan...' } };

      const planPrompt = `User Instruction: "${instruction}"
You are the Lead Marketing Agent Orchestrator.
Generate a concise, numbered execution plan (3 to 5 steps) to accomplish this task using available tools (web_search, fetch_webpage, analyze_website, extract_keywords, generate_email, generate_social_post, analyze_data, create_report).
Output ONLY the numbered steps, one per line.`;

      const planText = await geminiService.generateText(planPrompt, modelOverride);
      const planSteps = planText
        .split('\n')
        .map(s => s.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(s => s.length > 0);

      task.plan = planSteps;
      task.status = 'running';
      await store.saveTask(task);

      yield { type: 'plan', data: { taskId, plan: planSteps, category: task.category } };

      // 2. Multi-turn Tool Calling Loop
      const contents: any[] = [
        {
          role: 'user',
          parts: [{
            text: `Objective: "${instruction}"
Execution Plan:
${planSteps.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}

Execute the necessary tools step by step to gather verified facts, crawl websites, analyze data, and prepare a complete, authoritative marketing output. Never invent data.`
          }]
        }
      ];

      let iteration = 0;
      let finalResponse = '';
      const executedSteps: TaskStep[] = [];

      while (iteration < this.maxIterations) {
        iteration++;
        await new Promise(r => setTimeout(r, 600));

        const response = await geminiService.generateWithTools(
          contents,
          toolDeclarations,
          modelOverride
        );

        const candidate = response.candidates?.[0];
        const content = candidate?.content;
        const functionCalls = response.functionCalls || [];

        // Check if Gemini invoked any tools
        if (functionCalls && functionCalls.length > 0) {
          // Record model turn in conversation context
          contents.push(content);

          for (const call of functionCalls) {
            const stepId = `step_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
            const stepTitle = `Executing ${call.name}`;

            yield {
              type: 'tool_call',
              data: {
                stepId,
                tool: call.name,
                args: call.args,
                message: `Executing ${call.name}...`
              }
            };

            // Execute backend tool
            const toolOutput = await executeTool(call.name, call.args || {});

            const taskStep: TaskStep = {
              id: stepId,
              title: stepTitle,
              status: toolOutput.success ? 'completed' : 'failed',
              tool: call.name,
              output: JSON.stringify(toolOutput.data || toolOutput.error).substring(0, 500)
            };
            executedSteps.push(taskStep);
            task.steps = executedSteps;
            await store.saveTask(task);

            yield {
              type: 'tool_result',
              data: {
                stepId,
                tool: call.name,
                success: toolOutput.success,
                result: toolOutput.data || toolOutput.error
              }
            };

            // Append tool response turn for Gemini
            contents.push({
              role: 'user',
              parts: [{
                functionResponse: {
                  name: call.name,
                  response: {
                    success: toolOutput.success,
                    output: toolOutput.data || toolOutput.error
                  }
                }
              }]
            });
          }
        } else {
          // No more function calls, final synthesis produced
          finalResponse = response.text || '';
          break;
        }
      }

      // If loop finished due to max iterations without final text, generate synthesis
      if (!finalResponse) {
        contents.push({
          role: 'user',
          parts: [{ text: 'Please synthesize all the collected findings above into the final comprehensive report with actionable takeaways and citations.' }]
        });
        const summaryRes = await geminiService.generateWithTools(contents, [], modelOverride);
        finalResponse = summaryRes.text || 'Workflow executed successfully.';
      }

      // 3. Complete Task
      task.status = 'completed';
      task.completionTime = new Date().toISOString();
      task.result = finalResponse;
      await store.saveTask(task);

      yield {
        type: 'complete',
        data: {
          taskId,
          result: finalResponse,
          steps: executedSteps
        }
      };

      return finalResponse;
    } catch (err: any) {
      task.status = 'failed';
      task.error = err.message || String(err);
      task.completionTime = new Date().toISOString();
      await store.saveTask(task);

      yield {
        type: 'error',
        data: { taskId, error: task.error }
      };

      throw err;
    }
  }

  private categorizeInstruction(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('research') || lower.includes('company') || lower.includes('competitor')) {
      return 'Market & Competitor Research';
    }
    if (lower.includes('seo') || lower.includes('audit') || lower.includes('ranking') || lower.includes('keyword')) {
      return 'SEO & Technical Optimization';
    }
    if (lower.includes('email') || lower.includes('sequence') || lower.includes('cold outreach')) {
      return 'Email Marketing';
    }
    if (lower.includes('post') || lower.includes('linkedin') || lower.includes('social') || lower.includes('blog')) {
      return 'Content Creation';
    }
    if (lower.includes('report') || lower.includes('metric') || lower.includes('data') || lower.includes('csv')) {
      return 'Reporting & Data Analysis';
    }
    return 'General Marketing Strategy';
  }
}

export const agentOrchestrator = new AgentOrchestrator();

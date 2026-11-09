import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { agentOrchestrator } from '../agents/orchestrator.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';
import { geminiService } from '../services/gemini.js';
import { store } from '../services/store.js';
import { Conversation, Message } from '../types/index.js';

const router = Router();

const executeAgentSchema = z.object({
  instruction: z.string().min(1, 'Instruction cannot be empty').trim(),
  conversationId: z.string().optional(),
  model: z.string().optional()
});

// POST /api/agent/execute - SSE Streaming endpoint for autonomous agent workflow
router.post('/execute', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instruction, conversationId: reqConvId, model } = executeAgentSchema.parse(req.body);

    if (!geminiService.isConfigured()) {
      res.status(400).json({ error: 'Gemini API key is not configured.' });
      return;
    }

    // Prepare conversation
    let conv: Conversation | null = null;
    let isNewConv = false;

    if (reqConvId) {
      conv = await store.getConversation(reqConvId);
    }

    if (!conv) {
      isNewConv = true;
      conv = {
        id: reqConvId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: instruction.length > 40 ? instruction.substring(0, 37) + '...' : instruction,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        metadata: { category: 'Agent Workflow' }
      };
    }

    // Append user instruction
    const userMsg: Message = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: instruction,
      timestamp: new Date().toISOString(),
      status: 'complete'
    };
    conv.messages.push(userMsg);
    await store.saveConversation(conv);

    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const assistantMsgId = `msg_a_${Date.now()}`;
    res.write(`data: ${JSON.stringify({
      type: 'start',
      conversationId: conv.id,
      title: conv.title,
      isNewConversation: isNewConv,
      assistantMessageId: assistantMsgId
    })}\n\n`);

    try {
      let finalReport = '';

      for await (const event of agentOrchestrator.executeWorkflow(instruction, undefined, model)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.type === 'complete') {
          finalReport = event.data.result;
        }
      }

      // Save final message in persistent conversation
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: finalReport,
        timestamp: new Date().toISOString(),
        status: 'complete',
        metadata: { model: model || geminiService.getModelName() }
      };
      conv.messages.push(assistantMsg);
      await store.saveConversation(conv);

      res.write(`data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMsgId,
        fullText: finalReport,
        conversationId: conv.id
      })}\n\n`);
      res.end();
    } catch (workflowError: any) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: workflowError.message || 'Agent execution failed'
      })}\n\n`);
      res.end();
    }
  } catch (err) {
    next(err);
  }
});

export default router;

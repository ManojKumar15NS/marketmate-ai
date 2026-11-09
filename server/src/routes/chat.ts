import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { geminiService } from '../services/gemini.js';
import { store } from '../services/store.js';
import { Conversation, Message } from '../types/index.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const sendMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, 'Message cannot be empty').trim(),
  model: z.string().optional()
});

const retrySchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  model: z.string().optional()
});

// Helper to generate a clean title from the initial prompt
function createTitleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/[#*`\n]/g, ' ').trim();
  if (clean.length <= 40) return clean;
  return clean.substring(0, 37) + '...';
}

// POST /api/chat/stream - SSE Streaming endpoint with multi-turn conversation
router.post('/stream', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversationId: reqConvId, message: userPrompt, model } = sendMessageSchema.parse(req.body);

    if (!geminiService.isConfigured()) {
      res.status(400).json({
        error: 'Gemini API key is not configured. Please add your key in Settings or server/.env'
      });
      return;
    }

    // Retrieve or create conversation
    let conv: Conversation | null = null;
    let isNewConv = false;

    if (reqConvId) {
      conv = await store.getConversation(reqConvId);
    }

    if (!conv) {
      isNewConv = true;
      conv = {
        id: reqConvId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: createTitleFromPrompt(userPrompt),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        metadata: { category: 'general' }
      };
    }

    // Append user message
    const userMsg: Message = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString(),
      status: 'complete'
    };
    conv.messages.push(userMsg);
    await store.saveConversation(conv);

    // Setup Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Send metadata header
    const assistantMsgId = `msg_a_${Date.now()}`;
    const selectedModel = model || geminiService.getModelName();
    
    res.write(`data: ${JSON.stringify({
      type: 'start',
      conversationId: conv.id,
      title: conv.title,
      isNewConversation: isNewConv,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsgId,
      model: selectedModel
    })}\n\n`);

    let accumulatedText = '';

    try {
      // Pass full conversation history for genuine multi-turn context
      for await (const chunk of geminiService.streamChat(conv.messages, selectedModel)) {
        accumulatedText += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`);
      }

      // Save assistant message to persistent store
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: accumulatedText,
        timestamp: new Date().toISOString(),
        status: 'complete',
        metadata: { model: selectedModel }
      };
      conv.messages.push(assistantMsg);
      await store.saveConversation(conv);

      // Send completion event
      res.write(`data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMsgId,
        fullText: accumulatedText,
        conversationId: conv.id
      })}\n\n`);
      res.end();
    } catch (streamError: any) {
      console.error('[Stream Error]', streamError.message);
      // Record failed state
      const errorMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: accumulatedText || 'Failed to generate response.',
        timestamp: new Date().toISOString(),
        status: 'error',
        metadata: { error: streamError.message, model: selectedModel }
      };
      conv.messages.push(errorMsg);
      await store.saveConversation(conv);

      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: streamError.message
      })}\n\n`);
      res.end();
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/chat - Non-streaming standard endpoint
router.post('/', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversationId: reqConvId, message: userPrompt, model } = sendMessageSchema.parse(req.body);

    if (!geminiService.isConfigured()) {
      res.status(400).json({
        error: 'Gemini API key is not configured. Please add your key in Settings or server/.env'
      });
      return;
    }

    let conv = reqConvId ? await store.getConversation(reqConvId) : null;
    let isNew = false;

    if (!conv) {
      isNew = true;
      conv = {
        id: reqConvId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: createTitleFromPrompt(userPrompt),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
      };
    }

    const userMsg: Message = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString(),
      status: 'complete'
    };
    conv.messages.push(userMsg);

    const selectedModel = model || geminiService.getModelName();
    const replyText = await geminiService.generateChat(conv.messages, selectedModel);

    const assistantMsg: Message = {
      id: `msg_a_${Date.now()}`,
      role: 'assistant',
      content: replyText,
      timestamp: new Date().toISOString(),
      status: 'complete',
      metadata: { model: selectedModel }
    };
    conv.messages.push(assistantMsg);
    await store.saveConversation(conv);

    res.json({
      conversationId: conv.id,
      title: conv.title,
      isNewConversation: isNew,
      message: assistantMsg
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/retry - Retry last failed response
router.post('/retry', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversationId, model } = retrySchema.parse(req.body);

    const conv = await store.getConversation(conversationId);
    if (!conv || conv.messages.length === 0) {
      res.status(404).json({ error: 'Conversation or messages not found' });
      return;
    }

    // Remove trailing failed assistant message if present
    const lastMsg = conv.messages[conv.messages.length - 1];
    if (lastMsg.role === 'assistant' && lastMsg.status === 'error') {
      conv.messages.pop();
    }

    // Find the last user message to retry
    const lastUserMsg = [...conv.messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) {
      res.status(400).json({ error: 'No user message to retry' });
      return;
    }

    const selectedModel = model || geminiService.getModelName();
    const replyText = await geminiService.generateChat(conv.messages, selectedModel);

    const assistantMsg: Message = {
      id: `msg_a_${Date.now()}`,
      role: 'assistant',
      content: replyText,
      timestamp: new Date().toISOString(),
      status: 'complete',
      metadata: { model: selectedModel }
    };
    conv.messages.push(assistantMsg);
    await store.saveConversation(conv);

    res.json({
      conversationId: conv.id,
      message: assistantMsg
    });
  } catch (err) {
    next(err);
  }
});

export default router;

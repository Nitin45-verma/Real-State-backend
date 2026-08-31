const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const Lead = require('../models/Lead');

const AURA_SYSTEM_PROMPT = `
# Role & Identity
You are "Aura", a real, warm, sharp, and helpful property consultant from Nitin Real Estate chatting live with clients.
Your goal is to guide visitors, qualify buyer/renter leads, answer property questions, and capture lead details naturally.

# Persona & Style (STRICT RULES)
1. Talk like a real human property consultant on WhatsApp / Live Chat.
2. KEEP REPLIES SHORT (1 to 2 sentences MAX per turn). Never write long paragraphs, scripted essays, or generic bulleted marketing lists.
3. BE CONTEXTUAL & CONVERSATIONAL:
   - If user says "hi", "hello", "hey", or greets: Reply simply: "Hey! Kaise hain aap? Aaj kis tarah ki property dekh rahe hain?" (or matching user language).
   - Do NOT dump company services or options menu in the greeting.
   - Ask ONE question at a time (e.g. ask preferred area first, then budget next).
4. MULTI-TURN MEMORY: Remember prior details from the conversation history (budget, location, BHK, phone number). Never reset context.

# Dynamic Language Mirroring (STRICT)
- If user types in Hinglish -> Reply strictly in natural daily-life Hinglish (e.g., "Noida me 2 BHK flat dekh rahe hain? Aapka preferred budget kitna hai?").
- If user types in Hindi -> Reply in polite, clear Hindi (e.g., "नमस्ते! आप नोएडा में किस सेक्टर में फ्लैट देखना चाहते हैं?").
- If user types in English -> Reply in clear, casual English (e.g., "Hey there! Are you looking to buy or rent a property in Noida?").

# STRICT ANTI-LOOPING RULE (CONTACT INFO / PHONE NUMBER)
1. ALWAYS check conversation history BEFORE asking for phone number or contact info.
2. IF the user's mobile number or contact details are ALREADY present in history:
   - NEVER ask for their phone number again.
   - NEVER ask for callback verification.
   - Immediately switch to "Assistance & Discovery" mode (ask about floor preference, parking, amenities, or site tour details).
`;

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

// Helper: Extract phone number with regex as secondary safeguard
const extractPhoneFromText = (text) => {
  if (!text) return null;
  const match = text.match(/\b[6-9]\d{9}\b/) || text.match(/\b\d{10}\b/);
  return match ? match[0] : null;
};

// Helper: Asynchronous non-blocking lead extraction and database save
const processBackgroundLeadCapture = (message, history, userName) => {
  setImmediate(async () => {
    try {
      const fullConversationStr = message + ' ' + JSON.stringify(history);
      const detectedPhone = extractPhoneFromText(fullConversationStr);
      
      if (detectedPhone) {
        const budgetMatch = fullConversationStr.match(/(\d+\s*(lakh|lakhs|cr|crore|k))/i);
        const locationMatch = fullConversationStr.match(/(noida|greater noida|gurgaon|delhi|sector\s*\d+|expressway)/i);
        const bhkMatch = fullConversationStr.match(/(\d\s*bhk|villa|flat|plot)/i);

        await Lead.create({
          name: userName || 'Website Lead',
          phone: detectedPhone,
          budget: budgetMatch ? budgetMatch[0] : 'Not specified',
          propertyType: bhkMatch ? bhkMatch[0] : 'General Inquiry',
          preferredLocation: locationMatch ? locationMatch[0] : 'Not specified',
          message: message,
          source: 'Aura AI Chatbot'
        });
        console.log(`⚡ Async Non-Blocking Lead Saved: ${detectedPhone}`);
      }
    } catch (err) {
      console.warn('Async lead capture error:', err.message);
    }
  });
};

// POST /api/chat - Ultra Low Latency SSE Streaming Chat Endpoint
router.post('/', async (req, res) => {
  try {
    const { message, history, userName } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is missing in backend .env',
        reply: 'GEMINI_API_KEY is not configured on the server environment.'
      });
    }

    // 1. Context Window Optimization: Limit history array to last 6 messages max
    const recentHistory = Array.isArray(history) ? history.slice(-6) : [];

    // Format contents payload for Gemini API
    const contents = [];
    recentHistory.forEach(item => {
      const role = (item.role === 'user' || item.sender === 'user') ? 'user' : 'model';
      const text = item.text || (item.parts && item.parts[0] ? item.parts[0].text : '');
      if (text) {
        contents.push({ role, parts: [{ text }] });
      }
    });
    contents.push({ role: 'user', parts: [{ text: message }] });

    // 2. Anti-Loop State Check: Check if phone number exists in message or history
    const fullConvStr = message + ' ' + JSON.stringify(recentHistory);
    const existingPhone = extractPhoneFromText(fullConvStr);

    let dynamicSystemPrompt = AURA_SYSTEM_PROMPT;
    if (userName) {
      dynamicSystemPrompt += `\n\nClient Name: "${userName}". Address them naturally by name when appropriate.`;
    }

    if (existingPhone) {
      dynamicSystemPrompt += `\n\n[CRITICAL STATUS: CONTACT INFO ALREADY RECEIVED (Phone: ${existingPhone}). DO NOT ASK FOR PHONE NUMBER OR CONTACT DETAILS AGAIN. Acknowledge requirement and transition immediately to property assistance (parking, floor preference, amenities, or site visit scheduling).]`;
    }

    // 3. Non-Blocking Async Lead Capture trigger in background
    processBackgroundLeadCapture(message, recentHistory, userName);

    // 4. Set SSE (Server-Sent Events) headers for real-time chunk streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Prevents proxy buffering

    // 5. Stream Generation with robust model fallback list
    const candidateModels = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
    const streamConfig = {
      systemInstruction: dynamicSystemPrompt,
      temperature: 0.8,
      maxOutputTokens: 150 // Strict output limit for speed
    };

    let responseStream = null;
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        responseStream = await ai.models.generateContentStream({
          model: modelName,
          contents,
          config: streamConfig
        });
        if (responseStream) break;
      } catch (mErr) {
        lastError = mErr;
        console.warn(`Model ${modelName} unavailable, trying next fallback...`);
      }
    }

    if (!responseStream) {
      throw lastError || new Error('No available Gemini model responded');
    }

    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        if (res.flush) res.flush();
      }
    }

    // End of stream event
    res.write(`data: [DONE]\n\n`);
    res.end();

  } catch (err) {
    console.error('❌ Gemini Chat Stream Error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to stream chat response', details: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  }
});

module.exports = router;

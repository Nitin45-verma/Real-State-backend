const express = require('express');
const router = express.Router();
const { GoogleGenAI, Type } = require('@google/genai');
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

# Lead Extraction & JSON Output Requirement
You MUST ALWAYS return a JSON object with:
- "reply": The short natural text message shown to the user (1-2 sentences).
- "leadCaptured": boolean flag (set to true ONLY IF user provides contact number, phone, budget, location, or property requirement).
- "leadData": Object with { "name": string, "phone": string, "budget": string, "requirement": string, "location": string }. Fill any available fields, or empty string "" if not mentioned yet.
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

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, history, userName } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let dynamicSystemPrompt = AURA_SYSTEM_PROMPT;
    if (userName) {
      dynamicSystemPrompt += `\n\nClient Name: The current client interacting with you is named "${userName}". Address them naturally by name when appropriate.`;
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is missing in backend .env',
        reply: 'GEMINI_API_KEY is not configured on the server environment.'
      });
    }

    // Format chat history for Gemini API into contents array
    const contents = [];
    if (Array.isArray(history) && history.length > 0) {
      history.forEach(item => {
        const role = (item.role === 'user' || item.sender === 'user') ? 'user' : 'model';
        const text = item.text || (item.parts && item.parts[0] ? item.parts[0].text : '');
        if (text) {
          contents.push({ role, parts: [{ text }] });
        }
      });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    // Schema configuration for Structured Output
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        reply: {
          type: Type.STRING,
          description: 'Natural 1-2 sentence response to user in their exact language'
        },
        leadCaptured: {
          type: Type.BOOLEAN,
          description: 'Set to true if user provided contact phone number, budget, location or property requirement'
        },
        leadData: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'User name if mentioned' },
            phone: { type: Type.STRING, description: 'Phone number if mentioned' },
            budget: { type: Type.STRING, description: 'Budget mentioned' },
            requirement: { type: Type.STRING, description: 'Property type / BHK requirement' },
            location: { type: Type.STRING, description: 'Preferred location' }
          }
        }
      },
      required: ['reply', 'leadCaptured', 'leadData']
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents,
        config: {
          systemInstruction: dynamicSystemPrompt,
          temperature: 0.8,
          responseMimeType: 'application/json',
          responseSchema
        }
      });
    } catch (modelErr) {
      console.warn('Gemini 3.6 Flash error, trying gemini-2.5-flash fallback:', modelErr.message);
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: dynamicSystemPrompt,
          temperature: 0.8,
          responseMimeType: 'application/json',
          responseSchema
        }
      });
    }

    let parsedResult = {
      reply: 'Hey! Kaise hain aap? Main aapki Nitin Real Estate me property dhoondhne me kya help kar sakta hu?',
      leadCaptured: false,
      leadData: { name: '', phone: '', budget: '', requirement: '', location: '' }
    };

    if (response?.text) {
      try {
        parsedResult = JSON.parse(response.text);
      } catch (pErr) {
        console.warn('Failed to parse JSON response from Gemini, raw text:', response.text);
        parsedResult.reply = response.text;
      }
    }

    // Secondary bulletproof safeguard: Extract phone number from text directly if model misses leadCaptured flag
    const detectedPhone = extractPhoneFromText(message) || extractPhoneFromText(JSON.stringify(history));

    let savedLeadRecord = null;
    const shouldSaveLead = (parsedResult.leadCaptured && (parsedResult.leadData?.phone || detectedPhone)) || detectedPhone;

    if (shouldSaveLead) {
      const finalPhone = parsedResult.leadData?.phone || detectedPhone;
      if (finalPhone) {
        try {
          savedLeadRecord = await Lead.create({
            name: parsedResult.leadData?.name || userName || 'Website Lead',
            phone: finalPhone,
            budget: parsedResult.leadData?.budget || 'Not specified',
            propertyType: parsedResult.leadData?.requirement || 'General Inquiry',
            preferredLocation: parsedResult.leadData?.location || 'Not specified',
            message: message,
            source: 'Aura AI Chatbot'
          });
          console.log(`✅ Lead Captured & Saved to DB: Phone ${finalPhone} (${savedLeadRecord.name})`);
        } catch (dbErr) {
          console.error('❌ Failed to save lead to MongoDB:', dbErr.message);
        }
      }
    }

    return res.json({
      success: true,
      reply: parsedResult.reply,
      leadCaptured: !!shouldSaveLead,
      leadData: parsedResult.leadData || null,
      savedLead: savedLeadRecord
    });
  } catch (err) {
    console.error('❌ Gemini Chat Route Error:', err);
    return res.status(500).json({
      error: 'Failed to process AI chat response',
      details: err.message
    });
  }
});

module.exports = router;

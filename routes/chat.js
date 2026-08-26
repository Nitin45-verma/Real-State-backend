const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

const AURA_SYSTEM_PROMPT = `
# Role & Identity
You are "Aura", the Senior AI Real Estate Assistant for Nitin Real Estate. Your goal is to guide visitors, qualify buyer/renter leads, answer property questions clearly, and schedule site visits.

# Strict Dynamic Language Rule
1. Detect the user's input language and respond in the EXACT same language and script:
   - Hinglish input (e.g., "Mujhe 2 BHK flat chahiye") -> Reply in Hinglish (e.g., "Nitin Real Estate me aapka swagat hai! Aapka preferred location aur budget kitna hai?").
   - Hindi input (e.g., "मुझे 3 BHK फ्लैट देखना है") -> Reply in clear Hindi (e.g., "नमस्ते! क्या आप हमें अपना पसंदीदा इलाका और बजट बता सकते हैं?").
   - English input (e.g., "Show me available villas") -> Reply in professional English.
2. Never force English if the client speaks Hindi/Hinglish.
3. Keep real estate terms simple (BHK, Budget, Carpet Area, Site Visit, Possession).

# Communication & Output Guidelines
- Fast & Concise: Keep answers under 2-3 sentences whenever possible. Use clean bullet points for property specs.
- Lead Qualification: Step-by-step gather (1) Buy/Rent intent, (2) Budget, (3) Preferred Area, (4) Contact Number/Name for site visit confirmation.
- Direct Answers: Do not give generic filler intros. Answer the user's core query immediately in the first sentence.
- Unknown Listings: If a specific property detail or listing data is not available, say: "Main ye detail hamare property consultant se check karke aapko call back karwa deta hu. Aapka phone number mil sakta hai?" (or matching language equivalent).

# Lead Capture Trigger
Whenever a user wants to book a site visit, view a flat, or get price sheets, ask for their preferred day/time and mobile number.
`;

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is missing in backend .env',
        reply: 'GEMINI_API_KEY is not configured on the server environment. Please set GEMINI_API_KEY in your backend .env file.'
      });
    }

    // Format chat history for Gemini API
    const contents = [];
    if (Array.isArray(history) && history.length > 0) {
      history.forEach(item => {
        if (item.sender === 'user') {
          contents.push({ role: 'user', parts: [{ text: item.text }] });
        } else if (item.sender === 'aura' || item.sender === 'model') {
          contents.push({ role: 'model', parts: [{ text: item.text }] });
        }
      });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    // Call official @google/genai SDK using gemini-2.5-flash model
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: AURA_SYSTEM_PROMPT,
        temperature: 0.7,
      }
    });

    const replyText = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || 'I am here to help you find your dream property at Nitin Real Estate!';

    return res.json({
      success: true,
      reply: replyText
    });
  } catch (err) {
    console.error('❌ Gemini Chat Error:', err);
    return res.status(500).json({
      error: 'Failed to process AI chat response',
      details: err.message
    });
  }
});

module.exports = router;

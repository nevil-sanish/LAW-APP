import { SYSTEM_PROMPT } from './constants';
import type { Message } from './types';

// Groq API configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

// Model fallback chain — ordered by free-tier throughput
// llama-3.1-8b-instant  → 30 RPM · 14,400 RPD · 6,000 TPM  (highest daily quota)
// llama-3.3-70b-versatile → 30 RPM · 1,000 RPD · 12,000 TPM (better quality, lower daily cap)
const PRIMARY_MODEL = 'llama-3.1-8b-instant';
const FALLBACK_MODEL = 'llama-3.3-70b-versatile';

// Max conversation history messages to send (keeps token usage low)
const MAX_HISTORY_MESSAGES = 10;

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(msg: string): boolean {
  return (
    msg.includes('rate_limit') ||
    msg.includes('429') ||
    msg.includes('Too Many') ||
    msg.includes('quota') ||
    msg.includes('limit')
  );
}

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Attempt a single Groq API call
 */
async function attemptGenerate(
  apiKey: string,
  model: string,
  messages: GroqMessage[],
): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      top_p: 0.95,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('Empty response from Groq');
  }
  return text;
}

export async function sendChatMessage(
  history: Message[],
  userMessage: string,
  customApiKey?: string,
): Promise<string> {
  const apiKey = customApiKey || GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Groq API key not configured. Add VITE_GROQ_API_KEY to your .env.local file. ' +
      'Get a free key at https://console.groq.com/keys',
    );
  }

  // Only send recent history to save tokens
  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);

  // Build conversation history for Groq (OpenAI-compatible format)
  const messages: GroqMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    });
  }

  // Add the new user message
  messages.push({
    role: 'user',
    content: userMessage,
  });

  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: Error | null = null;

  // Try each model
  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Trying Groq ${model} (attempt ${attempt + 1})`);
        return await attemptGenerate(apiKey, model, messages);
      } catch (error: unknown) {
        const err = error as { message?: string };
        const msg = err.message || '';
        lastError = error as Error;

        console.warn(`Groq ${model} attempt ${attempt + 1} failed:`, msg);

        if (isRateLimitError(msg)) {
          if (attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAY_MS);
            continue;
          }
          // Exhausted retries — try next model
          break;
        }

        // Non-rate-limit error — try next model
        break;
      }
    }
  }

  // All models and retries exhausted
  const errMsg = (lastError as { message?: string })?.message || '';

  if (isRateLimitError(errMsg)) {
    throw new Error(
      'API rate limit reached. Please wait a moment and try again. ' +
      'You can check your usage at https://console.groq.com',
    );
  }

  if (errMsg.includes('invalid_api_key') || errMsg.includes('401') || errMsg.includes('403')) {
    throw new Error(
      'Invalid Groq API key. Please check your VITE_GROQ_API_KEY in .env.local. ' +
      'Get a free key at https://console.groq.com/keys',
    );
  }

  console.error('Groq API error:', errMsg);
  throw new Error(
    'Failed to get a response. Please try again. Error: ' + (errMsg || 'Unknown error'),
  );
}

/**
 * Analyze uploaded legal text using the Groq API.
 */
export async function analyzeDocumentWithUserKey(
  userApiKey: string,
  rawText: string,
): Promise<{ title: string; sections: string[] }> {
  const prompt = `You are a legal document analyzer specializing in Indian law. Analyze the following legal text and return a JSON object with:
1. "title" — a short descriptive title for this legal document
2. "sections" — an array of strings, each being a key section/provision/clause found in the text

IMPORTANT: Return ONLY valid JSON, no markdown fences, no explanation.

TEXT TO ANALYZE:
---
${rawText.slice(0, 12000)}
---`;

  try {
    const messages: GroqMessage[] = [
      { role: 'user', content: prompt },
    ];

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userApiKey}`,
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || 'Untitled Document',
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    throw new Error(
      'Failed to analyze document. Please check your API key and try again. Error: ' +
        (err.message || 'Unknown error'),
    );
  }
}

// ============ Law Verification using App's Groq API Key ============

const VALID_CATEGORIES = ['constitutional', 'civil', 'criminal', 'corporate', 'labour'];

export interface LawVerificationResult {
  isLegitimate: boolean;
  title: string;
  category: string;
  sections: string[];
  summary: string;
  reason: string;
}

/**
 * Verify and categorize an uploaded law using the app's Groq API key.
 * This checks if the text is a legitimate Indian law/legal document,
 * categorizes it, and extracts metadata.
 */
export async function verifyAndCategorizeLaw(
  rawText: string,
): Promise<LawVerificationResult> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not configured. Contact the administrator.');
  }

  const prompt = `You are an expert Indian legal document verifier and classifier. Analyze the following text and determine:

1. Is this a legitimate Indian law, legal statute, act, code, amendment, ordinance, or legal provision? (true/false)
2. What is the proper title of this law/document?
3. Which category does it best fit into? Choose EXACTLY ONE from: constitutional, civil, criminal, corporate, labour
4. What are the key sections/provisions/clauses? (array of strings)
5. Write a 2-3 sentence summary of this law.
6. Brief reason for your legitimacy determination.

Return ONLY valid JSON in this exact format:
{
  "isLegitimate": true,
  "title": "The Indian Contract Act, 1872",
  "category": "civil",
  "sections": ["Section 1: Short title", "Section 2: Interpretation clause"],
  "summary": "This act governs the law of contracts in India...",
  "reason": "This is a well-known Indian statute..."
}

IMPORTANT: Return ONLY valid JSON, no markdown fences, no explanation. The category MUST be one of: constitutional, civil, criminal, corporate, labour.

TEXT TO VERIFY:
---
${rawText.slice(0, 15000)}
---`;

  const messages: GroqMessage[] = [
    { role: 'user', content: prompt },
  ];

  // Try with primary model, fallback to secondary
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '{}';
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Validate category
      const category = VALID_CATEGORIES.includes(parsed.category)
        ? parsed.category
        : 'constitutional';

      return {
        isLegitimate: parsed.isLegitimate === true,
        title: parsed.title || 'Untitled Law',
        category,
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        summary: parsed.summary || 'No summary available.',
        reason: parsed.reason || 'No reason provided.',
      };
    } catch (error: unknown) {
      lastError = error as Error;
      console.warn(`Law verification with ${model} failed:`, (error as Error).message);
      continue;
    }
  }

  throw new Error(
    'Failed to verify law. Please try again. Error: ' +
      ((lastError as { message?: string })?.message || 'Unknown error'),
  );
}

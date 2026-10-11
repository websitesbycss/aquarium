import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';

let client: GoogleGenAI | undefined;

function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return (client ??= new GoogleGenAI({ apiKey }));
}

/**
 * Classifies one merchant name into one of `categories`. Tiny JSON output.
 * Returns null on any failure so the caller can fall back without caching.
 */
export async function classifyMerchant(merchant: string, categories: string[]): Promise<string | null> {
  const model = process.env.GEMINI_MODEL;
  if (!model) throw new Error('GEMINI_MODEL is not set');
  try {
    const res = await ai().models.generateContent({
      model,
      contents: `Pick the single best spending category for the merchant "${merchant}". Categories: ${categories.join(', ')}.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { category: { type: Type.STRING, enum: categories } },
          required: ['category'],
        },
      },
    });
    const parsed = z.object({ category: z.enum(categories as [string, ...string[]]) }).parse(JSON.parse(res.text ?? ''));
    return parsed.category;
  } catch (e) {
    console.error('gemini classify failed:', (e as Error).message);
    return null;
  }
}

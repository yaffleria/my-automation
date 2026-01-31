import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config();

/**
 * Executes a prompt against the configured Vercel AI Gateway.
 * Uses VERCEL_AI_GATEWAY_API_KEY and VERCEL_AI_MODEL from environment variables.
 * 
 * @param prompt The prompt to send to the AI model.
 * @returns The streamText result object.
 */
export async function askAi(prompt: string) {
  const apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY;
  const modelId = process.env.VERCEL_AI_MODEL;

  if (!apiKey) {
    throw new Error('VERCEL_AI_GATEWAY_API_KEY is not defined in environment variables.');
  }

  if (!modelId) {
    throw new Error('VERCEL_AI_MODEL is not defined in environment variables.');
  }

  // Initialize the OpenAI provider with the specific API key
  // This setup assumes the Vercel AI Gateway key is compatible with the OpenAI SDK structure
  // or that the provider is configured to use the gateway implicitly if that's how the key works.
  // Note: If a custom baseURL is required for the gateway, it should be added here.
  const openai = createOpenAI({
    apiKey: apiKey,
  });

  // Execute the request
  const result = streamText({
    model: openai(modelId),
    prompt: prompt,
  });

  return result;
}

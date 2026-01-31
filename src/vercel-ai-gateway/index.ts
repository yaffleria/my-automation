import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import * as readline from 'readline';
import { sendTelegramMessage } from '../telegram-bot/sender';
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
    baseURL: 'https://ai-gateway.vercel.sh/v1',
  });

  // Execute the request
  const result = streamText({
    model: openai(modelId),
    prompt: prompt,
  });

  return result;
}

export async function runInteractiveAi() {
  try {
    const args = process.argv.slice(2);
    const shouldSendToTelegram = args.includes('--telegram');
    const cleanArgs = args.filter(arg => !arg.startsWith('--'));

    let prompt = '';
    if (cleanArgs.length > 0) {
      prompt = cleanArgs.join(' ');
    } else {
      prompt = await getInputFromStdin();
    }

    if (!prompt || !prompt.trim()) {
      console.log('No prompt provided. Exiting.');
      return;
    }

    console.log('--- Prompt ---');
    console.log(prompt);
    console.log('--------------');

    console.log('Requesting AI response...');
    const result = await askAi(prompt);
    
    let fullResponse = '';
    for await (const part of result.textStream) {
      process.stdout.write(part);
      fullResponse += part;
    }
    console.log('\n');

    if (shouldSendToTelegram) {
      if (fullResponse.trim()) {
          console.log('Sending response to Telegram...');
          await sendTelegramMessage(fullResponse);
          console.log('Message sent to Telegram successfully.');
      } else {
          console.warn('AI returned empty response. Nothing sent to Telegram.');
      }
    }

    console.log('Job finished successfully.');

  } catch (error) {
    console.error('Job failed:', error);
    process.exit(1);
  }
}

async function getInputFromStdin(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Please enter your prompt: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Check if this module is being run directly
if (require.main === module) {
  runInteractiveAi();
}

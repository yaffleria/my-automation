import { run as runRanto28 } from './ranto28-scrapper/index';
import { sendTelegramMessage } from './telegram-bot/sender';
import { askAi } from './vercel-ai-gateway/index';

const args = process.argv.slice(2);
const command = args[0];
const commandArgs = args.slice(1);

const commands: { [key: string]: (args: string[]) => Promise<void> } = {
  'ranto28-scrapper': runRanto28,
  'telegram-send': async (args: string[]) => {
    const message = args.join(' ');
    if (!message) {
      console.error('Please provide a message to send.');
      return;
    }
    await sendTelegramMessage(message);
  },
  'ai-chat': async (args: string[]) => {
    const prompt = args.join(' ');
    if (!prompt) {
      console.error('Please provide a prompt.');
      return;
    }
    try {
      const result = await askAi(prompt);
      for await (const textPart of result.textStream) {
        process.stdout.write(textPart);
      }
      console.log('\n');
    } catch (error) {
      console.error('Error calling AI:', error);
    }
  },
};

if (!command) {
  console.log('Usage: node src/index.js <command> [options]');
  console.log('Available commands:', Object.keys(commands).join(', '));
  process.exit(1);
}

if (commands[command]) {
  commands[command](commandArgs);
} else {
  console.error(`Unknown command: ${command}`);
  console.log('Available commands:', Object.keys(commands).join(', '));
  process.exit(1);
}

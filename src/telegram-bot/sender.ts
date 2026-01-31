import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
// Also try standard .env if .env.local doesn't exist or is insufficient
dotenv.config();

export async function sendTelegramMessage(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  if (!token || !channelId) {
    console.error('Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID environment variables must be set.');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await axios.post(url, {
      chat_id: channelId,
      text: message,
    });

    if (response.data.ok) {
      console.log(`Message sent to ${channelId} successfully.`);
    } else {
      console.error('Failed to send message:', response.data.description);
    }
  } catch (error: any) {
    console.error('Error sending Telegram message:', error.response?.data || error.message);
  }
}

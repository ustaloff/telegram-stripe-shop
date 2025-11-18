import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { catalog } from './catalog.js';
import { createCheckout } from './stripe.js';
import { createOrder } from './orders.js';

dotenv.config();

// Initialize bot only if token is provided (skip in test environment)
let bot;
if (process.env.BOT_TOKEN) {
  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
} else {
  // Create mock bot for testing
  bot = {
    sendMessage: async () => ({ message_id: 0 }),
    onText: () => {},
    on: () => {}
  };
}

export { bot };

// Allow test files to inject mock bot
export function setBotInstance(mockBot) {
  bot = mockBot;
}

export function initBot() {
  bot.onText(/start/, msg => {
    bot.sendMessage(msg.chat.id, 'Добро пожаловать! Напишите /shop чтобы открыть каталог.');
  });

  bot.onText(/shop/, msg => {
    const items = catalog.map(p => [
      { text: `${p.name} — $${p.price/100}`, callback_data: 'buy_' + p.id }
    ]);
    bot.sendMessage(msg.chat.id, 'Каталог товаров:', {
      reply_markup: { inline_keyboard: items }
    });
  });

  bot.on('callback_query', async q => {
    if (q.data.startsWith('buy_')) {
      const id = Number(q.data.replace('buy_', ''));
      const product = catalog.find(p => p.id === id);
      
      try {
        // Pre-generate external ID to pass to both Stripe and database
        const externalId = randomUUID();
        
        // Create Stripe checkout session with external_id in metadata
        const { url, sessionId } = await createCheckout(
          product.price,
          product.currency,
          product.name,
          { external_id: externalId }
        );
        
        // Create order in database with checkout session ID and external ID
        await createOrder({
          userId: q.from.id,
          chatId: q.message.chat.id,
          productId: product.id,
          productName: product.name,
          amount: product.price,
          currency: product.currency,
          checkoutSessionId: sessionId,
          externalId
        });
        
        bot.sendMessage(q.message.chat.id, `Оплатите: ${url}`);
      } catch (error) {
        console.error('Error creating order:', error);
        bot.sendMessage(
          q.message.chat.id,
          'Произошла ошибка при создании заказа. Пожалуйста, попробуйте позже.'
        );
      }
    }
  });
}

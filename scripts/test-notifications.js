#!/usr/bin/env node
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { sendPaymentSuccess, sendPaymentFailed, sendRefundNotification } from '../src/notifications.js';

dotenv.config();

console.log('🔍 Тестирование системы уведомлений...\n');

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не установлен в .env');
  process.exit(1);
}

const chatId = process.argv[2];

if (!chatId) {
  console.error('❌ Укажите chat_id как аргумент');
  console.log('\nИспользование: node scripts/test-notifications.js <chat_id>');
  console.log('\n💡 Чтобы узнать ваш chat_id:');
  console.log('   1. Напишите боту любое сообщение');
  console.log('   2. Откройте: https://api.telegram.org/bot<BOT_TOKEN>/getUpdates');
  console.log('   3. Найдите "chat":{"id": YOUR_CHAT_ID}');
  process.exit(1);
}

try {
  const bot = new TelegramBot(process.env.BOT_TOKEN);
  
  console.log(`📤 Отправка тестовых уведомлений в chat_id: ${chatId}\n`);
  
  // Тест успешного платежа
  console.log('1️⃣ Отправка уведомления об успешном платеже...');
  await sendPaymentSuccess(bot, chatId, {
    orderId: 'TEST-001',
    productName: 'Тестовый товар',
    amount: 5000,
    currency: 'usd'
  });
  console.log('✅ Отправлено\n');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Тест неудачного платежа
  console.log('2️⃣ Отправка уведомления о неудачном платеже...');
  await sendPaymentFailed(bot, chatId, 'Недостаточно средств на карте');
  console.log('✅ Отправлено\n');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Тест возврата
  console.log('3️⃣ Отправка уведомления о возврате...');
  await sendRefundNotification(bot, chatId, {
    orderId: 'TEST-001',
    amount: 5000,
    currency: 'usd'
  });
  console.log('✅ Отправлено\n');
  
  console.log('✅ Все уведомления отправлены успешно');
  console.log('📱 Проверьте Telegram');
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

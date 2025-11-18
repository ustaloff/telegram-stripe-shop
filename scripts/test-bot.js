#!/usr/bin/env node
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

console.log('🔍 Проверка подключения к Telegram Bot...\n');

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не установлен в .env');
  process.exit(1);
}

try {
  const bot = new TelegramBot(process.env.BOT_TOKEN);
  
  // Получение информации о боте
  const me = await bot.getMe();
  console.log('✅ Подключение к Telegram Bot успешно');
  console.log(`🤖 Имя бота: ${me.first_name}`);
  console.log(`🔗 Username: @${me.username}`);
  console.log(`🆔 Bot ID: ${me.id}`);
  
  // Проверка webhook
  const webhookInfo = await bot.getWebHookInfo();
  if (webhookInfo.url) {
    console.log(`\n⚠️  Webhook установлен: ${webhookInfo.url}`);
    console.log('   Для polling режима webhook должен быть пустым');
  } else {
    console.log('\n✅ Webhook не установлен (polling режим)');
  }
  
  console.log('\n✅ Проверка завершена успешно');
  console.log(`\n💡 Откройте бота: https://t.me/${me.username}`);
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

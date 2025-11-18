#!/usr/bin/env node
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

console.log('🔍 Проверка подключения к Stripe...\n');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY не установлен в .env');
  process.exit(1);
}

try {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  
  // Проверка API ключа
  const balance = await stripe.balance.retrieve();
  console.log('✅ Подключение к Stripe успешно');
  console.log(`💰 Баланс: ${balance.available[0].amount / 100} ${balance.available[0].currency.toUpperCase()}`);
  
  // Создание тестовой сессии
  console.log('\n🧪 Создание тестовой checkout сессии...');
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'Test Product' },
        unit_amount: 1000,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  });
  
  console.log('✅ Тестовая сессия создана');
  console.log(`🔗 Session ID: ${session.id}`);
  console.log(`🔗 URL: ${session.url}`);
  
  console.log('\n✅ Проверка завершена успешно');
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

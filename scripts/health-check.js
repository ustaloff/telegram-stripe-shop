#!/usr/bin/env node
/**
 * Health Check Script
 * Проверяет все компоненты системы
 */
import dotenv from 'dotenv';
import { pool } from '../src/db.js';
import TelegramBot from 'node-telegram-bot-api';
import Stripe from 'stripe';

dotenv.config();

const checks = {
  env: false,
  db: false,
  stripe: false,
  bot: false
};

console.log('🏥 Health Check - Проверка системы\n');
console.log('='.repeat(50));

// 1. Проверка переменных окружения
console.log('\n1️⃣ Проверка переменных окружения...');
const requiredEnvVars = [
  'BOT_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SERVER_URL',
  'DATABASE_URL'
];

let envMissing = [];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    envMissing.push(varName);
  }
}

if (envMissing.length > 0) {
  console.log(`❌ Отсутствуют переменные: ${envMissing.join(', ')}`);
} else {
  console.log('✅ Все переменные окружения установлены');
  checks.env = true;
}

// 2. Проверка базы данных
console.log('\n2️⃣ Проверка подключения к MySQL...');
try {
  const connection = await pool.getConnection();
  const [tables] = await connection.query('SHOW TABLES');
  const tableNames = tables.map(row => Object.values(row)[0]);
  
  if (tableNames.includes('orders')) {
    console.log('✅ База данных подключена');
    console.log(`   Таблицы: ${tableNames.join(', ')}`);
    checks.db = true;
  } else {
    console.log('⚠️  База данных подключена, но таблица orders не найдена');
    console.log('   Запустите: npm run migrate');
  }
  
  connection.release();
} catch (error) {
  console.log(`❌ Ошибка подключения к БД: ${error.message}`);
}

// 3. Проверка Stripe
console.log('\n3️⃣ Проверка подключения к Stripe...');
if (process.env.STRIPE_SECRET_KEY) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    await stripe.balance.retrieve();
    console.log('✅ Stripe API подключен');
    checks.stripe = true;
  } catch (error) {
    console.log(`❌ Ошибка Stripe: ${error.message}`);
  }
} else {
  console.log('⏭️  Пропущено (нет STRIPE_SECRET_KEY)');
}

// 4. Проверка Telegram Bot
console.log('\n4️⃣ Проверка подключения к Telegram Bot...');
if (process.env.BOT_TOKEN) {
  try {
    const bot = new TelegramBot(process.env.BOT_TOKEN);
    const me = await bot.getMe();
    console.log('✅ Telegram Bot подключен');
    console.log(`   @${me.username} (${me.first_name})`);
    checks.bot = true;
  } catch (error) {
    console.log(`❌ Ошибка Bot: ${error.message}`);
  }
} else {
  console.log('⏭️  Пропущено (нет BOT_TOKEN)');
}

// Итоговый отчет
console.log('\n' + '='.repeat(50));
console.log('\n📊 Итоговый отчет:\n');

const total = Object.keys(checks).length;
const passed = Object.values(checks).filter(v => v).length;
const percentage = Math.round((passed / total) * 100);

console.log(`✅ Пройдено: ${passed}/${total} (${percentage}%)`);

if (percentage === 100) {
  console.log('\n🎉 Все проверки пройдены! Система готова к работе.');
  await pool.end();
  process.exit(0);
} else {
  console.log('\n⚠️  Некоторые проверки не пройдены.');
  console.log('   См. инструкции выше для исправления проблем.');
  console.log('   Подробнее: SETUP.md');
  await pool.end();
  process.exit(1);
}
